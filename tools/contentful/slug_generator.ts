#!/usr/bin/env tsx
/**
 * Contentful Slug Generator
 *
 * Fetches entries of a given content type, generates slugs from a source field,
 * and updates the slug field in Contentful.
 *
 * Usage:
 *   npx tsx tools/contentful/slug_generator.ts <contentType> <slugField> [sourceField]
 *
 * Arguments:
 *   contentType  - Content type ID (e.g. exhibit, member, event, post). Case-insensitive.
 *   slugField    - Field ID that stores the slug (e.g. slug).
 *   sourceField  - Field ID to use for generating the slug (e.g. title, name).
 *                  If omitted, uses the content type's display field.
 *
 * Examples:
 *   npx tsx tools/contentful/slug_generator.ts exhibit slug title
 *   npx tsx tools/contentful/slug_generator.ts member slug displayName
 *   npx tsx tools/contentful/slug_generator.ts event slug
 *   npm run generate:contentful-slugs -- exhibit slug title
 *   (omit sourceField to use the content type display field)
 *
 * Environment:
 *   CONTENTFUL_SPACE_ID, CONTENTFUL_MANAGEMENT_TOKEN, CONTENTFUL_ENVIRONMENT (optional)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

function loadEnv(): Record<string, string> {
  const envPath = join(projectRoot, '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    return env;
  } catch {
    return process.env as Record<string, string>;
  }
}

const env = loadEnv();
const CONTENTFUL_SPACE_ID = env.CONTENTFUL_SPACE_ID || '';
const CONTENTFUL_MANAGEMENT_TOKEN = env.CONTENTFUL_MANAGEMENT_TOKEN || '';
const CONTENTFUL_ENVIRONMENT = env.CONTENTFUL_ENVIRONMENT || 'master';

const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

interface ContentTypeResponse {
  sys: { id: string };
  name: string;
  displayField: string;
  fields: Array<{ id: string; name: string; type: string }>;
}

interface EntryResponse {
  sys: { id: string; version: number; contentType: { sys: { id: string } } };
  fields: Record<string, Record<string, unknown>>;
}

/**
 * Normalize display name to Contentful API content type ID (camelCase).
 * Exhibit -> exhibit, ContentView -> contentView, member -> member.
 */
function toContentTypeId(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('-') || trimmed.includes('_')) {
    const parts = trimmed.toLowerCase().split(/[-_\s]+/);
    return parts.map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))).join('');
  }
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/**
 * Generate a URL-safe slug from a string.
 */
function slugify(text: string): string {
  if (typeof text !== 'string' || !text.trim()) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getContentType(contentTypeId: string): Promise<ContentTypeResponse> {
  const url = `${CONTENTFUL_API_BASE}/content_types/${contentTypeId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch content type "${contentTypeId}": ${response.status}\n${body}`);
  }
  return response.json();
}

async function getDefaultLocale(): Promise<string> {
  const url = `${CONTENTFUL_API_BASE}/locales`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch locales: ${response.status}\n${body}`);
  }
  const data = await response.json();
  const defaultLocale = (data.items || []).find((l: { default: boolean }) => l.default);
  return defaultLocale?.code ?? 'en-US';
}

async function getEntries(contentTypeId: string): Promise<EntryResponse[]> {
  const entries: EntryResponse[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const url = `${CONTENTFUL_API_BASE}/entries?content_type=${contentTypeId}&limit=${limit}&skip=${skip}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch entries: ${response.status}\n${body}`);
    }
    const data = await response.json();
    const items = data.items || [];
    entries.push(...items);
    const total = data.total ?? 0;
    skip += limit;
    if (skip >= total) break;
  }

  return entries;
}

async function getEntry(entryId: string): Promise<EntryResponse> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch entry: ${response.status}\n${body}`);
  }
  return response.json();
}

function getFieldValue(entry: EntryResponse, fieldId: string, locale: string): string | undefined {
  const field = entry.fields[fieldId];
  if (!field || typeof field !== 'object') return undefined;
  const value = (field as Record<string, unknown>)[locale];
  if (typeof value === 'string') return value;
  return undefined;
}

async function updateEntry(
  entryId: string,
  version: number,
  fieldsPatch: Record<string, Record<string, string>>
): Promise<void> {
  const current = await getEntry(entryId);
  const fields: Record<string, Record<string, unknown>> = {};

  for (const [fieldId, fieldValues] of Object.entries(current.fields)) {
    fields[fieldId] = { ...fieldValues } as Record<string, unknown>;
  }

  for (const [fieldId, localeValues] of Object.entries(fieldsPatch)) {
    if (!fields[fieldId]) fields[fieldId] = {};
    Object.assign(fields[fieldId], localeValues);
  }

  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': current.sys.version.toString(),
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to update entry: ${response.status}\n${body}`);
  }
}

async function publishEntry(entryId: string, version: number): Promise<void> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}/published`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': version.toString(),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to publish entry: ${response.status}\n${body}`);
  }
}

function printUsage(): void {
  console.log(`
Contentful Slug Generator

Usage:
  npx tsx tools/contentful/slug_generator.ts <contentType> <slugField> [sourceField]

Arguments:
  contentType  Content type ID (e.g. exhibit, member, event, post). Case-insensitive.
  slugField    Field ID that stores the slug (e.g. slug).
  sourceField  Field ID to use for generating the slug (e.g. title, name).
               If omitted, uses the content type's display field.

Examples:
  npx tsx tools/contentful/slug_generator.ts exhibit slug title
  npx tsx tools/contentful/slug_generator.ts member slug displayName
  npx tsx tools/contentful/slug_generator.ts event slug

Environment:
  CONTENTFUL_SPACE_ID, CONTENTFUL_MANAGEMENT_TOKEN
  CONTENTFUL_ENVIRONMENT (optional, default: master)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const [contentTypeArg, slugField, sourceFieldArg] = args;
  const contentTypeId = toContentTypeId(contentTypeArg);

  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_MANAGEMENT_TOKEN. Set them in .env or the environment.');
    process.exit(1);
  }

  console.log('Contentful Slug Generator\n');
  console.log(`Content type: ${contentTypeId}`);
  console.log(`Slug field:  ${slugField}`);
  console.log(`Source field: ${sourceFieldArg === undefined ? '(display field)' : sourceFieldArg}\n`);

  const contentType = await getContentType(contentTypeId);
  const displayField = contentType.displayField || 'name';
  const sourceField = (sourceFieldArg && sourceFieldArg.trim()) || displayField;

  const fieldIds = contentType.fields.map((f) => f.id);
  if (!fieldIds.includes(slugField)) {
    console.error(`Slug field "${slugField}" not found on content type "${contentType.name}". Available: ${fieldIds.join(', ')}`);
    process.exit(1);
  }
  if (!fieldIds.includes(sourceField)) {
    console.error(`Source field "${sourceField}" not found on content type "${contentType.name}". Available: ${fieldIds.join(', ')}`);
    process.exit(1);
  }

  const defaultLocale = await getDefaultLocale();
  console.log(`Default locale: ${defaultLocale}\n`);

  const entries = await getEntries(contentTypeId);
  console.log(`Found ${entries.length} entries.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const entryId = entry.sys.id;
    const sourceValue = getFieldValue(entry, sourceField, defaultLocale);
    const displayName = sourceValue ?? getFieldValue(entry, displayField, defaultLocale) ?? entryId;

    if (!sourceValue && sourceField !== displayField) {
      console.log(`  Skip ${entryId}: no value for "${sourceField}"`);
      skipped++;
      continue;
    }

    const newSlug = slugify(displayName);
    if (!newSlug) {
      console.log(`  Skip ${entryId}: could not generate slug from "${displayName}"`);
      skipped++;
      continue;
    }

    const currentSlug = getFieldValue(entry, slugField, defaultLocale);
    if (currentSlug === newSlug) {
      console.log(`  Skip ${entryId}: slug already "${newSlug}"`);
      skipped++;
      continue;
    }

    try {
      await updateEntry(entryId, entry.sys.version, {
        [slugField]: { [defaultLocale]: newSlug },
      });
      const updatedEntry = await getEntry(entryId);
      await publishEntry(entryId, updatedEntry.sys.version);
      console.log(`  Updated ${entryId}: "${currentSlug ?? '(empty)'}" -> "${newSlug}"`);
      updated++;
    } catch (err) {
      console.error(`  Error ${entryId}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log('\nDone.');
  console.log(`Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
