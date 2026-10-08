#!/usr/bin/env tsx
/**
 * Generate TypeScript types from Contentful schema
 * 
 * This script uses Contentful Management API to generate TypeScript
 * interfaces from your Contentful content types.
 * 
 * Usage:
 *   npm run generate:types
 *   or
 *   tsx scripts/generate-contentful-types.ts
 * 
 * Environment Variables Required:
 *   - CONTENTFUL_SPACE_ID
 *   - CONTENTFUL_MANAGEMENT_TOKEN
 *   - CONTENTFUL_ENVIRONMENT_ID (optional, defaults to 'master')
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env file if it exists
// This is a simple .env parser that works without dotenv package
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
    // This can happen in CI/CD or restricted environments
    console.log('⚠️  Could not read .env file, using process.env directly');
  }
}

// Load .env file
loadEnvFile();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';
const OUTPUT_FILE = path.join(projectRoot, 'src/generated/contentful-types.ts');

function checkEnvironmentVariables() {
  const missing: string[] = [];
  
  if (!SPACE_ID) {
    missing.push('CONTENTFUL_SPACE_ID');
  }
  
  if (!MANAGEMENT_TOKEN) {
    missing.push('CONTENTFUL_MANAGEMENT_TOKEN');
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these in your .env file or environment.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  console.log(`   Space ID: ${SPACE_ID}`);
  console.log(`   Environment: ${ENVIRONMENT}`);
  return true;
}

function ensureOutputDirectory() {
  const outputDir = path.dirname(OUTPUT_FILE);
  
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
}

async function checkPackageInstalled() {
  try {
    // Check if contentful-management is available
    const packagePath = path.join(projectRoot, 'node_modules', 'contentful-management');
    if (!fs.existsSync(packagePath)) {
      console.log('⚠️  contentful-management not found');
      console.log('   Installing contentful-management...');
      console.log('   Please run: npm install --save-dev contentful-management');
      console.log('   Or we can use the contentful package if it includes Management API');
      return false;
    }
    console.log('✅ contentful-management package available');
    return true;
  } catch (error) {
    console.error('❌ Error checking for contentful-management:', error);
    return false;
  }
}

function mapContentfulTypeToTypeScript(field: any): string {
  switch (field.type) {
    case 'Symbol':
    case 'Text':
      return 'string';
    case 'Integer':
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'string'; // ISO date string
    case 'Location':
      return '{ lat: number; lon: number }';
    case 'Object':
      return 'Record<string, any>';
    case 'Array':
      if (field.items?.type === 'Link' && field.items.linkType === 'Entry') {
        return `Array<{ sys: { id: string } }>`;
      } else if (field.items?.type === 'Link' && field.items.linkType === 'Asset') {
        return `Array<{ sys: { id: string }; url?: string }>`;
      } else if (field.items?.type) {
        const itemType = mapContentfulTypeToTypeScript({ type: field.items.type, linkType: field.items.linkType });
        return `Array<${itemType}>`;
      }
      return 'Array<any>';
    case 'Link':
      if (field.linkType === 'Entry') {
        // For entry links, we'll generate a minimal type
        // Note: GraphQL queries may include additional fields like 'name'
        // These should be handled via type extensions or query-specific types
        return '{ sys: { id: string } }';
      } else if (field.linkType === 'Asset') {
        return '{ sys: { id: string }; url?: string }';
      }
      return '{ sys: { id: string } }';
    case 'RichText':
      return '{ json: any }';
    default:
      return 'any';
  }
}

async function generateTypes() {
  console.log('\n🔄 Generating TypeScript types from Contentful...');
  
  try {
    // Try to use contentful-management, fallback to contentful if needed
    let contentfulManagement;
    try {
      contentfulManagement = await import('contentful-management');
    } catch (error) {
      console.error('❌ Could not import contentful-management');
      console.error('   Please install it: npm install --save-dev contentful-management');
      process.exit(1);
    }
    
    const client = contentfulManagement.createClient({
      accessToken: MANAGEMENT_TOKEN!,
    });
    
    console.log('📡 Fetching Contentful space and environment...');
    const space = await client.getSpace(SPACE_ID!);
    const environment = await space.getEnvironment(ENVIRONMENT);
    
    console.log('📋 Fetching content types...');
    const contentTypes = await environment.getContentTypes();
    
    console.log(`✅ Found ${contentTypes.items.length} content types`);
    
    // Generate TypeScript interfaces
    console.log('🔨 Generating TypeScript interfaces...');
    const typeDefinitions: string[] = [];
    
    typeDefinitions.push(`/**
 * This file is auto-generated from Contentful schema
 * 
 * DO NOT EDIT THIS FILE MANUALLY
 * 
 * To regenerate this file, run:
 *   npm run generate:types
 * 
 * Generated: ${new Date().toISOString()}
 * Space ID: ${SPACE_ID}
 * Environment: ${ENVIRONMENT}
 */

`);
    
    // Generate interface for each content type
    for (const contentType of contentTypes.items) {
      const interfaceName = contentType.sys.id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      
      const fields: string[] = [];
      
      // Add sys field
      fields.push('  sys: {');
      fields.push('    id: string;');
      fields.push('    publishedAt?: string;');
      fields.push('    updatedAt?: string;');
      fields.push('    revision?: number;');
      fields.push('  };');
      
      // Add content fields
      for (const field of contentType.fields) {
        let fieldName = field.id;
        const isRequired = field.required;
        const optional = isRequired ? '' : '?';
        let type = mapContentfulTypeToTypeScript(field);
        
        // GraphQL API uses "Collection" suffix for linked arrays (both Entry and Asset)
        // e.g., contentView (array of entry links) becomes contentViewCollection in GraphQL
        // e.g., image (array of asset links) becomes imageCollection in GraphQL
        // We need to match the GraphQL naming convention for array link fields
        if (field.type === 'Array' && field.items?.type === 'Link') {
          if (field.items.linkType === 'Entry') {
            // Use Collection suffix to match GraphQL API
            fieldName = `${field.id}Collection`;
            
            // Try to determine the linked content type
            // If validations exist and specify a content type, use it
            let linkedTypeName = '{ sys: { id: string } }';
            if (field.items.validations && field.items.validations.length > 0) {
              const linkContentTypeValidation = field.items.validations.find(
                (v: any) => v.linkContentType
              );
              if (linkContentTypeValidation?.linkContentType) {
                // Map Contentful content type ID to our interface name
                const contentTypeIds = linkContentTypeValidation.linkContentType;
                if (contentTypeIds.length === 1) {
                  // Single content type - use its interface name
                  const linkedContentTypeId = contentTypeIds[0];
                  const linkedContentType = contentTypes.items.find(
                    (ct: any) => ct.sys.id === linkedContentTypeId
                  );
                  if (linkedContentType) {
                    const interfaceName = linkedContentType.sys.id
                      .split('-')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join('');
                    linkedTypeName = interfaceName;
                  }
                }
              }
            }
            
            // GraphQL collection structure with items array
            type = `{ items: Array<${linkedTypeName}> }`;
          } else if (field.items.linkType === 'Asset') {
            // Use Collection suffix to match GraphQL API for asset arrays
            fieldName = `${field.id}Collection`;
            // GraphQL collection structure for assets
            type = `{ items: Array<{ sys: { id: string }; url?: string }> }`;
          }
        }
        
        fields.push(`  ${fieldName}${optional}: ${type};`);
      }
      
      typeDefinitions.push(`export interface ${interfaceName} {`);
      typeDefinitions.push(...fields);
      typeDefinitions.push('}');
      typeDefinitions.push('');
    }
    
    // Write to file
    const output = typeDefinitions.join('\n');
    fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
    
    console.log('\n✅ Type generation completed successfully!');
    
    // Verify output file was created
    if (fs.existsSync(OUTPUT_FILE)) {
      const stats = fs.statSync(OUTPUT_FILE);
      console.log(`\n📊 Generated file: ${OUTPUT_FILE}`);
      console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      const lines = output.split('\n');
      console.log(`   Lines: ${lines.length}`);
      
      // Show generated interfaces
      const interfaceMatches = output.match(/export interface \w+/g);
      if (interfaceMatches) {
        console.log(`\n📦 Generated interfaces (${interfaceMatches.length}):`);
        interfaceMatches.forEach(match => {
          const name = match.replace('export interface ', '');
          console.log(`   - ${name}`);
        });
      }
    } else {
      console.error('❌ Output file was not created');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error generating types:');
    if (error.message) {
      console.error(`   ${error.message}`);
    }
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Contentful TypeScript Type Generation\n');
  console.log('='.repeat(60));
  
  // Step 1: Check environment
  checkEnvironmentVariables();
  
  // Step 2: Check package is installed
  await checkPackageInstalled();
  
  // Step 3: Ensure output directory exists
  ensureOutputDirectory();
  
  // Step 4: Generate types
  await generateTypes();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Type generation complete!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Review the generated types in src/generated/contentful-types.ts');
  console.log('2. Import and use them in your adapters');
  console.log('3. Update adapters to use generated types instead of manual annotations');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

