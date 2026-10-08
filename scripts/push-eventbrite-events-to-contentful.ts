#!/usr/bin/env tsx
/**
 * Push Eventbrite Events to Contentful
 *
 * Fetches events for the MADE's Eventbrite organizer (50631666963), maps them onto
 * the Contentful "event" content type, and creates+publishes new entries (and,
 * optionally, image assets pulled from the Eventbrite event logo).
 *
 * Pulls every event on the organizer's Eventbrite account regardless of status - live,
 * started, ended, and completed (i.e. the full history, not just what's upcoming) - and
 * processes upcoming events first (soonest first), then past/completed events (most
 * recent first). Already-imported events (matched by normalized title + date) are
 * skipped. Pass --limit=N to cap how many new entries are created in a single run
 * (e.g. for a controlled first backfill); by default there's no cap.
 *
 * Every run also re-checks previously-imported events: each event's Contentful `slug`
 * has the Eventbrite event id embedded in it (see the `slug` assignment in main()), so we
 * can look the live event back up on Eventbrite and compare its current `url` against the
 * linked CallToAction entry's stored url. Eventbrite event URLs can change after the fact
 * (e.g. the organizer renames the event), which otherwise leaves a broken "Sign Up Here"
 * link on the site with no way to notice or fix it. Pass --no-link-check to skip this.
 *
 * If a previously-imported event is obviously sourced from Eventbrite (either its slug has
 * an embedded Eventbrite event id, or its linked CallToAction points at eventbrite.com) but
 * no longer has a matching live Eventbrite event (deleted/canceled, not just renamed), it's
 * reported as "orphaned". By default orphaned entries are only reported, never touched; pass
 * --prune-orphaned to actually unpublish + delete the orphaned event (and its CallToAction).
 * --dry-run still applies: --dry-run --prune-orphaned reports what would be removed only.
 * Orphans older than a year are always kept regardless of --prune-orphaned, since Eventbrite
 * can drop very old events off the organizer events API without the museum ever deleting them.
 *
 * Usage:
 *   tsx scripts/push-eventbrite-events-to-contentful.ts [--limit=N] [--no-images] [--dry-run] [--no-link-check] [--prune-orphaned]
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  buildProgramIndex,
  matchProgram,
  type ProgramInfo,
  type TrainingEvent,
} from "./lib/program-matcher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    console.log("⚠️  Could not read .env file, using process.env directly");
  }
}

loadEnvFile();

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY || "";
const EVENTBRITE_ORGANIZATION_ID = process.env.EVENTBRITE_ORGANIZATION_ID || "";
const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID || "";
const CONTENTFUL_MANAGEMENT_TOKEN =
  process.env.CONTENTFUL_MANAGEMENT_TOKEN || "";
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function getArg(name: string, defaultValue?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return defaultValue;
}
// No cap by default - pull and process every event (including past/completed ones).
// Pass --limit=N to cap how many new entries get created in a single run.
const limitArg = getArg("limit");
const LIMIT = limitArg !== undefined ? parseInt(limitArg, 10) : Infinity;
const INCLUDE_IMAGES = !args.includes("--no-images");
const DRY_RUN = args.includes("--dry-run");
const CHECK_LINKS = !args.includes("--no-link-check");
const PRUNE_ORPHANED = args.includes("--prune-orphaned");

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeTitle(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Extracts the trailing Eventbrite numeric event id that this script appends to every
 * slug it creates (see `const slug = `${slugify(title)}-${ebEvent.id}`` in main()).
 * Returns null for slugs that weren't created by this script (no embedded id).
 */
function extractEventbriteIdFromSlug(slug: string): string | null {
  const match = slug.match(/-(\d{6,})$/);
  return match ? match[1] : null;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "39": "'",
  nbsp: " ",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  mdash: "\u2014",
  ndash: "\u2013",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#?\w+);/g, (match, ent: string) => {
    if (HTML_ENTITIES[ent] !== undefined) return HTML_ENTITIES[ent];
    if (ent.startsWith("#")) {
      const code = parseInt(ent.slice(1), 10);
      if (!isNaN(code)) return String.fromCodePoint(code);
    }
    return match;
  });
}

/** Converts simple Eventbrite description HTML into an array of plain-text paragraphs. */
function htmlToParagraphs(html: string): string[] {
  let s = html;
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "\u2022 ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 40);
}

/**
 * Builds a minimal valid Contentful rich text document from plain-text paragraphs.
 * The "Sign Up Here" call-to-action is a separate linked CallToAction entry (see
 * createCallToActionEntry), not embedded in this rich text.
 */
function paragraphsToRichText(paragraphs: string[]): any {
  const content = paragraphs.length
    ? paragraphs.map((text) => ({
        nodeType: "paragraph",
        data: {},
        content: [{ nodeType: "text", value: text, marks: [], data: {} }],
      }))
    : [
        {
          nodeType: "paragraph",
          data: {},
          content: [{ nodeType: "text", value: "", marks: [], data: {} }],
        },
      ];

  return {
    nodeType: "document",
    data: {},
    content,
  };
}

function truncate(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}\u2026`;
}

/** Combines an Eventbrite local wall-clock time + UTC time into a Contentful Date string with offset. */
function toContentfulDate(local: string, utc: string): string {
  const utcMs = Date.parse(utc);
  const naiveLocalMs = Date.parse(`${local}Z`);
  const offsetMin = Math.round((naiveLocalMs - utcMs) / 60000);
  const sign = offsetMin <= 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const localNoSeconds = local.slice(0, 16); // YYYY-MM-DDTHH:mm
  return `${localNoSeconds}${sign}${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Eventbrite API
// ---------------------------------------------------------------------------

interface EventbriteEvent {
  id: string;
  name: { text: string; html: string };
  summary: string;
  start: { local: string; utc: string; timezone: string };
  end: { local: string; utc: string; timezone: string };
  status: string;
  url: string;
  logo?: {
    original?: { url: string; width: number; height: number };
    url?: string;
  } | null;
}

const EB_HEADERS = { Authorization: `Bearer ${EVENTBRITE_API_KEY}` };

async function fetchAllEventbriteEvents(): Promise<EventbriteEvent[]> {
  // Deliberately queries the organization-scoped endpoint rather than the
  // organizer-scoped one (/v3/organizers/{id}/events/): Eventbrite ages
  // completed/past events out of the organizer endpoint's results (it only ever
  // returned "live" events for this account), while the organization endpoint
  // retains the full event history (verified: 368 "completed" + 234 "live" here,
  // vs. only the 234 "live" ones from the organizer endpoint).
  const all: EventbriteEvent[] = [];
  let continuation: string | undefined;
  do {
    const url = new URL(
      `https://www.eventbriteapi.com/v3/organizations/${EVENTBRITE_ORGANIZATION_ID}/events/`,
    );
    url.searchParams.set("status", "live,started,ended,completed");
    url.searchParams.set("order_by", "start_asc");
    url.searchParams.set("expand", "logo");
    if (continuation) url.searchParams.set("continuation", continuation);

    const res = await fetch(url.toString(), { headers: EB_HEADERS });
    if (!res.ok) {
      throw new Error(`Eventbrite API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    all.push(...(data.events || []));
    continuation = data.pagination?.has_more_items
      ? data.pagination?.continuation
      : undefined;
  } while (continuation);

  return all;
}

async function fetchEventbriteFullDescription(
  eventId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/${eventId}/description/`,
      {
        headers: EB_HEADERS,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.description || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contentful Management API
// ---------------------------------------------------------------------------

async function cf(
  pathname: string,
  method: string,
  body?: any,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const res = await fetch(`${CONTENTFUL_API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429) {
    const retryAfter = parseFloat(
      res.headers.get("x-contentful-ratelimit-reset") || "1",
    );
    console.log(`   ⏳ Rate limited, waiting ${retryAfter}s...`);
    await sleep((retryAfter || 1) * 1000);
    return cf(pathname, method, body, extraHeaders);
  }

  return res;
}

interface ExistingEventSignature {
  id: string;
  title: string;
  dateOnly: string;
  slug?: string;
  eventbriteId?: string | null;
  callToActionEntryId?: string | null;
}

async function getExistingEventSignatures(): Promise<ExistingEventSignature[]> {
  const signatures: ExistingEventSignature[] = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  while (skip < total) {
    const res = await cf(
      `/entries?content_type=event&limit=${limit}&skip=${skip}`,
      "GET",
    );
    if (!res.ok) {
      console.warn(
        `⚠️  Failed to fetch existing events: ${res.status} ${res.statusText}`,
      );
      break;
    }
    const data = await res.json();
    total = data.total ?? 0;
    for (const item of data.items || []) {
      const title = item.fields?.title?.["en-US"];
      const startDate = item.fields?.startDate?.["en-US"];
      const slug = item.fields?.slug?.["en-US"];
      const callToActionEntryId = item.fields?.callToAction?.["en-US"]?.sys?.id;
      if (title && startDate) {
        signatures.push({
          id: item.sys.id,
          title: normalizeTitle(title),
          dateOnly: String(startDate).slice(0, 10),
          slug,
          eventbriteId: slug ? extractEventbriteIdFromSlug(slug) : null,
          callToActionEntryId: callToActionEntryId || null,
        });
      }
    }
    skip += limit;
    await sleep(150);
  }

  return signatures;
}

async function fetchProgramsAndTrainingData(): Promise<{
  programs: ProgramInfo[];
  trainingEvents: TrainingEvent[];
}> {
  const programs: ProgramInfo[] = [];
  {
    let skip = 0;
    const limit = 100;
    let total = Infinity;
    while (skip < total) {
      const res = await cf(
        `/entries?content_type=program&limit=${limit}&skip=${skip}`,
        "GET",
      );
      if (!res.ok) break;
      const data = await res.json();
      total = data.total ?? 0;
      for (const item of data.items || []) {
        const title =
          item.fields?.title?.["en-US"] || item.fields?.name?.["en-US"];
        if (title) programs.push({ id: item.sys.id, title });
      }
      skip += limit;
    }
  }

  const trainingEvents: TrainingEvent[] = [];
  {
    let skip = 0;
    const limit = 100;
    let total = Infinity;
    while (skip < total) {
      const res = await cf(
        `/entries?content_type=event&limit=${limit}&skip=${skip}`,
        "GET",
      );
      if (!res.ok) break;
      const data = await res.json();
      total = data.total ?? 0;
      for (const item of data.items || []) {
        const title = item.fields?.title?.["en-US"];
        const programId = item.fields?.program?.["en-US"]?.sys?.id;
        if (title && programId) trainingEvents.push({ title, programId });
      }
      skip += limit;
    }
  }

  return { programs, trainingEvents };
}

async function createAssetFromUrl(
  title: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const createRes = await cf("/assets", "POST", {
      fields: {
        title: { "en-US": title },
        file: {
          "en-US": {
            contentType: "image/jpeg",
            fileName: `${slugify(title)}.jpg`,
            upload: imageUrl,
          },
        },
      },
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(
        `create asset failed: ${createRes.status} ${text.slice(0, 200)}`,
      );
    }
    const asset = await createRes.json();
    const assetId = asset.sys.id;
    let version = asset.sys.version;

    const processRes = await cf(
      `/assets/${assetId}/files/en-US/process`,
      "PUT",
      undefined,
      {
        "X-Contentful-Version": String(version),
      },
    );
    if (!processRes.ok) {
      const text = await processRes.text();
      throw new Error(
        `process asset failed: ${processRes.status} ${text.slice(0, 200)}`,
      );
    }

    let processedUrl: string | undefined;
    for (let i = 0; i < 10; i++) {
      await sleep(1200);
      const getRes = await cf(`/assets/${assetId}`, "GET");
      if (!getRes.ok) continue;
      const data = await getRes.json();
      version = data.sys.version;
      processedUrl = data.fields?.file?.["en-US"]?.url;
      if (processedUrl) break;
    }
    if (!processedUrl) {
      throw new Error("asset processing timed out");
    }

    const pubRes = await cf(`/assets/${assetId}/published`, "PUT", undefined, {
      "X-Contentful-Version": String(version),
    });
    if (!pubRes.ok) {
      const text = await pubRes.text();
      throw new Error(
        `publish asset failed: ${pubRes.status} ${text.slice(0, 200)}`,
      );
    }

    return assetId;
  } catch (error) {
    console.warn(
      `     \u26a0\ufe0f  Image asset failed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return null;
  }
}

/** Creates + publishes a CallToAction entry (e.g. a "Sign Up Here" button linking out to Eventbrite). */
async function createCallToActionEntry(
  label: string,
  url: string,
  internalName: string,
): Promise<string | null> {
  try {
    const createRes = await cf(
      "/entries",
      "POST",
      {
        fields: {
          name: { "en-US": internalName },
          title: { "en-US": label },
          url: { "en-US": url },
        },
      },
      { "X-Contentful-Content-Type": "callToAction" },
    );
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(
        `create callToAction failed: ${createRes.status} ${text.slice(0, 300)}`,
      );
    }
    const entry = await createRes.json();
    const pubRes = await cf(
      `/entries/${entry.sys.id}/published`,
      "PUT",
      undefined,
      { "X-Contentful-Version": String(entry.sys.version) },
    );
    if (!pubRes.ok) {
      const text = await pubRes.text();
      throw new Error(
        `publish callToAction failed: ${pubRes.status} ${text.slice(0, 300)}`,
      );
    }
    return entry.sys.id;
  } catch (error) {
    console.warn(
      `     \u26a0\ufe0f  Call to action failed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return null;
  }
}

interface EventFieldSet {
  name: string;
  title: string;
  startDate: string;
  endDate?: string;
  slug: string;
  description?: string;
  content?: any;
  imageAssetId?: string | null;
  callToActionEntryId?: string | null;
  programEntryId?: string | null;
}

async function createEventEntry(
  fields: EventFieldSet,
): Promise<{ id: string; version: number }> {
  const cfFields: Record<string, Record<string, any>> = {
    name: { "en-US": fields.name },
    title: { "en-US": fields.title },
    startDate: { "en-US": fields.startDate },
    slug: { "en-US": fields.slug },
  };
  if (fields.endDate) cfFields.endDate = { "en-US": fields.endDate };
  if (fields.description)
    cfFields.description = { "en-US": fields.description };
  if (fields.content) cfFields.content = { "en-US": fields.content };
  if (fields.imageAssetId) {
    cfFields.image = {
      "en-US": [
        { sys: { type: "Link", linkType: "Asset", id: fields.imageAssetId } },
      ],
    };
  }
  if (fields.callToActionEntryId) {
    cfFields.callToAction = {
      "en-US": {
        sys: {
          type: "Link",
          linkType: "Entry",
          id: fields.callToActionEntryId,
        },
      },
    };
  }
  if (fields.programEntryId) {
    cfFields.program = {
      "en-US": {
        sys: { type: "Link", linkType: "Entry", id: fields.programEntryId },
      },
    };
  }

  const res = await cf(
    "/entries",
    "POST",
    { fields: cfFields },
    { "X-Contentful-Content-Type": "event" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`create entry failed: ${res.status} ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return { id: data.sys.id, version: data.sys.version };
}

async function publishEntry(entryId: string, version: number): Promise<void> {
  const res = await cf(`/entries/${entryId}/published`, "PUT", undefined, {
    "X-Contentful-Version": String(version),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `publish entry failed: ${res.status} ${text.slice(0, 500)}`,
    );
  }
}

async function getEntryById(entryId: string): Promise<any | null> {
  const res = await cf(`/entries/${entryId}`, "GET");
  if (!res.ok) return null;
  return res.json();
}

/**
 * Updates a CallToAction entry's `url` field (if it differs from `newUrl`) and republishes
 * it. Used to repair "Sign Up Here" links after Eventbrite changes an event's URL. Returns
 * true if an update was made, false if the url was already current or the entry was
 * missing.
 */
async function updateCallToActionUrlIfChanged(
  entryId: string,
  newUrl: string,
): Promise<boolean> {
  const entry = await getEntryById(entryId);
  if (!entry) {
    console.warn(
      `     \u26a0\ufe0f  Could not load CallToAction entry ${entryId}`,
    );
    return false;
  }
  const currentUrl = entry.fields?.url?.["en-US"];
  if (currentUrl === newUrl) return false;

  const updatedFields = {
    ...entry.fields,
    url: { "en-US": newUrl },
  };
  const putRes = await cf(
    `/entries/${entryId}`,
    "PUT",
    { fields: updatedFields },
    { "X-Contentful-Version": String(entry.sys.version) },
  );
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(
      `update callToAction failed: ${putRes.status} ${text.slice(0, 300)}`,
    );
  }
  const updated = await putRes.json();
  await publishEntry(entryId, updated.sys.version);
  return true;
}

function isEventbriteCtaUrl(url: unknown): boolean {
  return typeof url === "string" && url.includes("eventbrite.com");
}

/**
 * True if an existing Contentful event entry was obviously produced by this script (or at
 * least clearly points at Eventbrite), based on structural signals only — never guesses
 * based on title/content, to avoid misclassifying manually-curated events as prunable.
 */
async function isObviouslyFromEventbrite(
  sig: ExistingEventSignature,
): Promise<boolean> {
  if (sig.eventbriteId) return true;
  if (!sig.callToActionEntryId) return false;
  const entry = await getEntryById(sig.callToActionEntryId);
  return isEventbriteCtaUrl(entry?.fields?.url?.["en-US"]);
}

/** Unpublishes (if published) and permanently deletes an entry. No-op if already gone. */
async function unpublishAndDeleteEntry(entryId: string): Promise<void> {
  const entry = await getEntryById(entryId);
  if (!entry) return;

  if (entry.sys.publishedVersion !== undefined) {
    const unpubRes = await cf(`/entries/${entryId}/published`, "DELETE");
    if (!unpubRes.ok && unpubRes.status !== 404) {
      const text = await unpubRes.text();
      throw new Error(
        `unpublish failed: ${unpubRes.status} ${text.slice(0, 300)}`,
      );
    }
  }

  const delRes = await cf(`/entries/${entryId}`, "DELETE");
  if (!delRes.ok && delRes.status !== 404) {
    const text = await delRes.text();
    throw new Error(`delete failed: ${delRes.status} ${text.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\ud83c\udf9f\ufe0f  Pushing Eventbrite Events to Contentful");
  console.log("=".repeat(70));
  console.log(
    `Limit: ${LIMIT === Infinity ? "none (all events)" : LIMIT} | Images: ${
      INCLUDE_IMAGES ? "on" : "off"
    } | Dry run: ${DRY_RUN ? "yes" : "no"}\n`,
  );

  if (!EVENTBRITE_API_KEY) {
    console.error("\u274c Missing EVENTBRITE_API_KEY in .env");
    process.exit(1);
  }
  if (!EVENTBRITE_ORGANIZATION_ID) {
    console.error("\u274c Missing EVENTBRITE_ORGANIZATION_ID in .env");
    process.exit(1);
  }
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error(
      "\u274c Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN in .env",
    );
    process.exit(1);
  }

  console.log("1. Fetching events from Eventbrite...");
  const allEvents = await fetchAllEventbriteEvents();
  console.log(
    `   Found ${allEvents.length} total events (all published statuses)\n`,
  );

  const now = Date.now();
  const upcoming = allEvents
    .filter((e) => new Date(e.start.utc).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.start.utc).getTime() - new Date(b.start.utc).getTime(),
    );
  const past = allEvents
    .filter((e) => new Date(e.start.utc).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(b.start.utc).getTime() - new Date(a.start.utc).getTime(),
    );

  console.log(`   Upcoming: ${upcoming.length} | Past: ${past.length}`);

  // Process upcoming events first (soonest first), then past/completed events (most
  // recent first). With no --limit, every event ends up in `prioritized`; --limit=N
  // caps it to just the first N in that order.
  const prioritized = [...upcoming, ...past].slice(0, LIMIT);
  console.log(
    `   Selected ${prioritized.length} event(s) for this run (soonest upcoming first, then most-recent past)\n`,
  );

  console.log("2. Fetching existing Contentful events (for de-duplication)...");
  const existingSignatures = await getExistingEventSignatures();
  console.log(`   Found ${existingSignatures.length} existing event entries\n`);

  console.log("3. Fetching programs (for program auto-mapping)...");
  const { programs, trainingEvents } = await fetchProgramsAndTrainingData();
  const programIndex = buildProgramIndex(programs, trainingEvents);
  console.log(
    `   Found ${programs.length} programs, trained on ${trainingEvents.length} already-classified events\n`,
  );

  const stats = {
    created: 0,
    skipped: 0,
    errors: 0,
    imagesAdded: 0,
    ctasAdded: 0,
    programsMatched: 0,
  };
  const createdSummaries: string[] = [];

  console.log("4. Processing events...\n");

  for (const ebEvent of prioritized) {
    const title = ebEvent.name.text;
    const dateOnly = ebEvent.start.local.slice(0, 10);
    const normTitle = normalizeTitle(title);

    console.log(`   \u2192 ${title} (${dateOnly})`);

    const duplicate = existingSignatures.find(
      (s) => s.title === normTitle && s.dateOnly === dateOnly,
    );
    if (duplicate) {
      console.log(
        `     \u23ed\ufe0f  Skipped: already exists as entry ${duplicate.id}`,
      );
      stats.skipped++;
      continue;
    }

    try {
      const startDate = toContentfulDate(
        ebEvent.start.local,
        ebEvent.start.utc,
      );
      const endDate = ebEvent.end
        ? toContentfulDate(ebEvent.end.local, ebEvent.end.utc)
        : undefined;
      const slug = `${slugify(title)}-${ebEvent.id}`;
      const name = `Event: ${title} (${dateOnly})`;
      const description = ebEvent.summary
        ? truncate(ebEvent.summary, 250)
        : undefined;

      const fullDescriptionHtml = await fetchEventbriteFullDescription(
        ebEvent.id,
      );
      const paragraphs = htmlToParagraphs(
        fullDescriptionHtml || ebEvent.summary || "",
      );
      const content = paragraphsToRichText(paragraphs);

      let imageAssetId: string | null = null;
      if (INCLUDE_IMAGES && ebEvent.logo?.original?.url && !DRY_RUN) {
        imageAssetId = await createAssetFromUrl(
          title,
          ebEvent.logo.original.url,
        );
        if (imageAssetId) stats.imagesAdded++;
      }

      if (DRY_RUN) {
        console.log(
          `     \ud83d\udcdd Would create: name="${name}" slug="${slug}" startDate=${startDate} cta="Sign Up Here" -> ${ebEvent.url}`,
        );
        stats.created++;
        continue;
      }

      const callToActionEntryId = await createCallToActionEntry(
        "Sign Up Here",
        ebEvent.url,
        `CTA: ${title} (${dateOnly})`,
      );
      if (callToActionEntryId) stats.ctasAdded++;

      const programMatch = matchProgram(title, programIndex);
      if (programMatch) {
        stats.programsMatched++;
        console.log(
          `     \ud83d\udd17 Matched program "${programMatch.programTitle}" (${programMatch.confidence})`,
        );
      }

      const entry = await createEventEntry({
        name,
        title,
        startDate,
        endDate,
        slug,
        description,
        content,
        imageAssetId,
        callToActionEntryId,
        programEntryId: programMatch?.programId ?? null,
      });
      await publishEntry(entry.id, entry.version);

      console.log(
        `     \u2705 Created + published entry ${entry.id}${
          imageAssetId ? " (with image)" : ""
        }`,
      );
      createdSummaries.push(`${title} \u2014 ${dateOnly} \u2014 ${entry.id}`);
      stats.created++;
    } catch (error) {
      console.error(
        `     \u274c Error: ${error instanceof Error ? error.message : error}`,
      );
      stats.errors++;
    }

    await sleep(200);
  }

  console.log("\n5. Checking existing events for changed Eventbrite links...");
  const linkStats = {
    checked: 0,
    updated: 0,
    skippedNoCta: 0,
    orphaned: 0,
    pruned: 0,
    keptOld: 0,
    errors: 0,
  };

  if (CHECK_LINKS) {
    const byEventbriteId = new Map<string, EventbriteEvent>();
    for (const ebEvent of allEvents) byEventbriteId.set(ebEvent.id, ebEvent);

    for (const sig of existingSignatures) {
      // Prefer the Eventbrite id embedded in the slug (stable even if the event is
      // renamed); fall back to the same title+date match used for de-duplication.
      let ebEvent = sig.eventbriteId
        ? byEventbriteId.get(sig.eventbriteId)
        : undefined;
      if (!ebEvent) {
        ebEvent = allEvents.find(
          (e) =>
            normalizeTitle(e.name.text) === sig.title &&
            e.start.local.slice(0, 10) === sig.dateOnly,
        );
      }

      if (!ebEvent) {
        // No live/ended/completed Eventbrite event matches this entry anymore. Only act on
        // entries that are obviously Eventbrite-sourced — anything else is left untouched,
        // since it's likely a manually-curated event this script had nothing to do with.
        let eventbriteSourced = false;
        try {
          eventbriteSourced = await isObviouslyFromEventbrite(sig);
        } catch (error) {
          console.error(
            `   \u274c Failed to check if "${sig.title}" is Eventbrite-sourced: ${
              error instanceof Error ? error.message : error
            }`,
          );
          linkStats.errors++;
          continue;
        }
        if (!eventbriteSourced) continue;

        linkStats.orphaned++;

        // Eventbrite events older than a year can drop off the organizer events API even
        // though the museum never deleted them (retention/pagination on Eventbrite's side,
        // not necessarily an organizer action) — so only prune orphans that are upcoming or
        // within the last year; anything older is left alone even if --prune-orphaned is set.
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const isOverAYearOld = new Date(sig.dateOnly) < oneYearAgo;
        if (isOverAYearOld) {
          linkStats.keptOld++;
          console.log(
            `   \ud83d\uddd1\ufe0f  Orphaned but kept: "${sig.title}" (${sig.dateOnly}) \u2014 over a year old, no longer on Eventbrite`,
          );
          continue;
        }

        console.log(
          `   \ud83d\uddd1\ufe0f  Orphaned: "${sig.title}" (${sig.dateOnly}) \u2014 entry ${sig.id} no longer found on Eventbrite`,
        );
        if (!PRUNE_ORPHANED) {
          console.log(
            "      \u2139\ufe0f  Re-run with --prune-orphaned to remove it",
          );
          continue;
        }
        if (DRY_RUN) {
          console.log(
            `      \ud83d\udcdd Would remove entry ${sig.id}${
              sig.callToActionEntryId ? ` + CTA ${sig.callToActionEntryId}` : ""
            }`,
          );
          linkStats.pruned++;
          continue;
        }
        try {
          await unpublishAndDeleteEntry(sig.id);
          if (sig.callToActionEntryId) {
            await unpublishAndDeleteEntry(sig.callToActionEntryId);
          }
          console.log(`      \u2705 Removed entry ${sig.id}`);
          linkStats.pruned++;
        } catch (error) {
          console.error(
            `      \u274c Failed to remove entry ${sig.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
          linkStats.errors++;
        }
        await sleep(150);
        continue;
      }

      if (!sig.callToActionEntryId) {
        linkStats.skippedNoCta++;
        continue;
      }

      linkStats.checked++;
      try {
        if (DRY_RUN) {
          const entry = await getEntryById(sig.callToActionEntryId);
          const currentUrl = entry?.fields?.url?.["en-US"];
          if (currentUrl && currentUrl !== ebEvent.url) {
            console.log(
              `   \ud83d\udd17 Would update link for "${sig.title}": ${currentUrl} -> ${ebEvent.url}`,
            );
            linkStats.updated++;
          }
        } else {
          const updated = await updateCallToActionUrlIfChanged(
            sig.callToActionEntryId,
            ebEvent.url,
          );
          if (updated) {
            console.log(
              `   \ud83d\udd27 Updated link for "${sig.title}" -> ${ebEvent.url}`,
            );
            linkStats.updated++;
          }
        }
      } catch (error) {
        console.error(
          `   \u274c Failed to update link for "${sig.title}": ${
            error instanceof Error ? error.message : error
          }`,
        );
        linkStats.errors++;
      }
      await sleep(150);
    }
  } else {
    console.log("   Skipped (--no-link-check)");
  }

  console.log("\n" + "=".repeat(70));
  console.log("\u2705 Done!\n");
  console.log("\ud83d\udcca Summary:");
  console.log(`   Created:  ${stats.created}`);
  console.log(`   Skipped (duplicate): ${stats.skipped}`);
  console.log(`   Images added: ${stats.imagesAdded}`);
  console.log(`   Call-to-actions added: ${stats.ctasAdded}`);
  console.log(`   Programs matched: ${stats.programsMatched}`);
  console.log(`   Errors:   ${stats.errors}`);
  console.log(`   Links checked: ${linkStats.checked}`);
  console.log(`   Links updated: ${linkStats.updated}`);
  console.log(`   Orphaned events found: ${linkStats.orphaned}`);
  console.log(`   Orphaned events kept (>1yr old): ${linkStats.keptOld}`);
  console.log(`   Orphaned events removed: ${linkStats.pruned}`);
  if (linkStats.errors) console.log(`   Link errors: ${linkStats.errors}`);
  if (createdSummaries.length) {
    console.log("\nCreated entries:");
    createdSummaries.forEach((s) => console.log(`   - ${s}`));
  }
}

main().catch((error) => {
  console.error("\n\u274c Fatal error:", error);
  process.exit(1);
});
