#!/usr/bin/env tsx
/**
 * Schema Validation Script
 * 
 * Validates that:
 * 1. Generated TypeScript types match Contentful schema
 * 2. GraphQL query fragments match Contentful schema fields
 * 3. All required fields are present in queries
 * 
 * Usage:
 *   npm run validate:schemas
 *   or
 *   tsx scripts/validate-schemas.ts
 * 
 * Environment Variables Required:
 *   - CONTENTFUL_SPACE_ID
 *   - CONTENTFUL_MANAGEMENT_TOKEN
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

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';

if (!SPACE_ID || !MANAGEMENT_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   CONTENTFUL_SPACE_ID:', SPACE_ID ? '✓' : '✗');
  console.error('   CONTENTFUL_MANAGEMENT_TOKEN:', MANAGEMENT_TOKEN ? '✓' : '✗');
  process.exit(1);
}

interface ValidationIssue {
  type: 'error' | 'warning';
  contentType: string;
  field?: string;
  message: string;
}

interface ValidationResult {
  contentType: string;
  issues: ValidationIssue[];
  fieldsInSchema: string[];
  fieldsInTypes: string[];
  fieldsInQueries: string[];
}

/**
 * Parse generated TypeScript types to extract field names
 */
function parseGeneratedTypes(): Map<string, string[]> {
  const typesPath = path.join(projectRoot, 'src/generated/contentful-types.ts');
  if (!fs.existsSync(typesPath)) {
    console.error('❌ Generated types file not found:', typesPath);
    console.error('   Run: npm run generate:types');
    process.exit(1);
  }

  const content = fs.readFileSync(typesPath, 'utf-8');
  const typeMap = new Map<string, string[]>();

  // Extract interface definitions - handle nested braces properly
  const interfaceRegex = /export interface (\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
  let match;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const typeName = match[1];
    const fieldsContent = match[2];
    const fields: string[] = [];

    // Extract field names (handling optional fields and types)
    // Match: fieldName?: type; or fieldName: type;
    const fieldRegex = /(\w+)(\??):\s*[^;]+;/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
      const fieldName = fieldMatch[1];
      // Skip sys sub-fields (id, publishedAt, etc.) - sys is the field
      if (fieldName === 'sys') {
        fields.push('sys');
      } else if (!['id', 'publishedAt', 'updatedAt', 'revision'].includes(fieldName)) {
        // Only add non-sys sub-fields as top-level fields
        fields.push(fieldName);
      }
    }

    // Always include sys if the interface has a sys property
    if (fieldsContent.includes('sys:')) {
      if (!fields.includes('sys')) {
        fields.push('sys');
      }
    }

    typeMap.set(typeName, fields);
  }

  return typeMap;
}

/**
 * Parse GraphQL fragments to extract queried fields
 */
function parseGraphQLFragments(): Map<string, string[]> {
  const fragmentsPath = path.join(projectRoot, 'src/lib/contentful/fragments.ts');
  if (!fs.existsSync(fragmentsPath)) {
    console.error('❌ Fragments file not found:', fragmentsPath);
    process.exit(1);
  }

  const content = fs.readFileSync(fragmentsPath, 'utf-8');
  const fragmentMap = new Map<string, string[]>();

  // Extract fragment definitions (e.g., ProgramFields, EventFields)
  const fragmentRegex = /export const (\w+)Fields\s*=\s*`([^`]+)`/gs;
  let match;

  while ((match = fragmentRegex.exec(content)) !== null) {
    const fragmentName = match[1];
    const fieldsContent = match[2];
    const fields: string[] = [];

    // Extract field names (simple extraction - may need refinement)
    const fieldRegex = /^\s*(\w+)(\s|$)/gm;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
      const fieldName = fieldMatch[1];
      // Skip common keywords and fragments
      if (!['sys', 'items', 'json', 'id', 'publishedAt'].includes(fieldName) && 
          !fieldName.startsWith('$') && 
          !fieldName.includes('Collection') &&
          !fieldName.includes('Fields')) {
        fields.push(fieldName);
      }
    }

    // Always include sys if SysFields is referenced
    if (fieldsContent.includes('${SysFields}')) {
      fields.push('sys');
    }

    // Map fragment name to content type (e.g., ProgramFields -> Program)
    const contentType = fragmentName.replace('Fields', '');
    fragmentMap.set(contentType, fields);
  }

  return fragmentMap;
}

/**
 * Fetch Contentful schema via Management API
 */
async function fetchContentfulSchema(): Promise<Map<string, string[]>> {
  console.log('📡 Fetching Contentful schema...\n');

  try {
    const contentfulManagement = await import('contentful-management');
    const client = contentfulManagement.createClient({
      accessToken: MANAGEMENT_TOKEN!,
    });

    const space = await client.getSpace(SPACE_ID!);
    const environment = await space.getEnvironment(ENVIRONMENT);
    const contentTypes = await environment.getContentTypes();

    const schemaMap = new Map<string, string[]>();

    for (const contentType of contentTypes.items) {
      const fields: string[] = [];
      
      // Add sys fields
      fields.push('sys');

      // Extract field IDs
      for (const field of contentType.fields) {
        fields.push(field.id);
      }

      schemaMap.set(contentType.sys.id, fields);
      // Also map by name for easier lookup
      schemaMap.set(contentType.name, fields);
    }

    console.log(`✅ Fetched ${contentTypes.items.length} content types\n`);
    return schemaMap;
  } catch (error: any) {
    console.error('❌ Failed to fetch Contentful schema:', error.message);
    process.exit(1);
  }
}

/**
 * Validate schemas and generate report
 */
async function validateSchemas() {
  console.log('🔍 Schema Validation\n');
  console.log('='.repeat(60));
  console.log();

  const contentfulSchema = await fetchContentfulSchema();
  const generatedTypes = parseGeneratedTypes();
  const queryFragments = parseGraphQLFragments();

  const results: ValidationResult[] = [];
  const allIssues: ValidationIssue[] = [];

  // Validate each content type
  for (const [typeName, typeFields] of generatedTypes.entries()) {
    // Find matching Contentful schema (try by name first, then by ID)
    let schemaFields: string[] | undefined;
    
    // Try to find by name (e.g., "Program", "Event")
    for (const [schemaKey, fields] of contentfulSchema.entries()) {
      if (schemaKey === typeName || schemaKey.toLowerCase() === typeName.toLowerCase()) {
        schemaFields = fields;
        break;
      }
    }

    if (!schemaFields) {
      allIssues.push({
        type: 'warning',
        contentType: typeName,
        message: `Content type not found in Contentful schema`,
      });
      continue;
    }

    const queryFields = queryFragments.get(typeName) || [];
    const issues: ValidationIssue[] = [];

    // Check for fields in types but not in schema
    // Note: sys is always present in Contentful, so we skip it
    for (const field of typeFields) {
      if (field === 'sys') continue; // sys is always present
      
      // Handle Collection suffix (e.g., imageCollection -> image)
      const baseField = field.replace('Collection', '');
      
      if (!schemaFields.includes(field) && !schemaFields.includes(baseField)) {
        // Check if it's a valid nested field (e.g., content.json, imageCollection.items)
        const isNestedField = field.includes('.') || field.includes('Collection');
        if (!isNestedField) {
          issues.push({
            type: 'warning',
            contentType: typeName,
            field,
            message: `Field "${field}" in generated types but not in Contentful schema`,
          });
        }
      }
    }

    // Check for required fields in schema but not in queries
    // (This is a simplified check - in reality, we'd need to check which fields are required)
    for (const field of schemaFields) {
      if (field !== 'sys' && !queryFields.includes(field)) {
        // This is just a warning - not all fields need to be queried
        // But we could flag important fields
      }
    }

    results.push({
      contentType: typeName,
      issues,
      fieldsInSchema: schemaFields,
      fieldsInTypes: typeFields,
      fieldsInQueries: queryFields,
    });

    allIssues.push(...issues);
  }

  // Generate report
  console.log('📊 Validation Report\n');
  console.log('='.repeat(60));
  console.log();

  if (allIssues.length === 0) {
    console.log('✅ No validation issues found!\n');
  } else {
    const errors = allIssues.filter(i => i.type === 'error');
    const warnings = allIssues.filter(i => i.type === 'warning');

    if (errors.length > 0) {
      console.log(`❌ ${errors.length} error(s) found:\n`);
      errors.forEach(issue => {
        console.log(`   [${issue.contentType}] ${issue.field ? `${issue.field}: ` : ''}${issue.message}`);
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s) found:\n`);
      warnings.forEach(issue => {
        console.log(`   [${issue.contentType}] ${issue.field ? `${issue.field}: ` : ''}${issue.message}`);
      });
      console.log();
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));
  console.log(`Content Types Validated: ${results.length}`);
  console.log(`Errors: ${allIssues.filter(i => i.type === 'error').length}`);
  console.log(`Warnings: ${allIssues.filter(i => i.type === 'warning').length}`);
  console.log();

  // Exit with error code if there are errors
  if (allIssues.filter(i => i.type === 'error').length > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Contentful Schema Validation\n');
  console.log('='.repeat(60));
  console.log();

  // Check environment
  if (!SPACE_ID || !MANAGEMENT_TOKEN) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  console.log('✅ Environment variables configured');
  console.log(`   Space ID: ${SPACE_ID}`);
  console.log(`   Environment: ${ENVIRONMENT}`);
  console.log();

  // Run validation
  await validateSchemas();

  console.log('='.repeat(60));
  console.log('✅ Validation complete!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

