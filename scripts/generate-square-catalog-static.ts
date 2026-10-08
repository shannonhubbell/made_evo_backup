#!/usr/bin/env tsx
/**
 * Generate Static Square Catalog
 * 
 * This script queries Square's Catalog API at build time and generates
 * a static JSON file that can be served without a server.
 * 
 * Usage:
 *   npm run generate:square-catalog-static
 *   or
 *   tsx scripts/generate-square-catalog-static.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as https from 'https';
import * as http from 'http';

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
    console.error('\nPlease set these in your .env file or environment.');
    process.exit(1);
  }
  
  return true;
}

/**
 * Download an image from a URL and save it to the public folder
 */
async function downloadImage(imageUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(imageUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const file = fs.createWriteStream(outputPath);
    
    protocol.get(imageUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        return downloadImage(response.headers.location!, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
  });
}

/**
 * Extract image URL from Square catalog item
 * Square stores images as separate IMAGE objects, referenced by ID in items
 */
function getImageUrl(item: any, images: any[]): string | null {
  const itemData = item.item_data || item.itemData;
  const imageIds = itemData?.image_ids || itemData?.imageIds;
  
  if (!imageIds || imageIds.length === 0) {
    return null;
  }
  
  // Find the image object
  const imageId = Array.isArray(imageIds) ? imageIds[0] : imageIds;
  const imageObj = images.find((img: any) => img.id === imageId);
  
  if (imageObj) {
    const imageData = imageObj.image_data || imageObj.imageData;
    const imageUrl = imageData?.url || imageData?.url;
    if (imageUrl) {
      return imageUrl;
    }
  }
  
  // Fallback: construct URL from image ID
  // Square image URLs follow this pattern:
  // https://square-cdn.com/{image_id}/original.jpg
  return `https://square-cdn.com/${imageId}/original.jpg`;
}

async function generateStaticCatalog() {
  const squareApiBaseUrl = SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  
  try {
    console.log('🔍 Querying Square Catalog API...');
    
    // Query catalog items
    const response = await fetch(`${squareApiBaseUrl}/v2/catalog/search`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object_types: ['ITEM', 'CATEGORY', 'IMAGE'],
        limit: 100,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Square API Error:', JSON.stringify(errorData, null, 2));
      throw new Error(`Square API error: ${errorData.errors?.[0]?.detail || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract items, categories, and images from the catalog
    const items = (data.objects || []).filter((obj: any) => obj.type === 'ITEM');
    const categories = (data.objects || []).filter((obj: any) => obj.type === 'CATEGORY');
    const images = (data.objects || []).filter((obj: any) => obj.type === 'IMAGE');
    
    console.log(`📦 Found ${items.length} catalog items`);
    console.log(`📁 Found ${categories.length} categories`);
    console.log(`🖼️  Found ${images.length} images`);
    
    // Find Membership category
    const membershipCategory = categories.find((cat: any) => {
      const catName = cat.category_data?.name || cat.categoryData?.name;
      return catName?.toLowerCase().includes('membership');
    });
    
    // Find items in the Membership category
    const membershipItems: any[] = [];
    if (membershipCategory) {
      const membershipCategoryId = membershipCategory.id;
      membershipItems.push(...items.filter((item: any) => {
        const itemData = item.item_data || item.itemData;
        const itemCategories = itemData?.category_id || itemData?.categoryId;
        // Handle both single ID and array of IDs
        if (Array.isArray(itemCategories)) {
          return itemCategories.includes(membershipCategoryId);
        }
        return itemCategories === membershipCategoryId;
      }));
      console.log(`🎫 Found ${membershipItems.length} items in Membership category`);
    } else {
      console.log(`⚠️  Membership category not found`);
    }
    
    // Find General Admission specifically
    const generalAdmission = items.find((item: any) => {
      const itemName = item.item_data?.name || item.itemData?.name;
      return itemName?.toLowerCase().includes('general admission') ||
             itemName?.toLowerCase().includes('admission');
    });
    
    // Create images directory in public folder
    const imagesDir = path.join(projectRoot, 'public', 'images', 'square');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Format response similar to API endpoint and download images
    const formattedItems = await Promise.all(items.map(async (item: any) => {
      const itemData = item.item_data || item.itemData;
      const variations = itemData?.variations || [];
      
      // Download and save image if available
      let imagePath: string | null = null;
      const imageUrl = getImageUrl(item, images);
      
      if (imageUrl) {
        try {
          const imageId = itemData?.image_ids?.[0] || itemData?.imageIds?.[0] || item.id;
          // Extract file extension from URL or default to .jpg
          const urlPath = new URL(imageUrl).pathname;
          const imageExtension = path.extname(urlPath) || '.jpg';
          const imageFilename = `${imageId}${imageExtension}`;
          const imageOutputPath = path.join(imagesDir, imageFilename);
          
          // Skip if image already exists
          if (!fs.existsSync(imageOutputPath)) {
            console.log(`  📥 Downloading image for "${itemData?.name || 'Unnamed'}": ${imageUrl}`);
            await downloadImage(imageUrl, imageOutputPath);
            console.log(`  ✅ Saved image to: /images/square/${imageFilename}`);
          } else {
            console.log(`  ⏭️  Image already exists for "${itemData?.name || 'Unnamed'}"`);
          }
          
          // Store the public path (relative to public folder)
          imagePath = `/images/square/${imageFilename}`;
        } catch (error) {
          console.warn(`  ⚠️  Failed to download image for "${itemData?.name || 'Unnamed'}":`, error);
        }
      }
      
      return {
        id: item.id,
        name: itemData?.name || 'Unnamed',
        description: itemData?.description,
        imageUrl: imagePath || imageUrl || null,
        variations: variations.map((variation: any) => {
          const varData = variation.item_variation_data || variation.itemVariationData;
          return {
            id: variation.id,
            name: varData?.name || 'Unnamed',
            priceMoney: varData?.price_money || varData?.priceMoney,
          };
        }),
      };
    }));
    
    let generalAdmissionData = undefined;
    if (generalAdmission) {
      const itemData = generalAdmission.item_data || generalAdmission.itemData;
      const firstVariation = itemData?.variations?.[0];
      if (firstVariation) {
        const varData = firstVariation.item_variation_data || firstVariation.itemVariationData;
        generalAdmissionData = {
          id: generalAdmission.id,
          name: itemData?.name,
          variationId: firstVariation.id,
          price: varData?.price_money || varData?.priceMoney || {
            amount: '0',
            currency: 'USD',
          },
        };
      }
    }
    
    // Format membership items (images already downloaded above)
    const membershipItemsData = membershipItems.map((item: any) => {
      const itemData = item.item_data || item.itemData;
      const variations = itemData?.variations || [];
      
      // Find the corresponding formatted item to get the image path
      const formattedItem = formattedItems.find((fi: any) => fi.id === item.id);
      
      return {
        id: item.id,
        name: itemData?.name || 'Unnamed',
        description: itemData?.description,
        imageUrl: formattedItem?.imageUrl || null,
        variations: variations.map((variation: any) => {
          const varData = variation.item_variation_data || variation.itemVariationData;
          return {
            id: variation.id,
            name: varData?.name || 'Unnamed',
            priceMoney: varData?.price_money || varData?.priceMoney,
          };
        }),
      };
    });
    
    const staticCatalog = {
      success: true,
      items: formattedItems,
      generalAdmission: generalAdmissionData,
      memberships: membershipItemsData,
      generatedAt: new Date().toISOString(),
      environment: SQUARE_ENVIRONMENT,
    };
    
    // Write to public directory for static serving
    const outputDir = path.join(projectRoot, 'public');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'square-catalog.json');
    fs.writeFileSync(outputFile, JSON.stringify(staticCatalog, null, 2), 'utf-8');
    
    console.log(`✅ Static catalog written to: ${outputFile}`);
    console.log(`   - ${formattedItems.length} items`);
    if (generalAdmissionData) {
      console.log(`   - General Admission found: ${generalAdmissionData.name}`);
    } else {
      console.log(`   ⚠️  General Admission not found`);
    }
    if (membershipItemsData.length > 0) {
      console.log(`   - ${membershipItemsData.length} membership item(s) found`);
      membershipItemsData.forEach((membership: any) => {
        console.log(`     • ${membership.name}`);
      });
    } else {
      console.log(`   ⚠️  No membership items found`);
    }
    
    return staticCatalog;
    
  } catch (error) {
    console.error('❌ Error generating static catalog:', error);
    throw error;
  }
}

async function main() {
  console.log('📦 Generating Static Square Catalog...\n');
  
  checkEnvironmentVariables();
  
  try {
    await generateStaticCatalog();
    console.log('\n✅ Static catalog generation completed successfully');
  } catch (error) {
    console.error('\n❌ Static catalog generation failed:', error);
    process.exit(1);
  }
}

main();

