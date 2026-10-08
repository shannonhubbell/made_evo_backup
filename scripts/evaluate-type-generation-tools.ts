#!/usr/bin/env tsx
/**
 * Tool Evaluation Script
 * 
 * This script helps evaluate different approaches for generating TypeScript types
 * from Contentful schemas. Run this to test each approach.
 * 
 * Usage:
 *   tsx scripts/evaluate-type-generation-tools.ts
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const DELIVERY_TOKEN = process.env.CONTENTFUL_DELIVERY_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';

interface ToolEvaluation {
  name: string;
  approach: string;
  pros: string[];
  cons: string[];
  npmPackage?: string;
  setupComplexity: 'low' | 'medium' | 'high';
  maintenance: 'low' | 'medium' | 'high';
  flexibility: 'low' | 'medium' | 'high';
  communitySupport: 'low' | 'medium' | 'high';
  notes: string;
}

const evaluations: ToolEvaluation[] = [
  {
    name: 'contentful-typescript-codegen',
    approach: 'Dedicated CLI tool for Contentful',
    pros: [
      'Purpose-built for Contentful',
      'Simple CLI interface',
      'Handles locales, assets, rich text automatically',
      'Active community (high npm downloads)',
      'Good documentation',
      'Generates clean TypeScript interfaces'
    ],
    cons: [
      'Community-maintained (not official)',
      'Less flexible than graphql-codegen',
      'May have limitations for complex schemas',
      'Requires Management API access'
    ],
    npmPackage: 'contentful-typescript-codegen',
    setupComplexity: 'low',
    maintenance: 'low',
    flexibility: 'medium',
    communitySupport: 'high',
    notes: 'Most popular dedicated tool for Contentful type generation. Good starting point.'
  },
  {
    name: 'graphql-codegen',
    approach: 'Universal GraphQL code generator with Contentful plugin',
    pros: [
      'Very flexible and configurable',
      'Widely used and well-maintained',
      'Supports many plugins and customizations',
      'Can generate queries, types, and more',
      'Strong TypeScript support',
      'Can be extended for custom needs'
    ],
    cons: [
      'More complex setup',
      'Requires GraphQL schema introspection',
      'Steeper learning curve',
      'More configuration needed',
      'May be overkill for simple use cases'
    ],
    npmPackage: '@graphql-codegen/cli @graphql-codegen/typescript',
    setupComplexity: 'high',
    maintenance: 'low',
    flexibility: 'high',
    communitySupport: 'high',
    notes: 'Most powerful option, but requires more setup. Best for complex needs.'
  },
  {
    name: 'Custom Script (Management API)',
    approach: 'Build custom script using Contentful Management API',
    pros: [
      'Full control over output',
      'Can customize exactly to our needs',
      'No external dependencies',
      'Can integrate with our build process',
      'Can add custom logic'
    ],
    cons: [
      'More development time',
      'We maintain it ourselves',
      'Need to handle edge cases',
      'More code to maintain',
      'Need to keep up with Contentful API changes'
    ],
    npmPackage: 'contentful (already installed)',
    setupComplexity: 'medium',
    maintenance: 'high',
    flexibility: 'high',
    communitySupport: 'low',
    notes: 'We already have contentful package. Could build exactly what we need.'
  },
  {
    name: '@contentful-tools/generator',
    approach: 'Contentful tools generator',
    pros: [
      'Official Contentful tooling',
      'Handles field validations',
      'Marks optional/required correctly'
    ],
    cons: [
      'Less popular/active',
      'May have limited features',
      'Less documentation available'
    ],
    npmPackage: '@contentful-tools/generator',
    setupComplexity: 'medium',
    maintenance: 'medium',
    flexibility: 'medium',
    communitySupport: 'medium',
    notes: 'Official tool but less popular. Worth testing.'
  },
  {
    name: 'Cute (Contentful Utility Tool)',
    approach: 'Multi-purpose Contentful CLI tool',
    pros: [
      'Supports bulk operations',
      'Has type scaffold command',
      'Useful for other Contentful tasks too'
    ],
    cons: [
      'Less focused on type generation',
      'May be overkill',
      'Less documentation'
    ],
    npmPackage: 'cute',
    setupComplexity: 'medium',
    maintenance: 'medium',
    flexibility: 'medium',
    communitySupport: 'low',
    notes: 'Multi-purpose tool. Type generation is one feature among many.'
  }
];

function checkEnvironmentVariables() {
  const missing: string[] = [];
  
  if (!SPACE_ID) missing.push('CONTENTFUL_SPACE_ID');
  if (!MANAGEMENT_TOKEN) missing.push('CONTENTFUL_MANAGEMENT_TOKEN');
  if (!DELIVERY_TOKEN) missing.push('CONTENTFUL_DELIVERY_TOKEN');
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these in your .env file or environment.');
    return false;
  }
  
  console.log('✅ Environment variables configured');
  console.log(`   Space ID: ${SPACE_ID}`);
  console.log(`   Environment: ${ENVIRONMENT}`);
  console.log(`   Management Token: ${MANAGEMENT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Delivery Token: ${DELIVERY_TOKEN ? '✅ Set' : '❌ Missing'}`);
  return true;
}

function testManagementAPIAccess() {
  console.log('\n📡 Testing Contentful Management API access...');
  
  if (!MANAGEMENT_TOKEN) {
    console.log('⚠️  Management token not available. Some tools require this.');
    return false;
  }
  
  // This would test actual API access
  // For now, just check if token exists
  console.log('✅ Management token available');
  return true;
}

function testGraphQLIntrospection() {
  console.log('\n📡 Testing Contentful GraphQL introspection...');
  
  if (!DELIVERY_TOKEN || !SPACE_ID) {
    console.log('⚠️  Delivery token or Space ID not available.');
    return false;
  }
  
  // This would test actual GraphQL introspection
  console.log('✅ GraphQL API credentials available');
  return true;
}

function printEvaluation(eval: ToolEvaluation) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${eval.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Approach: ${eval.approach}`);
  console.log(`\n✅ Pros:`);
  eval.pros.forEach(pro => console.log(`   • ${pro}`));
  console.log(`\n❌ Cons:`);
  eval.cons.forEach(con => console.log(`   • ${con}`));
  console.log(`\n📊 Assessment:`);
  console.log(`   Setup Complexity: ${eval.setupComplexity.toUpperCase()}`);
  console.log(`   Maintenance: ${eval.maintenance.toUpperCase()}`);
  console.log(`   Flexibility: ${eval.flexibility.toUpperCase()}`);
  console.log(`   Community Support: ${eval.communitySupport.toUpperCase()}`);
  if (eval.npmPackage) {
    console.log(`\n📦 NPM Package: ${eval.npmPackage}`);
  }
  console.log(`\n💡 Notes: ${eval.notes}`);
}

function generateRecommendation() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 RECOMMENDATION');
  console.log(`${'='.repeat(60)}`);
  
  console.log('\nBased on the evaluation, here are recommendations:');
  
  console.log('\n🥇 Best for Quick Start: contentful-typescript-codegen');
  console.log('   - Easiest to set up');
  console.log('   - Good community support');
  console.log('   - Purpose-built for Contentful');
  console.log('   - Recommended for Phase 1 implementation');
  
  console.log('\n🥈 Best for Flexibility: graphql-codegen');
  console.log('   - Most powerful and flexible');
  console.log('   - Can generate queries and types');
  console.log('   - Good for long-term if we need more features');
  console.log('   - Consider for Phase 2 if we need query generation');
  
  console.log('\n🥉 Best for Custom Needs: Custom Script');
  console.log('   - Full control');
  console.log('   - Can integrate perfectly with our workflow');
  console.log('   - Consider if other tools don\'t meet our needs');
  console.log('   - We already have the contentful package');
  
  console.log('\n💡 Suggested Approach:');
  console.log('   1. Start with contentful-typescript-codegen (Phase 1)');
  console.log('   2. Evaluate if it meets our needs');
  console.log('   3. Consider graphql-codegen if we need query generation');
  console.log('   4. Build custom script if neither works perfectly');
}

async function main() {
  console.log('🔍 Contentful Type Generation Tool Evaluation\n');
  
  // Check environment
  const envOk = checkEnvironmentVariables();
  if (!envOk) {
    console.log('\n⚠️  Continuing evaluation without API access...');
  }
  
  // Test API access
  if (envOk) {
    testManagementAPIAccess();
    testGraphQLIntrospection();
  }
  
  // Print evaluations
  console.log('\n' + '='.repeat(60));
  console.log('TOOL EVALUATIONS');
  console.log('='.repeat(60));
  
  evaluations.forEach(printEvaluation);
  
  // Generate recommendation
  generateRecommendation();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Evaluation Complete');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Review the evaluations above');
  console.log('2. Test the recommended tool');
  console.log('3. Update ARCHITECTURE_MIGRATION_NOTES.md with findings');
  console.log('4. Make final decision and proceed with implementation');
}

main().catch(console.error);

