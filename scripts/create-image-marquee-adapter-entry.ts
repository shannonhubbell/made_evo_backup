#!/usr/bin/env tsx
/**
 * Creates (and publishes) the "Data Adapter: Image Marquee from Organizations"
 * entry in Contentful, so content editors can select it when building a
 * ContentView. Mirrors the naming convention of every other Data Adapter entry.
 *
 * Safe to re-run: skips creation if an entry with this name already exists.
 *
 * Usage:
 *   tsx scripts/create-image-marquee-adapter-entry.ts
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

const ADAPTER_NAME = 'Data Adapter: Image Marquee from Organizations';

async function cf(pathname: string, method: string, body?: any, extraHeaders?: Record<string, string>): Promise<Response> {
  return fetch(`${CONTENTFUL_API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  console.log('Checking for existing "Data Adapter: Image Marquee from Organizations" entry...');
  const existingRes = await cf(`/entries?content_type=dataAdapter&limit=200`, 'GET');
  const existingData = await existingRes.json();
  const existing = (existingData.items || []).find((i: any) => i.fields?.name?.['en-US'] === ADAPTER_NAME);

  if (existing) {
    console.log(`✓ Already exists: ${existing.sys.id}`);
    return;
  }

  console.log('Creating entry...');
  const createRes = await cf(
    '/entries',
    'POST',
    { fields: { name: { 'en-US': ADAPTER_NAME } } },
    { 'X-Contentful-Content-Type': 'dataAdapter' }
  );
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create entry: ${createRes.status} ${text}`);
  }
  const entry = await createRes.json();

  const publishRes = await cf(`/entries/${entry.sys.id}/published`, 'PUT', undefined, {
    'X-Contentful-Version': String(entry.sys.version),
  });
  if (!publishRes.ok) {
    const text = await publishRes.text();
    throw new Error(`Failed to publish entry: ${publishRes.status} ${text}`);
  }

  console.log(`✅ Created + published: ${entry.sys.id}`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
