#!/usr/bin/env tsx
/**
 * Delete All Members from Contentful
 * 
 * Unpublishes and deletes all Member entries.
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

/**
 * Get all Member entries from Contentful
 */
async function getAllMembers(): Promise<Array<{ id: string; version: number; publishedVersion?: number; displayName: string }>> {
  const members: Array<{ id: string; version: number; publishedVersion?: number; displayName: string }> = [];
  
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    throw new Error('Contentful credentials not found');
  }
  
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
      const displayName = item.fields?.displayName?.['en-US'] || item.sys.id;
      members.push({
        id: item.sys.id,
        version: item.sys.version,
        publishedVersion: item.sys.publishedVersion,
        displayName,
      });
    }
    
    const total = data.total || 0;
    skip += limit;
    hasMore = skip < total;
  }
  
  return members;
}

/**
 * Unpublish an entry
 */
async function unpublishEntry(entryId: string, version: number): Promise<void> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}/published`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': version.toString(),
    },
  });
  
  if (!response.ok && response.status !== 404) {
    // 404 means it's already unpublished, which is fine
    const errorText = await response.text();
    throw new Error(`Failed to unpublish entry: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Delete an entry
 */
async function deleteEntry(entryId: string, version: number): Promise<void> {
  const url = `${CONTENTFUL_API_BASE}/entries/${entryId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Contentful-Version': version.toString(),
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete entry: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🗑️  Deleting All Members from Contentful\n');
  console.log('='.repeat(60));
  
  // Validate credentials
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
    console.error('❌ Error: Contentful credentials not found');
    console.error('   Please set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN in .env');
    process.exit(1);
  }
  
  // Get all members
  console.log('1. Fetching all members...');
  const members = await getAllMembers();
  console.log(`✓ Found ${members.length} member(s)\n`);
  
  if (members.length === 0) {
    console.log('✅ No members to delete.');
    return;
  }
  
  // Confirm deletion
  console.log(`⚠️  WARNING: This will delete ${members.length} member(s):`);
  for (const member of members.slice(0, 10)) {
    console.log(`   - ${member.displayName}`);
  }
  if (members.length > 10) {
    console.log(`   ... and ${members.length - 10} more`);
  }
  console.log();
  
  const stats = {
    unpublished: 0,
    deleted: 0,
    errors: 0,
  };
  
  console.log('2. Unpublishing and deleting members...\n');
  
  for (const member of members) {
    try {
      // First, unpublish if it's published
      if (member.publishedVersion) {
        console.log(`   Unpublishing: ${member.displayName}`);
        // Get current version after potential unpublish
        const getUrl = `${CONTENTFUL_API_BASE}/entries/${member.id}`;
        const getResponse = await fetch(getUrl, {
          headers: {
            'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (getResponse.ok) {
          const entryData = await getResponse.json();
          await unpublishEntry(member.id, entryData.sys.version);
          stats.unpublished++;
          
          // Get updated version after unpublish
          const updatedResponse = await fetch(getUrl, {
            headers: {
              'Authorization': `Bearer ${CONTENTFUL_MANAGEMENT_TOKEN}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (updatedResponse.ok) {
            const updatedData = await updatedResponse.json();
            member.version = updatedData.sys.version;
          }
        }
      }
      
      // Then delete
      console.log(`   Deleting: ${member.displayName}`);
      await deleteEntry(member.id, member.version);
      stats.deleted++;
    } catch (error) {
      console.error(`   ❌ Error processing ${member.displayName}: ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Deletion complete!\n');
  console.log('📊 Summary:');
  console.log(`   Unpublished: ${stats.unpublished}`);
  console.log(`   Deleted: ${stats.deleted}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

export { getAllMembers, unpublishEntry, deleteEntry };

