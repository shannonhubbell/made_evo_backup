#!/usr/bin/env tsx
/**
 * Push People Data to Contentful
 *
 * Reads scratch/donors.json - a one-off export of the old site's Kickstarter backer and
 * donor lists (`donors.kickstarters` / `donors.donors`, each a plain array of name
 * strings) - and creates/updates matching Member entries in Contentful under the
 * "Kickstarter" / "Donor" category.
 *
 * Each name is a bare string with no role/description/email, so entries are matched to
 * existing Contentful Members by `displayName` (`Member: <name>`), the same convention
 * used elsewhere in this pipeline to resolve Members by name rather than a hardcoded
 * entry ID.
 *
 * Some names appear in BOTH the kickstarters and donors lists (e.g. someone backed the
 * original Kickstarter and later donated again). Since a Member entry has a single
 * `category` field, it can't hold both at once - rather than silently letting whichever
 * list is processed second overwrite the category, this script excludes those names from
 * the automatic push and reports them separately so a human can decide.
 *
 * Usage:
 *   tsx scripts/push-people-to-contentful.ts [--dry-run] [--file=scratch/donors.json]
 *
 * --dry-run prints the full report (new / already-exists / within-list duplicates /
 * cross-list overlaps) without creating, updating, or publishing anything in Contentful.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
function loadEnv() {
  const envPath = join(projectRoot, '.env');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    return env;
  } catch (error) {
    return process.env as Record<string, string>;
  }
}

const env = loadEnv();
const CONTENTFUL_SPACE_ID = env.CONTENTFUL_SPACE_ID || '';
const CONTENTFUL_MANAGEMENT_TOKEN = env.CONTENTFUL_MANAGEMENT_TOKEN || '';
const CONTENTFUL_ENVIRONMENT = env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getArg(name: string, defaultValue: string): string {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}

const DONORS_DATA_FILE = join(projectRoot, getArg('file', 'scratch/donors.json'));

type Category = 'Kickstarter' | 'Donor';

// ---------------------------------------------------------------------------
// Name utilities
// ---------------------------------------------------------------------------

/** Parse a full name into firstName and lastName. */
function parseName(fullName: string): { firstName: string; lastName?: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p);

  if (parts.length === 0) {
    return { firstName: trimmed };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/** Case/whitespace-insensitive key used to compare names for de-duplication. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function displayNameFor(name: string): string {
  return `Member: ${name.trim()}`;
}

/**
 * Collapses exact (case/whitespace-insensitive) duplicate names within a single list,
 * keeping the first-seen casing. Returns the deduplicated list plus every name that
 * occurred more than once (with its occurrence count), for reporting.
 */
function dedupeNames(names: string[]): { unique: string[]; duplicates: Array<{ name: string; count: number }> } {
  const firstSeen = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeName(name);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!firstSeen.has(key)) firstSeen.set(key, name);
  }

  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ name: firstSeen.get(key)!, count }));

  return { unique: Array.from(firstSeen.values()), duplicates };
}

/** Names present in both lists (case/whitespace-insensitive), original casing from `a`. */
function findOverlap(a: string[], b: string[]): string[] {
  const bKeys = new Set(b.map(normalizeName));
  const seen = new Set<string>();
  const overlap: string[] = [];
  for (const name of a) {
    const key = normalizeName(name);
    if (bKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      overlap.push(name);
    }
  }
  return overlap;
}

// ---------------------------------------------------------------------------
// Contentful Member schema
// ---------------------------------------------------------------------------

interface MemberFields {
  firstName: string;
  lastName?: string;
  displayName: string;
  category: Category;
  role: string;
}

function mapToMemberFields(name: string, category: Category): MemberFields {
  const { firstName, lastName } = parseName(name);
  return {
    firstName,
    lastName,
    displayName: displayNameFor(name),
    category,
    role: 'Member',
  };
}

/** Get existing Member entries from Contentful, keyed by lowercased/trimmed displayName. */
async function getExistingMembers(): Promise<Map<string, { id: string; version: number }>> {
  const members = new Map<string, { id: string; version: number }>();

  try {
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${CONTENTFUL_API_BASE}/entries?content_type=member&limit=${limit}&skip=${skip}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Contentful API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      for (const item of data.items || []) {
        const displayName = item.fields?.displayName?.['en-US'] || '';
        if (displayName) {
          members.set(displayName.toLowerCase().trim(), {
            id: item.sys.id,
            version: item.sys.version,
          });
        }
      }

      const total = data.total || 0;
      skip += limit;
      hasMore = skip < total;
    }
  } catch (error) {
    console.warn(`⚠️  Failed to fetch existing members: ${error instanceof Error ? error.message : error}`);
  }

  return members;
}

/** Create a new Member entry in Contentful. */
async function createMember(member: MemberFields): Promise<{ id: string; version: number }> {
  const url = `${CONTENTFUL_API_BASE}/entries`;

  const fields: Record<string, Record<string, any>> = {
    firstName: { 'en-US': member.firstName },
    displayName: { 'en-US': member.displayName },
    category: { 'en-US': member.category },
    role: { 'en-US': member.role },
  };
  if (member.lastName) {
    fields.lastName = { 'en-US': member.lastName };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Content-Type': 'member',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create member: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return { id: data.sys.id, version: data.sys.version };
}

/** Update an existing Member entry in Contentful. */
async function updateMember(
  entryId: string,
  currentVersion: number,
  member: MemberFields
): Promise<{ id: string; version: number }> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}`;

  const fields: Record<string, Record<string, any>> = {
    firstName: { 'en-US': member.firstName },
    displayName: { 'en-US': member.displayName },
    category: { 'en-US': member.category },
    role: { 'en-US': member.role },
  };
  if (member.lastName) {
    fields.lastName = { 'en-US': member.lastName };
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': currentVersion.toString(),
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update member: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return { id: data.sys.id, version: data.sys.version };
}

/** Publish an entry in Contentful. */
async function publishEntry(entryId: string, version: number): Promise<void> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}/published`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': version.toString(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to publish entry: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface Plan {
  name: string;
  category: Category;
  status: 'new' | 'existing';
}

function buildPlan(names: string[], category: Category, existingMembers: Map<string, { id: string; version: number }>): Plan[] {
  return names.map((name) => {
    const key = displayNameFor(name).toLowerCase().trim();
    return { name, category, status: existingMembers.has(key) ? 'existing' : 'new' };
  });
}

function printSectionReport(label: string, rawCount: number, dedup: ReturnType<typeof dedupeNames>, plan: Plan[]) {
  const newOnes = plan.filter((p) => p.status === 'new');
  const existingOnes = plan.filter((p) => p.status === 'existing');

  console.log(`   ${label}: ${rawCount} raw entries, ${dedup.unique.length} unique`);
  console.log(`     New (will create):      ${newOnes.length}`);
  console.log(`     Already in Contentful:  ${existingOnes.length}`);

  if (dedup.duplicates.length > 0) {
    console.log(`     ⚠️  Repeated within this list (${dedup.duplicates.length}):`);
    for (const { name, count } of dedup.duplicates) {
      console.log(`        - "${name}" (x${count})`);
    }
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('📤 Pushing People Data to Contentful\n');
  console.log('='.repeat(60));
  console.log(`Source: ${DONORS_DATA_FILE}`);
  console.log(`Dry run: ${DRY_RUN ? 'yes (report only, no writes)' : 'no'}\n`);

  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Error: Contentful credentials not found');
    console.error('   Please set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  console.log('1. Loading donor data...');
  if (!existsSync(DONORS_DATA_FILE)) {
    console.error(`❌ Error: Data file not found: ${DONORS_DATA_FILE}`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(DONORS_DATA_FILE, 'utf-8'));
  const kickstartersRaw: string[] = raw.donors?.kickstarters || [];
  const donorsRaw: string[] = raw.donors?.donors || [];
  console.log(`✓ Loaded ${kickstartersRaw.length} kickstarters, ${donorsRaw.length} donors\n`);

  console.log('2. Fetching existing members from Contentful...');
  const existingMembers = await getExistingMembers();
  console.log(`✓ Found ${existingMembers.size} existing member(s)\n`);

  // Dedupe within each list first
  const kickstarters = dedupeNames(kickstartersRaw);
  const donorsDedup = dedupeNames(donorsRaw);

  // Names in both lists can't be pushed automatically - a Member has one `category`,
  // so which list "wins" would otherwise depend silently on processing order. Hold
  // these out and report them for a human decision instead.
  const overlap = findOverlap(kickstarters.unique, donorsDedup.unique);
  const overlapKeys = new Set(overlap.map(normalizeName));
  const kickstartersToProcess = kickstarters.unique.filter((n) => !overlapKeys.has(normalizeName(n)));
  const donorsToProcess = donorsDedup.unique.filter((n) => !overlapKeys.has(normalizeName(n)));

  const kickstarterPlan = buildPlan(kickstartersToProcess, 'Kickstarter', existingMembers);
  const donorPlan = buildPlan(donorsToProcess, 'Donor', existingMembers);

  console.log('3. Report\n');
  printSectionReport('Kickstarters', kickstartersRaw.length, kickstarters, kickstarterPlan);
  printSectionReport('Donors', donorsRaw.length, donorsDedup, donorPlan);

  if (overlap.length > 0) {
    console.log(`   ⚠️  Appears in BOTH lists (${overlap.length}) - excluded from this run, needs a manual category decision:`);
    for (const name of overlap) {
      const key = displayNameFor(name).toLowerCase().trim();
      const existsAlready = existingMembers.has(key) ? 'already in Contentful' : 'not yet in Contentful';
      console.log(`     - "${name}" (${existsAlready})`);
    }
    console.log();
  }

  const plan = [...kickstarterPlan, ...donorPlan];
  const totalNew = plan.filter((p) => p.status === 'new').length;
  const totalExisting = plan.filter((p) => p.status === 'existing').length;
  console.log(
    `   Totals (excluding cross-list overlaps): ${totalNew} new, ${totalExisting} already exist, ${overlap.length} held out for manual review\n`
  );

  if (DRY_RUN) {
    console.log('='.repeat(60));
    console.log('✅ Dry run complete - no changes were made.\n');
    return;
  }

  console.log('4. Pushing to Contentful...\n');
  const stats = { created: 0, updated: 0, errors: 0 };

  for (const person of plan) {
    try {
      const member = mapToMemberFields(person.name, person.category);
      const key = member.displayName.toLowerCase().trim();
      const existing = existingMembers.get(key);

      if (existing) {
        console.log(`   Updating: ${member.displayName} (${member.category})`);
        const result = await updateMember(existing.id, existing.version, member);
        await publishEntry(result.id, result.version);
        stats.updated++;
      } else {
        console.log(`   Creating: ${member.displayName} (${member.category})`);
        const result = await createMember(member);
        await publishEntry(result.id, result.version);
        stats.created++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing "${person.name}": ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Processing complete!\n');
  console.log('📊 Summary:');
  console.log(`   Created: ${stats.created}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Errors:  ${stats.errors}`);
  console.log(`   Held out for manual review (in both lists): ${overlap.length}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

export { parseName, normalizeName, dedupeNames, findOverlap, mapToMemberFields, createMember, updateMember };
