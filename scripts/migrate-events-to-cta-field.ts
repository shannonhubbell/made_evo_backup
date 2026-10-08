#!/usr/bin/env tsx
/**
 * Migrates Eventbrite-imported Event entries from the old approach (a "Sign Up Here"
 * hyperlink embedded at the end of the rich text `content` field) to the new approach:
 * a proper linked `CallToAction` entry via the Event's `callToAction` field.
 *
 * For each Event entry whose slug encodes an Eventbrite ID (format:
 * `{slugified-title}-{eventbriteId}`):
 *   1. Skips it if it already has a `callToAction` link (safe to re-run).
 *   2. Looks up the Eventbrite event to get its URL.
 *   3. Creates + publishes a CallToAction entry ("Sign Up Here" -> Eventbrite URL).
 *   4. Links it via the Event's `callToAction` field.
 *   5. Strips a trailing hyperlink-only paragraph from `content` if present (the old
 *      embedded CTA), so it isn't duplicated with the new button.
 *
 * Usage:
 *   tsx scripts/migrate-events-to-cta-field.ts [--dry-run]
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

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY || '';
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID || '';
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN || '';
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;
const ORGANIZER_ID = '50631666963';

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

async function fetchEventbriteUrlMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let continuation: string | undefined;
  const headers = { Authorization: `Bearer ${EVENTBRITE_API_KEY}` };
  do {
    const url = new URL(`https://www.eventbriteapi.com/v3/organizers/${ORGANIZER_ID}/events/`);
    url.searchParams.set('status', 'live,started,ended,completed');
    if (continuation) url.searchParams.set('continuation', continuation);
    const res = await fetch(url.toString(), { headers });
    const data = await res.json();
    for (const e of data.events || []) map.set(e.id, e.url);
    continuation = data.pagination?.has_more_items ? data.pagination?.continuation : undefined;
  } while (continuation);
  return map;
}

/** Removes a trailing paragraph whose only content is a hyperlink (the old embedded CTA). */
function stripTrailingHyperlinkParagraph(content: any): { content: any; stripped: boolean } {
  const nodes: any[] = content?.content || [];
  if (nodes.length === 0) return { content, stripped: false };
  const last = nodes[nodes.length - 1];
  const isHyperlinkOnly =
    last?.nodeType === 'paragraph' &&
    last.content?.length === 1 &&
    last.content[0]?.nodeType === 'hyperlink';
  if (!isHyperlinkOnly) return { content, stripped: false };
  return { content: { ...content, content: nodes.slice(0, -1) }, stripped: true };
}

async function createCallToActionEntry(label: string, url: string, internalName: string): Promise<{ id: string; version: number } | null> {
  try {
    const createRes = await cf(
      '/entries',
      'POST',
      { fields: { name: { 'en-US': internalName }, title: { 'en-US': label }, url: { 'en-US': url } } },
      { 'X-Contentful-Content-Type': 'callToAction' }
    );
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`create callToAction failed: ${createRes.status} ${text.slice(0, 300)}`);
    }
    const entry = await createRes.json();
    const pubRes = await cf(`/entries/${entry.sys.id}/published`, 'PUT', undefined, {
      'X-Contentful-Version': String(entry.sys.version),
    });
    if (!pubRes.ok) {
      const text = await pubRes.text();
      throw new Error(`publish callToAction failed: ${pubRes.status} ${text.slice(0, 300)}`);
    }
    const published = await pubRes.json();
    return { id: entry.sys.id, version: published.sys.version };
  } catch (error) {
    console.warn(`     ⚠️  Call to action creation failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  console.log('🔄 Migrating Eventbrite-imported events to use the CallToAction field');
  console.log('='.repeat(70));
  console.log(`Dry run: ${DRY_RUN ? 'yes' : 'no'}\n`);

  if (!EVENTBRITE_API_KEY || !CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Missing required env vars');
    process.exit(1);
  }

  console.log('1. Fetching Eventbrite event URLs...');
  const urlMap = await fetchEventbriteUrlMap();
  console.log(`   Got ${urlMap.size} event URLs\n`);

  console.log('2. Fetching Contentful event entries...');
  let skip = 0;
  const limit = 100;
  let total = Infinity;
  const entries: any[] = [];
  while (skip < total) {
    const res = await cf(`/entries?content_type=event&limit=${limit}&skip=${skip}`, 'GET');
    const data = await res.json();
    total = data.total ?? 0;
    entries.push(...(data.items || []));
    skip += limit;
  }
  console.log(`   Found ${entries.length} entries\n`);

  console.log('3. Migrating...\n');
  const stats = { migrated: 0, skippedNoMatch: 0, skippedHasCta: 0, errors: 0 };

  for (const entry of entries) {
    const slug: string | undefined = entry.fields?.slug?.['en-US'];
    if (!slug) continue;

    const idMatch = slug.match(/-(\d{6,})$/);
    if (!idMatch) {
      stats.skippedNoMatch++;
      continue;
    }
    const eventbriteId = idMatch[1];
    const eventbriteUrl = urlMap.get(eventbriteId);
    if (!eventbriteUrl) {
      stats.skippedNoMatch++;
      continue;
    }

    const title = entry.fields?.title?.['en-US'] || slug;

    if (entry.fields?.callToAction?.['en-US']?.sys?.id) {
      console.log(`   ⏭️  ${title}: already has a callToAction link, skipping`);
      stats.skippedHasCta++;
      continue;
    }

    console.log(`   → ${title}`);
    if (DRY_RUN) {
      console.log(`     📝 Would create CallToAction ("Sign Up Here" -> ${eventbriteUrl}) and link it`);
      stats.migrated++;
      continue;
    }

    try {
      const dateOnly = String(entry.fields?.startDate?.['en-US'] || '').slice(0, 10);
      const cta = await createCallToActionEntry('Sign Up Here', eventbriteUrl, `CTA: ${title} (${dateOnly})`);
      if (!cta) {
        stats.errors++;
        continue;
      }

      const existingContent = entry.fields?.content?.['en-US'];
      const { content: newContent, stripped } = existingContent
        ? stripTrailingHyperlinkParagraph(existingContent)
        : { content: existingContent, stripped: false };

      const updatedFields = {
        ...entry.fields,
        callToAction: { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: cta.id } } },
      };
      if (existingContent) {
        updatedFields.content = { 'en-US': newContent };
      }

      const updateRes = await cf(`/entries/${entry.sys.id}`, 'PUT', { fields: updatedFields }, {
        'X-Contentful-Version': String(entry.sys.version),
      });
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`update failed: ${updateRes.status} ${text.slice(0, 300)}`);
      }
      const updated = await updateRes.json();

      const publishRes = await cf(`/entries/${entry.sys.id}/published`, 'PUT', undefined, {
        'X-Contentful-Version': String(updated.sys.version),
      });
      if (!publishRes.ok) {
        const text = await publishRes.text();
        throw new Error(`publish failed: ${publishRes.status} ${text.slice(0, 300)}`);
      }

      console.log(`     ✅ Linked CallToAction${stripped ? ' + removed old embedded link' : ''}`);
      stats.migrated++;
    } catch (error) {
      console.error(`     ❌ Error: ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }

    await sleep(200);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Done!\n');
  console.log('📊 Summary:');
  console.log(`   Migrated: ${stats.migrated}`);
  console.log(`   Skipped (no Eventbrite match): ${stats.skippedNoMatch}`);
  console.log(`   Skipped (already has CTA field): ${stats.skippedHasCta}`);
  console.log(`   Errors: ${stats.errors}`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
