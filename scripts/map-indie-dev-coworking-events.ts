#!/usr/bin/env tsx
/**
 * Maps all Contentful Event entries titled "Indie Game Developer Co-Working"
 * to the Program entry "Program: Indie Dev Workshop".
 *
 * Matches events by normalized title (case-insensitive, whitespace-collapsed exact
 * match), finds the target Program by its internal `name` (falls back to `title`),
 * and sets/updates the Event's `program` link field, then publishes the entry.
 *
 * Safe to re-run: events that already point at the correct program are skipped.
 *
 * Usage:
 *   tsx scripts/map-indie-dev-coworking-events.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

const EVENT_TITLE = 'Indie Game Developer Co-Working';
const PROGRAM_NAME = 'Program: Indie Dev Workshop';

const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
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

async function fetchAllEntries(contentType: string): Promise<any[]> {
  const items: any[] = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;
  while (skip < total) {
    const res = await cf(`/entries?content_type=${contentType}&limit=${limit}&skip=${skip}`, 'GET');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch ${contentType} entries: ${res.status} ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    total = data.total ?? 0;
    items.push(...(data.items || []));
    skip += limit;
  }
  return items;
}

async function main() {
  console.log('🔗 Mapping "Indie Game Developer Co-Working" events to "Program: Indie Dev Workshop"');
  console.log('='.repeat(70));
  console.log(`Dry run: ${DRY_RUN ? 'yes' : 'no'}\n`);

  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  console.log('1. Finding target Program...');
  const programs = await fetchAllEntries('program');
  const targetProgram = programs.find((p) => {
    const name = p.fields?.name?.['en-US'];
    const title = p.fields?.title?.['en-US'];
    return name === PROGRAM_NAME || normalize(title || '') === normalize(PROGRAM_NAME.replace(/^Program:\s*/, ''));
  });

  if (!targetProgram) {
    console.error(`❌ Could not find a Program entry matching "${PROGRAM_NAME}"`);
    console.error('   Available programs:');
    programs.forEach((p) => console.error(`     - ${p.fields?.name?.['en-US'] || p.fields?.title?.['en-US']}`));
    process.exit(1);
  }
  console.log(`   ✓ Found program: ${targetProgram.fields?.name?.['en-US']} (${targetProgram.sys.id})\n`);

  console.log('2. Finding matching Event entries...');
  const events = await fetchAllEntries('event');
  const matches = events.filter((e) => normalize(e.fields?.title?.['en-US'] || '') === normalize(EVENT_TITLE));
  console.log(`   Found ${matches.length} event(s) titled "${EVENT_TITLE}"\n`);

  if (matches.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('3. Updating events...\n');
  const stats = { updated: 0, alreadySet: 0, errors: 0 };

  for (const event of matches) {
    const title = event.fields?.title?.['en-US'];
    const dateOnly = String(event.fields?.startDate?.['en-US'] || '').slice(0, 10);
    const currentProgramId = event.fields?.program?.['en-US']?.sys?.id;

    if (currentProgramId === targetProgram.sys.id) {
      console.log(`   ⏭️  ${title} (${dateOnly}): already linked, skipping`);
      stats.alreadySet++;
      continue;
    }

    console.log(`   → ${title} (${dateOnly})`);
    if (DRY_RUN) {
      console.log(`     📝 Would set program -> ${targetProgram.fields?.name?.['en-US']}`);
      stats.updated++;
      continue;
    }

    try {
      const updateRes = await cf(
        `/entries/${event.sys.id}`,
        'PUT',
        {
          fields: {
            ...event.fields,
            program: { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: targetProgram.sys.id } } },
          },
        },
        { 'X-Contentful-Version': String(event.sys.version) }
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`update failed: ${updateRes.status} ${text.slice(0, 300)}`);
      }
      const updated = await updateRes.json();

      const publishRes = await cf(`/entries/${event.sys.id}/published`, 'PUT', undefined, {
        'X-Contentful-Version': String(updated.sys.version),
      });
      if (!publishRes.ok) {
        const text = await publishRes.text();
        throw new Error(`publish failed: ${publishRes.status} ${text.slice(0, 300)}`);
      }

      console.log('     ✅ Updated + published');
      stats.updated++;
    } catch (error) {
      console.error(`     ❌ Error: ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }

    await sleep(200);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Done!\n');
  console.log('📊 Summary:');
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Already set: ${stats.alreadySet}`);
  console.log(`   Errors: ${stats.errors}`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
