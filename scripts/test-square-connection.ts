#!/usr/bin/env tsx
/**
 * Test Square API Connection
 * 
 * Simple script to verify Square API credentials are working
 * by making a basic API call to list locations or get merchant info.
 * 
 * Usage:
 *   npm run test:square-connection
 *   or
 *   tsx scripts/test-square-connection.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env file if it exists
function loadEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Could not read .env file, using process.env directly');
  }
}

loadEnvFile();

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';

function checkEnvironmentVariables() {
  const missing: string[] = [];
  
  if (!SQUARE_ACCESS_TOKEN) {
    missing.push('SQUARE_ACCESS_TOKEN');
  }
  
  if (!SQUARE_LOCATION_ID) {
    missing.push('SQUARE_LOCATION_ID');
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  console.log(`   Environment: ${SQUARE_ENVIRONMENT}`);
  console.log(`   Location ID: ${SQUARE_LOCATION_ID}`);
  console.log(`   Access Token: ${SQUARE_ACCESS_TOKEN.substring(0, 10)}...`);
  return true;
}

async function testSquareConnection() {
  const squareApiBaseUrl = SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  
  console.log('\n🔍 Testing Square API Connection...\n');
  
  // Test 1: List Locations (simplest endpoint to verify token)
  console.log('Test 1: Listing locations...');
  try {
    const locationsResponse = await fetch(`${squareApiBaseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!locationsResponse.ok) {
      const errorData = await locationsResponse.json();
      console.error('❌ Locations API Error:', JSON.stringify(errorData, null, 2));
      throw new Error(`Locations API error: ${errorData.errors?.[0]?.detail || locationsResponse.statusText}`);
    }
    
    const locationsData = await locationsResponse.json();
    console.log('✅ Locations API working!');
    console.log(`   Found ${locationsData.locations?.length || 0} location(s)`);
    if (locationsData.locations && locationsData.locations.length > 0) {
      locationsData.locations.forEach((loc: any) => {
        console.log(`   - ${loc.name} (ID: ${loc.id})`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to list locations:', error);
    throw error;
  }
  
  // Test 2: Get Merchant Info
  console.log('\nTest 2: Getting merchant info...');
  try {
    const merchantResponse = await fetch(`${squareApiBaseUrl}/v2/merchants`, {
      method: 'GET',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!merchantResponse.ok) {
      const errorData = await merchantResponse.json();
      console.error('❌ Merchant API Error:', JSON.stringify(errorData, null, 2));
      throw new Error(`Merchant API error: ${errorData.errors?.[0]?.detail || merchantResponse.statusText}`);
    }
    
    const merchantData = await merchantResponse.json();
    console.log('✅ Merchant API working!');
    if (merchantData.merchant && merchantData.merchant.length > 0) {
      const merchant = merchantData.merchant[0];
      console.log(`   Business Name: ${merchant.business_name || 'N/A'}`);
      console.log(`   Country: ${merchant.country || 'N/A'}`);
    }
  } catch (error) {
    console.error('❌ Failed to get merchant info:', error);
    // Don't throw - this is optional
  }
  
  // Test 3: Try Catalog Search (without query object)
  console.log('\nTest 3: Testing catalog search (simple request)...');
  try {
    const catalogResponse = await fetch(`${squareApiBaseUrl}/v2/catalog/search`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_types: ['ITEM'],
        limit: 10,
      }),
    });
    
    if (!catalogResponse.ok) {
      const errorData = await catalogResponse.json();
      console.error('❌ Catalog API Error:', JSON.stringify(errorData, null, 2));
      console.error('   This might mean:');
      console.error('   - No catalog items exist in your Square account');
      console.error('   - Your access token lacks catalog permissions');
      console.error('   - The location does not have catalog access');
      throw new Error(`Catalog API error: ${errorData.errors?.[0]?.detail || catalogResponse.statusText}`);
    }
    
    const catalogData = await catalogResponse.json();
    console.log('✅ Catalog API working!');
    console.log(`   Found ${catalogData.objects?.length || 0} catalog object(s)`);
    if (catalogData.objects && catalogData.objects.length > 0) {
      const items = catalogData.objects.filter((obj: any) => obj.type === 'ITEM');
      console.log(`   - ${items.length} ITEM object(s)`);
      items.forEach((item: any) => {
        console.log(`     • ${item.itemData?.name || 'Unnamed'} (ID: ${item.id})`);
      });
    } else {
      console.log('   ⚠️  No catalog objects found. Create items in your Square Dashboard.');
    }
  } catch (error) {
    console.error('❌ Failed to search catalog:', error);
    // Don't throw - catalog might be empty
  }
  
  console.log('\n✅ Connection test completed!');
  console.log('\n💡 Summary:');
  console.log('   - If locations test passed: Your access token is valid ✅');
  console.log('   - If catalog test failed: You may need to create catalog items in Square Dashboard');
  console.log('   - If all tests passed: Your Square integration is working correctly!');
}

async function main() {
  checkEnvironmentVariables();
  
  try {
    await testSquareConnection();
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  }
}

main();

