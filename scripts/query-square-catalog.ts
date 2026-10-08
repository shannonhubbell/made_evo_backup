#!/usr/bin/env tsx
/**
 * Query Square Catalog API
 * 
 * This script queries Square's Catalog API to retrieve available items,
 * specifically looking for "General Admission" and other catalog items.
 * 
 * Usage:
 *   npm run query:square-catalog
 *   or
 *   tsx scripts/query-square-catalog.ts
 * 
 * Environment Variables Required:
 *   - SQUARE_ACCESS_TOKEN
 *   - SQUARE_LOCATION_ID
 *   - SQUARE_ENVIRONMENT (optional, defaults to 'sandbox')
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
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Only set if not already in process.env (process.env takes precedence)
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (error) {
    // If we can't read .env file, that's okay - use process.env directly
    console.log('⚠️  Could not read .env file, using process.env directly');
  }
}

// Load .env file
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
    console.error('\nPlease set these in your .env file or environment.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  console.log(`   Environment: ${SQUARE_ENVIRONMENT}`);
  console.log(`   Location ID: ${SQUARE_LOCATION_ID}`);
  return true;
}

async function querySquareCatalog() {
  // Determine Square API base URL based on environment
  const squareApiBaseUrl = SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  
  try {
    // Query catalog items using SearchCatalogObjects endpoint
    const response = await fetch(`${squareApiBaseUrl}/v2/catalog/search`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_types: ['ITEM'], // Query for ITEM objects
        limit: 100,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Square API Error:', JSON.stringify(errorData, null, 2));
      console.error('❌ Response status:', response.status);
      console.error('❌ Request URL:', `${squareApiBaseUrl}/v2/catalog/search`);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Verify your SQUARE_ACCESS_TOKEN is valid');
      console.error('   2. Verify your SQUARE_LOCATION_ID is correct');
      console.error('   3. Ensure catalog items exist in your Square Dashboard');
      console.error('   4. Check that your access token has catalog read permissions');
      throw new Error(`Square API error: ${errorData.errors?.[0]?.detail || errorData.errors?.[0]?.code || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Square SearchCatalogObjects returns objects in the 'objects' array
    const items = data.objects?.filter((obj: any) => obj.type === 'ITEM') || [];
    
    console.log(`\n📦 Found ${items.length} catalog items:\n`);
    
    if (items.length === 0 && data.objects && data.objects.length > 0) {
      console.log('⚠️  No ITEM objects found, but found other catalog objects:');
      const objectTypes = [...new Set(data.objects.map((obj: any) => obj.type))];
      objectTypes.forEach(type => {
        const count = data.objects.filter((obj: any) => obj.type === type).length;
        console.log(`   - ${type}: ${count} object(s)`);
      });
    } else if (items.length === 0) {
      console.log('⚠️  No catalog items found.');
      console.log('   This could mean:');
      console.log('   1. No items have been created in your Square catalog');
      console.log('   2. The location does not have access to catalog items');
      console.log('   3. Items exist but are not published/active');
      console.log('\n💡 Tip: Create a "General Admission" item in your Square Dashboard first.');
    }
    
    // Find General Admission specifically
    // Note: Square API returns snake_case (item_data), not camelCase (itemData)
    const generalAdmission = items.find((item: any) => {
      const itemName = item.item_data?.name || item.itemData?.name; // Support both formats
      return itemName?.toLowerCase().includes('general admission') ||
             itemName?.toLowerCase().includes('admission');
    });
    
    if (generalAdmission) {
      console.log('✅ Found General Admission:');
      console.log(`   ID: ${generalAdmission.id}`);
      const itemName = generalAdmission.item_data?.name || generalAdmission.itemData?.name;
      const itemDescription = generalAdmission.item_data?.description || generalAdmission.itemData?.description;
      console.log(`   Name: ${itemName}`);
      console.log(`   Description: ${itemDescription || 'N/A'}`);
      
      // Get pricing information
      const variations = generalAdmission.item_data?.variations || generalAdmission.itemData?.variations || [];
      if (variations.length > 0) {
        console.log(`   Variations: ${variations.length}`);
        variations.forEach((variation: any, index: number) => {
          const varData = variation.item_variation_data || variation.itemVariationData;
          console.log(`     ${index + 1}. ${varData?.name || 'Unnamed'}`);
          if (varData?.price_money || varData?.priceMoney) {
            const price = varData.price_money || varData.priceMoney;
            const amount = (parseInt(price.amount) / 100).toFixed(2);
            console.log(`        Price: $${amount} ${price.currency}`);
          }
          console.log(`        Variation ID: ${variation.id}`);
        });
      }
    } else {
      console.log('⚠️  General Admission not found in catalog');
      console.log('\nAvailable items:');
      items.forEach((item: any, index: number) => {
        const itemName = item.item_data?.name || item.itemData?.name || 'Unnamed';
        console.log(`   ${index + 1}. ${itemName} (ID: ${item.id})`);
      });
    }
    
    // Generate TypeScript interface for the catalog items
    const outputFile = path.join(projectRoot, 'src/lib/square/catalog-types.ts');
    const outputDir = path.dirname(outputFile);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const typeScriptContent = `/**
 * Square Catalog Types
 * 
 * Auto-generated from Square Catalog API
 * Last updated: ${new Date().toISOString()}
 * 
 * Run: npm run query:square-catalog
 */

export interface SquareCatalogItem {
  id: string;
  type: 'ITEM';
  itemData: {
    name: string;
    description?: string;
    categoryId?: string;
    variations?: Array<{
      id: string;
      type: 'ITEM_VARIATION';
      itemVariationData: {
        name: string;
        itemId: string;
        priceMoney?: {
          amount: string; // Amount in cents
          currency: string;
        };
        sku?: string;
      };
    }>;
  };
}

export interface SquareCatalogResponse {
  objects: SquareCatalogItem[];
  cursor?: string;
}

${generalAdmission ? `
/**
 * General Admission Item
 * Extracted from Square Catalog
 */
export const GENERAL_ADMISSION_ITEM: SquareCatalogItem = ${JSON.stringify(generalAdmission, null, 2)};

export const GENERAL_ADMISSION_VARIATION_ID = ${JSON.stringify(
  (generalAdmission.item_data || generalAdmission.itemData)?.variations?.[0]?.id || ''
)};
` : '// General Admission not found in catalog'}
`;

    fs.writeFileSync(outputFile, typeScriptContent, 'utf-8');
    console.log(`\n✅ Catalog types written to: ${outputFile}`);
    
    // Also save raw JSON for reference
    const jsonFile = path.join(projectRoot, 'src/lib/square/catalog-data.json');
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Raw catalog data written to: ${jsonFile}`);
    
    return {
      items,
      generalAdmission,
    };
    
  } catch (error) {
    console.error('❌ Error querying Square Catalog:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🔍 Querying Square Catalog API...\n');
  
  checkEnvironmentVariables();
  
  try {
    await querySquareCatalog();
    console.log('\n✅ Catalog query completed successfully');
  } catch (error) {
    console.error('\n❌ Catalog query failed:', error);
    process.exit(1);
  }
}

main();

