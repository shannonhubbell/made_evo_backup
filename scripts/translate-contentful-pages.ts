#!/usr/bin/env tsx
/**
 * Translate Contentful Content
 * 
 * Pulls down all entries from specified Contentful content types, translates all non-reference
 * localizable fields from English to Spanish, and pushes them back as "es-US" locale.
 * 
 * Supports: Page, ContentView, Post, Event, Program, Press, Exhibit, SocialMediaHandle, Member
 */

import { readFileSync } from 'fs';
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
const TRANSLATOR_URL = env.TRANSLATOR_URL || 'http://localhost:8000';

const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;
const SOURCE_LOCALE = 'en-US';
const TARGET_LOCALE = 'es-US';

interface ContentfulField {
  id: string;
  name: string;
  type: string;
  localized: boolean;
  required: boolean;
  items?: {
    type: string;
    linkType?: string;
  };
  linkType?: string;
}

interface ContentfulEntry {
  sys: {
    id: string;
    version: number;
    contentType: {
      sys: {
        id: string;
      };
    };
  };
  fields: Record<string, Record<string, any>>;
}

/**
 * Translate text using local translation service
 */
async function translateText(text: string): Promise<string> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text;
  }

  try {
    const response = await fetch(`${TRANSLATOR_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        src_lang: 'eng',
        tgt_lang: 'spa',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Translation service error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    
    // Handle different possible response formats
    if (data.translated_text) {
      return data.translated_text;
    } else if (data.translation) {
      return data.translation;
    } else if (data.text) {
      return data.text;
    } else if (typeof data === 'string') {
      return data;
    } else {
      throw new Error(`Unexpected response format from translation service: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Failed to connect to translation service at ${TRANSLATOR_URL}. Make sure the service is running.`);
    }
    console.error(`Translation error for text "${text.substring(0, 50)}...":`, error);
    throw error;
  }
}

/**
 * Get content type schema to identify localizable fields
 */
async function getContentTypeSchema(contentTypeId: string): Promise<ContentfulField[]> {
  const url = `${CONTENTFUL_API_BASE}/content_types/${contentTypeId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch content type "${contentTypeId}": ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return data.fields || [];
}

/**
 * Check if a field should be translated (localizable and not a reference)
 */
function shouldTranslateField(field: ContentfulField, contentTypeSchema: ContentfulField[]): boolean {
  // Must be localized
  if (!field.localized) {
    return false;
  }

  // Skip reference fields (Link types)
  if (field.type === 'Link' && (field.linkType === 'Entry' || field.linkType === 'Asset')) {
    return false;
  }

  // Skip arrays of references
  if (field.type === 'Array' && field.items?.type === 'Link') {
    return false;
  }

  // Skip RichText for now (complex structure)
  if (field.type === 'RichText') {
    return false;
  }

  // Skip Date fields - dates should not be translated
  if (field.type === 'Date') {
    return false;
  }

  // Translate: Symbol, Text, Integer, Number, Boolean
  return ['Symbol', 'Text', 'Integer', 'Number', 'Boolean'].includes(field.type);
}

/**
 * List all locales in Contentful
 */
async function listAllLocales(): Promise<Array<{ code: string; name: string }>> {
  try {
    const url = `${CONTENTFUL_API_BASE}/locales`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch locales: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      code: item.code,
      name: item.name,
    }));
  } catch (error) {
    throw new Error(`Error listing locales: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a locale exists in Contentful
 */
async function checkLocaleExists(localeCode: string): Promise<{ exists: boolean; availableLocales?: Array<{ code: string; name: string }> }> {
  try {
    const locales = await listAllLocales();
    const exists = locales.some(locale => locale.code === localeCode);
    return { exists, availableLocales: locales };
  } catch (error) {
    console.error('Error checking locale:', error instanceof Error ? error.message : error);
    return { exists: false };
  }
}

/**
 * Get all entries of a specific content type from Contentful
 */
async function getAllEntries(contentTypeId: string): Promise<ContentfulEntry[]> {
  const entries: ContentfulEntry[] = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${CONTENTFUL_API_BASE}/entries?content_type=${contentTypeId}&limit=${limit}&skip=${skip}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Contentful API error for ${contentTypeId}: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      entries.push(item);
    }

    const total = data.total || 0;
    skip += limit;
    hasMore = skip < total;
  }

  return entries;
}

/**
 * Get a specific entry with all locales
 */
async function getEntry(entryId: string): Promise<ContentfulEntry> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch entry: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return await response.json();
}

/**
 * Update entry with Spanish translations
 */
async function updateEntryWithTranslations(
  entry: ContentfulEntry,
  translatedFields: Record<string, string>,
  contentTypeSchema: ContentfulField[]
): Promise<void> {
  // Get current entry to preserve existing fields
  const currentEntry = await getEntry(entry.sys.id);

  // Build fields object with existing values and new translations
  const fields: Record<string, Record<string, any>> = {};

  // Copy all existing fields from current entry
  for (const [fieldId, fieldValues] of Object.entries(currentEntry.fields)) {
    fields[fieldId] = { ...fieldValues };
  }

  // Add or update Spanish translations
  for (const [fieldId, translatedValue] of Object.entries(translatedFields)) {
    if (!fields[fieldId]) {
      fields[fieldId] = {};
    }
    fields[fieldId][TARGET_LOCALE] = translatedValue;
  }

  // Update entry
  const url = `${CONTENTFUL_API_BASE}/entries/${entry.sys.id}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': currentEntry.sys.version.toString(),
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update entry: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Publish an entry
 */
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

/**
 * Translate entries for a specific content type
 */
async function translateContentType(
  contentTypeId: string,
  contentTypeName: string,
  displayNameField: string = 'name'
): Promise<{ processed: number; translated: number; skipped: number; errors: number }> {
  console.log(`\n📄 Processing ${contentTypeName} (${contentTypeId})...`);
  console.log('-'.repeat(60));

  // Get content type schema
  let contentTypeSchema: ContentfulField[];
  try {
    contentTypeSchema = await getContentTypeSchema(contentTypeId);
  } catch (error) {
    console.error(`   ❌ Failed to fetch schema for ${contentTypeName}:`, error instanceof Error ? error.message : error);
    console.log(`   ⏭️  Skipping ${contentTypeName}\n`);
    return { processed: 0, translated: 0, skipped: 0, errors: 1 };
  }
  
  if (!contentTypeSchema || contentTypeSchema.length === 0) {
    console.warn(`   ⚠️  No schema found for ${contentTypeName}, skipping\n`);
    return { processed: 0, translated: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`✓ Found ${contentTypeSchema.length} fields`);

  // Identify translatable fields
  const translatableFields = contentTypeSchema.filter(field => 
    shouldTranslateField(field, contentTypeSchema)
  );
  console.log(`✓ Found ${translatableFields.length} translatable fields:`);
  translatableFields.forEach(field => {
    console.log(`   - ${field.id} (${field.type})`);
  });

  // Get all entries
  const entries = await getAllEntries(contentTypeId);
  console.log(`✓ Found ${entries.length} ${contentTypeName.toLowerCase()}(s)\n`);

  if (entries.length === 0) {
    console.log(`⚠️  No ${contentTypeName.toLowerCase()} found. Skipping.\n`);
    return { processed: 0, translated: 0, skipped: 0, errors: 0 };
  }

  const stats = {
    processed: 0,
    translated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const entry of entries) {
    const entryName = entry.fields[displayNameField]?.[SOURCE_LOCALE] || 
                      entry.fields.title?.[SOURCE_LOCALE] || 
                      entry.fields.name?.[SOURCE_LOCALE] || 
                      entry.sys.id;
    console.log(`   Processing: ${entryName}`);

    try {
      // Get current entry to check if Spanish already exists
      const currentEntry = await getEntry(entry.sys.id);
      
      // Check if any translatable field already has Spanish translation
      const hasSpanish = translatableFields.some(field => {
        const fieldId = field.id;
        return currentEntry.fields[fieldId]?.[TARGET_LOCALE] !== undefined;
      });

      if (hasSpanish) {
        console.log(`     ⏭️  Spanish translation already exists, skipping`);
        stats.skipped++;
        continue;
      }

      // Translate all translatable fields
      const translatedFields: Record<string, string> = {};
      let hasTranslations = false;

      for (const field of translatableFields) {
        const fieldId = field.id;
        // Use currentEntry to get the most up-to-date English values
        const englishValue = currentEntry.fields[fieldId]?.[SOURCE_LOCALE];

        if (englishValue !== undefined && englishValue !== null && englishValue !== '') {
          try {
            // Convert to string for translation
            const textToTranslate = String(englishValue);
            console.log(`     Translating ${fieldId}...`);
            const translated = await translateText(textToTranslate);
            translatedFields[fieldId] = translated;
            hasTranslations = true;

            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`     ⚠️  Failed to translate ${fieldId}:`, error instanceof Error ? error.message : error);
            // Continue with other fields
          }
        }
      }

      if (hasTranslations) {
        // Update entry with translations
        console.log(`     💾 Saving translations...`);
        await updateEntryWithTranslations(currentEntry, translatedFields, contentTypeSchema);
        
        // Get updated entry to publish
        const updatedEntry = await getEntry(entry.sys.id);
        await publishEntry(updatedEntry.sys.id, updatedEntry.sys.version);
        
        console.log(`     ✅ Translated and published`);
        stats.translated++;
      } else {
        console.log(`     ⚠️  No translatable content found`);
        stats.skipped++;
      }

      stats.processed++;
    } catch (error) {
      console.error(`     ❌ Error processing entry:`, error instanceof Error ? error.message : error);
      stats.errors++;
    }

    console.log();
  }

  return stats;
}

/**
 * Main function
 */
async function main() {
  console.log('🌍 Translating Contentful Content\n');
  console.log('='.repeat(60));

  // Validate credentials
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Error: Contentful credentials not found');
    console.error('   Please set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  // Test translation service connection
  console.log(`🔗 Testing translation service at ${TRANSLATOR_URL}...`);
  try {
    const testResponse = await fetch(`${TRANSLATOR_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'test',
        src_lang: 'eng',
        tgt_lang: 'spa',
      }),
    });
    
    if (!testResponse.ok) {
      console.error(`❌ Error: Translation service returned error: ${testResponse.status} ${testResponse.statusText}`);
      console.error(`   Make sure your translation service is running at ${TRANSLATOR_URL}`);
      process.exit(1);
    }
    console.log(`✓ Translation service is available\n`);
  } catch (error) {
    console.error(`❌ Error: Cannot connect to translation service at ${TRANSLATOR_URL}`);
    console.error(`   Make sure your translation service is running in Docker`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  try {
    // Step 1: Check if target locale exists
    console.log('1. Checking if target locale exists...');
    const localeCheck = await checkLocaleExists(TARGET_LOCALE);
    if (!localeCheck.exists) {
      console.error(`❌ Error: Locale "${TARGET_LOCALE}" does not exist in Contentful`);
      if (localeCheck.availableLocales && localeCheck.availableLocales.length > 0) {
        console.error(`\n   Available locales in your space:`);
        localeCheck.availableLocales.forEach(locale => {
          console.error(`   - ${locale.code} (${locale.name})`);
        });
        console.error(`\n   Please create the locale "${TARGET_LOCALE}" in Contentful first:`);
        console.error(`   Settings → Locales → Add locale`);
      } else {
        console.error(`   Please create the locale in Contentful first:`);
        console.error(`   Settings → Locales → Add locale → Spanish (United States) [es-US]`);
      }
      process.exit(1);
    }
    console.log(`✓ Locale "${TARGET_LOCALE}" exists\n`);

    // Step 2: Define content types to translate
    // Content type ID -> [Display Name, Display Name Field]
    // Note: Contentful content type IDs are typically camelCase (e.g., 'contentView' not 'content-view')
    // ContentView entries are typically nested within Pages, but can also be standalone entries
    const contentTypesToTranslate: Array<[string, string, string]> = [
      ['page', 'Page', 'name'],
      ['contentView', 'ContentView', 'name'], // May be nested in Pages or standalone
      ['post', 'Post', 'title'],
      ['event', 'Event', 'title'],
      ['program', 'Program', 'title'],
      ['press', 'Press', 'title'],
      ['exhibit', 'Exhibit', 'title'],
      ['socialMediaHandle', 'SocialMediaHandle', 'platform'],
      ['member', 'Member', 'displayName'],
    ];

    // Step 3: Process each content type
    const overallStats = {
      processed: 0,
      translated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const [contentTypeId, contentTypeName, displayNameField] of contentTypesToTranslate) {
      try {
        const stats = await translateContentType(contentTypeId, contentTypeName, displayNameField);
        overallStats.processed += stats.processed;
        overallStats.translated += stats.translated;
        overallStats.skipped += stats.skipped;
        overallStats.errors += stats.errors;
      } catch (error) {
        console.error(`❌ Error processing ${contentTypeName}:`, error instanceof Error ? error.message : error);
        overallStats.errors++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ Translation complete!\n');
    console.log('📊 Overall Summary:');
    console.log(`   Processed: ${overallStats.processed}`);
    console.log(`   Translated: ${overallStats.translated}`);
    console.log(`   Skipped: ${overallStats.skipped}`);
    console.log(`   Errors: ${overallStats.errors}`);
    console.log();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

export { translateText, shouldTranslateField, getAllEntries, translateContentType };
