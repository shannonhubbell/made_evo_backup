#!/usr/bin/env tsx
/**
 * Backfills the `program` link field on Eventbrite-imported Event entries that don't
 * have one yet, using a heuristic matcher (see scripts/lib/program-matcher.ts) trained
 * on events that already have a program assigned.
 *
 * Scoped to events created by the Eventbrite import pipeline (slug ends in
 * `-{eventbriteId}`), so pre-existing/unrelated legacy entries are left untouched.
 *
 * Usage:
 *   tsx scripts/map-events-to-programs.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildProgramIndex, matchProgram, type ProgramInfo, type TrainingEvent } from './lib/program-matcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFile();

const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID || '';
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN || '';
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cf(pathname: string, method: string, body?: any, extraHeaders?: Record<string, string>): Promise<Response> {
  const res = await fetch(`${CONTENTFUL_API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const retryAfter = parseFloat(res.headers.get('x-contentful-ratelimit-reset') || '1');
    console.log(`   ⏳ Rate limited, waiting ${retryAfter}s...`);
    await sleep((retryAfter || 1) * 1000);
    return cf(pathname, method, body, extraHeaders);
  }
  return res;
}

async function fetchAllPrograms(): Promise<ProgramInfo[]> {
  const programs: ProgramInfo[] = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;
  while (skip < total) {
    const res = await cf(`/entries?content_type=program&limit=${limit}&skip=${skip}`, 'GET');
    const data = await res.json();
    total = data.total ?? 0;
    for (const item of data.items || []) {
      const title = item.fields?.title?.['en-US'] || item.fields?.name?.['en-US'];
      if (title) programs.push({ id: item.sys.id, title });
    }
    skip += limit;
  }
  return programs;
}

interface EventEntrySummary {
  id: string;
  version: number;
  title?: string;
  slug?: string;
  programId?: string;
  fields: any;
}

async function fetchAllEvents(): Promise<EventEntrySummary[]> {
  const events: EventEntrySummary[] = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;
  while (skip < total) {
    const res = await cf(`/entries?content_type=event&limit=${limit}&skip=${skip}`, 'GET');
    const data = await res.json();
    total = data.total ?? 0;
    for (const item of data.items || []) {
      events.push({
        id: item.sys.id,
        version: item.sys.version,
        title: item.fields?.title?.['en-US'],
        slug: item.fields?.slug?.['en-US'],
        programId: item.fields?.program?.['en-US']?.sys?.id,
        fields: item.fields,
      });
    }
    skip += limit;
  }
  return events;
}

/** Matches the slug convention used by scripts/push-eventbrite-events-to-contentful.ts */
function isEventbriteImported(slug?: string): boolean {
  return !!slug && /-\d{6,}$/.test(slug);
}

async function main() {
  console.log('🔗 Mapping Eventbrite-imported events to Programs');
  console.log('='.repeat(70));
  console.log(`Dry run: ${DRY_RUN ? 'yes' : 'no'}\n`);

  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  console.log('1. Fetching programs...');
  const programs = await fetchAllPrograms();
  console.log(`   Found ${programs.length} programs\n`);

  console.log('2. Fetching all events...');
  const allEvents = await fetchAllEvents();
  console.log(`   Found ${allEvents.length} events\n`);

  const trainingEvents: TrainingEvent[] = allEvents
    .filter((e) => e.title && e.programId)
    .map((e) => ({ title: e.title!, programId: e.programId! }));
  console.log(`3. Built training set from ${trainingEvents.length} already-classified events\n`);

  const index = buildProgramIndex(programs, trainingEvents);

  const targets = allEvents.filter((e) => isEventbriteImported(e.slug) && e.title && !e.programId);
  console.log(`4. Matching ${targets.length} unmapped Eventbrite-imported events...\n`);

  const stats = { matched: 0, unmatched: 0, errors: 0 };
  const unmatchedTitles: string[] = [];

  for (const event of targets) {
    const match = matchProgram(event.title!, index);
    if (!match) {
      console.log(`   ❓ "${event.title}" -> no confident match`);
      unmatchedTitles.push(event.title!);
      stats.unmatched++;
      continue;
    }

    console.log(
      `   → "${event.title}" -> "${match.programTitle}" (${match.confidence}${match.score ? `, score=${match.score}` : ''})`
    );

    if (DRY_RUN) {
      stats.matched++;
      continue;
    }

    try {
      const updateRes = await cf(
        `/entries/${event.id}`,
        'PUT',
        { fields: { ...event.fields, program: { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: match.programId } } } } },
        { 'X-Contentful-Version': String(event.version) }
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`update failed: ${updateRes.status} ${text.slice(0, 300)}`);
      }
      const updated = await updateRes.json();

      const publishRes = await cf(`/entries/${event.id}/published`, 'PUT', undefined, {
        'X-Contentful-Version': String(updated.sys.version),
      });
      if (!publishRes.ok) {
        const text = await publishRes.text();
        throw new Error(`publish failed: ${publishRes.status} ${text.slice(0, 300)}`);
      }

      console.log('     ✅ Updated + published');
      stats.matched++;
    } catch (error) {
      console.error(`     ❌ Error: ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }

    await sleep(200);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Done!\n');
  console.log('📊 Summary:');
  console.log(`   Matched: ${stats.matched}`);
  console.log(`   Unmatched: ${stats.unmatched}`);
  console.log(`   Errors: ${stats.errors}`);
  if (unmatchedTitles.length) {
    console.log('\nUnmatched titles (left for manual review):');
    unmatchedTitles.forEach((t) => console.log(`   - ${t}`));
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
