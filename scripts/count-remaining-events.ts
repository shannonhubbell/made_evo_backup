#!/usr/bin/env tsx
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

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY!;
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID!;
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN!;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;
const ORGANIZER_ID = '50631666963';

async function main() {
  let total = 0;
  let continuation: string | undefined;
  do {
    const url = new URL(`https://www.eventbriteapi.com/v3/organizers/${ORGANIZER_ID}/events/`);
    url.searchParams.set('status', 'live,started,ended,completed');
    if (continuation) url.searchParams.set('continuation', continuation);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${EVENTBRITE_API_KEY}` } });
    const data = await res.json();
    total += data.events?.length || 0;
    continuation = data.pagination?.has_more_items ? data.pagination?.continuation : undefined;
  } while (continuation);
  console.log('Total Eventbrite events:', total);

  const entriesRes = await fetch(`${BASE}/entries?content_type=event&limit=1`, {
    headers: { Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}` },
  });
  const entriesData = await entriesRes.json();
  console.log('Total Contentful event entries:', entriesData.total);
}

main();
