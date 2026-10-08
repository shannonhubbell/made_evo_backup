#!/usr/bin/env tsx
/**
 * List Contentful Locales
 * 
 * Fetches and displays all available locales from your Contentful space.
 * Useful for verifying locale setup and planning multi-language support.
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

const CONTENTFUL_API_BASE = `https://api.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

interface ContentfulLocale {
  sys: {
    id: string;
    version: number;
  };
  code: string;
  name: string;
  default: boolean;
  fallbackCode?: string;
  contentManagementApi: boolean;
  contentDeliveryApi: boolean;
  optional: boolean;
}

/**
 * Fetch all locales from Contentful
 */
async function getAllLocales(): Promise<ContentfulLocale[]> {
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
  return data.items || [];
}

/**
 * Main function
 */
async function main() {
  console.log('🌍 Contentful Locales\n');
  console.log('='.repeat(60));

  // Validate credentials
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Error: Contentful credentials not found');
    console.error('   Please set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }

  try {
    console.log(`Fetching locales from Contentful...`);
    console.log(`Space: ${CONTENTFUL_SPACE_ID}`);
    console.log(`Environment: ${CONTENTFUL_ENVIRONMENT}\n`);

    const locales = await getAllLocales();

    if (locales.length === 0) {
      console.log('⚠️  No locales found in your Contentful space.');
      return;
    }

    console.log(`✅ Found ${locales.length} locale(s):\n`);

    // Find default locale
    const defaultLocale = locales.find(l => l.default);

    locales.forEach((locale, index) => {
      const isDefault = locale.default;
      const fallback = locale.fallbackCode ? ` → ${locale.fallbackCode}` : '';
      
      console.log(`${index + 1}. ${locale.name}`);
      console.log(`   Code: ${locale.code}`);
      console.log(`   Default: ${isDefault ? '✓ Yes' : '✗ No'}`);
      if (fallback) {
        console.log(`   Fallback: ${fallback}`);
      }
      console.log(`   Content Delivery API: ${locale.contentDeliveryApi ? '✓' : '✗'}`);
      console.log(`   Content Management API: ${locale.contentManagementApi ? '✓' : '✗'}`);
      console.log(`   Optional: ${locale.optional ? 'Yes' : 'No'}`);
      console.log();
    });

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Summary:\n');
    console.log(`   Total locales: ${locales.length}`);
    console.log(`   Default locale: ${defaultLocale?.code || 'Not set'} (${defaultLocale?.name || 'N/A'})`);
    console.log(`   Locale codes: ${locales.map(l => l.code).join(', ')}`);
    console.log();

    // Recommendations
    console.log('💡 Recommendations:\n');
    if (!defaultLocale) {
      console.log('   ⚠️  No default locale set. Consider setting one in Contentful.');
    }
    
    const codes = locales.map(l => l.code);
    if (codes.includes('en-US')) {
      console.log('   ✓ English (US) locale found - good for international sites');
    }
    
    if (codes.length > 1) {
      console.log(`   ✓ Multiple locales configured - ready for multi-language support`);
      console.log(`   → See docs/MULTI_LANGUAGE_SUPPORT_PLAN.md for implementation guide`);
    } else {
      console.log(`   ℹ️  Only one locale configured. Add more locales in Contentful:`);
      console.log(`      Settings → Locales → Add locale`);
    }
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
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

export { getAllLocales };
