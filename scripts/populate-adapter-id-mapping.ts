#!/usr/bin/env tsx
/**
 * Verify Adapter Name Mapping
 *
 * Fetches DataAdapter entries from Contentful and checks that each name
 * exists in our nameToStableId mapping (defined by the adapter registry).
 * No file generation; we use Contentful names as the key for lookup.
 *
 * Usage:
 *   npm run populate:adapter-mapping
 *   or
 *   tsx scripts/populate-adapter-id-mapping.ts
 *
 * Environment Variables Required:
 *   - CONTENTFUL_SPACE_ID
 *   - CONTENTFUL_DELIVERY_TOKEN
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const lines = envContent.split("\n");
      for (const line of lines) {
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
    }
  } catch {
    console.log("⚠️  Could not read .env file, using process.env directly");
  }
}

loadEnvFile();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const DELIVERY_TOKEN = process.env.CONTENTFUL_DELIVERY_TOKEN;

if (!SPACE_ID || !DELIVERY_TOKEN) {
  console.error("❌ Missing required environment variables:");
  console.error("   CONTENTFUL_SPACE_ID:", SPACE_ID ? "✓" : "✗");
  console.error("   CONTENTFUL_DELIVERY_TOKEN:", DELIVERY_TOKEN ? "✓" : "✗");
  process.exit(1);
}

/**
 * Map Contentful adapter names to stable adapter IDs (must match registry contentfulName → id)
 */
const nameToStableId: Record<string, string> = {
  "Data Adapter: Splash from Page": "splash-from-page",
  "Data Adapter: Splash from Program": "splash-from-program",
  "Data Adapter: Grid Items from Exhibits": "grid-from-exhibits",
  "Data Adapter: Grid Items from Events": "grid-from-events",
  "Data Adapter: Categorized Catalog from Upcoming Events":
    "categorized-grid-from-upcoming-events",
  "Data Adapter: Grid Items from Programs": "grid-from-programs",
  "Data Adapter: Grid Items from Members": "grid-from-members",
  "Data Adapter: Grid Items from Posts": "grid-from-posts",
  "Data Adapter: Vertical Timeline Items from Press":
    "vertical-timeline-from-press",
  "Data Adapter: Vertical Timeline Items from History":
    "vertical-timeline-from-history",
  "Data Adapter: Report from Impact Report": "report-from-impact-report",
  "Data Adapter: Calendar Items from Events": "calendar-from-events",
  "Data Adapter: Double Column from Posts": "double-column-from-posts",
  "Data Adapter: Double Column from Programs": "double-column-from-programs",
  "Data Adapter: Single Column from Posts": "single-column-from-posts",
  "Data Adapter: Single Column from Upcoming Events":
    "single-column-from-upcoming-events",
  "Data Adapter: Mini Splash from Posts": "mini-splash-from-posts",
  "Data Adapter: Mini Splash from Upcoming Events":
    "mini-splash-from-upcoming-events",
  "Data Adapter: Google Form UI from Google Form":
    "google-form-ui-from-google-form",
  "Data Adapter: Image Marquee from Organizations":
    "image-marquee-from-organizations",
};

async function fetchAllDataAdapters() {
  const query = `
    {
      dataAdapterCollection {
        items {
          sys { id }
          name
        }
      }
    }
  `;
  const response = await fetch(
    `https://graphql.contentful.com/content/v1/spaces/${SPACE_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DELIVERY_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!response.ok)
    throw new Error(
      `GraphQL request failed: ${response.status} ${response.statusText}`
    );
  const json = await response.json();
  if (json.errors)
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
  return json.data?.dataAdapterCollection?.items || [];
}

async function verifyMapping() {
  console.log("🔄 Fetching DataAdapter entries from Contentful...\n");
  try {
    const adapters = await fetchAllDataAdapters();
    console.log(`✅ Found ${adapters.length} DataAdapter entries\n`);
    const mapped: Array<{ name: string; stableId: string }> = [];
    const unmapped: Array<{ name: string }> = [];
    for (const adapter of adapters) {
      const stableId = nameToStableId[adapter.name];
      if (stableId) {
        mapped.push({ name: adapter.name, stableId });
      } else {
        unmapped.push({ name: adapter.name });
      }
    }
    console.log("📋 Mapped (name → stableId):");
    mapped.forEach(({ name, stableId }) =>
      console.log(`   ${name} → ${stableId}`)
    );
    if (unmapped.length > 0) {
      console.log(
        "\n⚠️  Unmapped adapters (add to registry and nameToStableId in this script):"
      );
      unmapped.forEach(({ name }) => console.log(`   ${name}`));
    } else {
      console.log("\n✅ All Contentful adapters have a name mapping.");
    }
  } catch (error: unknown) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

verifyMapping();
