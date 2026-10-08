#!/usr/bin/env tsx
/**
 * Test Figma Page Component Variants
 * 
 * Finds the "Page" component in the "Pages" canvas and extracts data from each variant.
 * Each variant represents a different Contentful Page entry.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Load environment variables
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
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
    console.warn('Could not load .env file, using process.env');
    return process.env as Record<string, string>;
  }
}

const env = loadEnv();

// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_ACCESS_TOKEN = env.FIGMA_ACCESS_TOKEN || env.FIGMA_PAT || env.FIGMA_CLIENT_SECRET || env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = env.FIGMA_FILE_KEY;

// Cache configuration
const CACHE_DIR = join(process.cwd(), 'local');
const CACHE_FILE = join(CACHE_DIR, `figma-pages-cache-${FIGMA_FILE_KEY || 'default'}.json`);

/**
 * Make authenticated request to Figma API
 */
async function figmaRequest(endpoint: string, options: RequestInit = {}) {
  if (!FIGMA_ACCESS_TOKEN) {
    throw new Error('FIGMA_ACCESS_TOKEN not found in .env');
  }

  const url = `${FIGMA_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Figma-Token': FIGMA_ACCESS_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Figma API error (${response.status}): ${response.statusText}\n${errorText}`
    );
  }

  return response.json();
}

/**
 * Recursively find a node by name in the tree
 */
function findNodeByName(nodes: any[], name: string, type?: string): any | null {
  for (const node of nodes) {
    if (node.name === name && (!type || node.type === type)) {
      return node;
    }
    if (node.children && Array.isArray(node.children)) {
      const found = findNodeByName(node.children, name, type);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find all instances of a component
 */
function findComponentInstances(nodes: any[], componentId?: string): any[] {
  const instances: any[] = [];
  
  function traverse(node: any) {
    if (node.type === 'INSTANCE') {
      // If componentId is specified, only match that component
      if (!componentId || node.componentId === componentId) {
        instances.push(node);
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return instances;
}

/**
 * Extract variant properties from a component instance
 */
function extractVariantProperties(instance: any): Record<string, any> {
  const properties: Record<string, any> = {};
  
  // Component properties are stored in componentProperties
  if (instance.componentProperties) {
    for (const [key, value] of Object.entries(instance.componentProperties)) {
      properties[key] = value;
    }
  }
  
  // Overrides can also contain variant information
  if (instance.overrides && Array.isArray(instance.overrides)) {
    for (const override of instance.overrides) {
      if (override.overriddenFields) {
        // Overrides might indicate which variant properties are set
        properties[override.id] = override.overriddenFields;
      }
    }
  }
  
  return properties;
}

/**
 * Extract text content from a node recursively
 */
function extractTexts(node: any): Array<{ content: string; nodeId: string; style?: any }> {
  const texts: Array<{ content: string; nodeId: string; style?: any }> = [];
  
  function traverse(n: any) {
    if (n.type === 'TEXT' && n.characters) {
      texts.push({
        content: n.characters,
        nodeId: n.id,
        style: n.style,
      });
    }
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return texts;
}

/**
 * Load cached data if it exists
 */
function loadCache(): any | null {
  if (!existsSync(CACHE_FILE)) {
    return null;
  }
  
  try {
    const cacheContent = readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheContent);
    
    // Check if cache is still valid (optional: add timestamp check)
    if (cache.fileKey === FIGMA_FILE_KEY) {
      console.log(`📦 Loading cached data from ${CACHE_FILE}`);
      return cache;
    }
  } catch (error) {
    console.warn(`⚠️  Could not load cache: ${error instanceof Error ? error.message : error}`);
  }
  
  return null;
}

/**
 * Save data to cache
 */
function saveCache(data: any) {
  try {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    const cacheData = {
      fileKey: FIGMA_FILE_KEY,
      timestamp: new Date().toISOString(),
      ...data,
    };
    
    writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`💾 Cached data saved to ${CACHE_FILE}`);
  } catch (error) {
    console.warn(`⚠️  Could not save cache: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Get detailed node information including children
 * Batches requests to avoid URL length limits (max ~200-300 IDs per request)
 */
async function getNodeDetails(fileKey: string, nodeIds: string[], batchSize = 200) {
  if (nodeIds.length === 0) {
    return { nodes: {} };
  }
  
  // Batch the requests
  const batches: string[][] = [];
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    batches.push(nodeIds.slice(i, i + batchSize));
  }
  
  const allNodes: Record<string, any> = {};
  
  // Fetch each batch
  for (const batch of batches) {
    const idsParam = batch.join(',');
    const data = await figmaRequest(`/files/${fileKey}/nodes?ids=${idsParam}`);
    if (data.nodes) {
      Object.assign(allNodes, data.nodes);
    }
  }
  
  return { nodes: allNodes };
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Finding Page Component Variants\n');
  console.log('='.repeat(60));
  
  // Check credentials
  if (!FIGMA_ACCESS_TOKEN) {
    console.error('❌ Error: FIGMA_ACCESS_TOKEN not found');
    process.exit(1);
  }
  
  if (!FIGMA_FILE_KEY) {
    console.error('❌ Error: FIGMA_FILE_KEY not found in .env');
    console.log('\nPlease add to your .env file:');
    console.log('  FIGMA_FILE_KEY=your_file_key_here');
    process.exit(1);
  }
  
  console.log(`✓ Using file key: ${FIGMA_FILE_KEY}\n`);
  
  try {
    // Check for cached data first
    const cachedData = loadCache();
    
    let fileData: any;
    let pagesCanvasDetailed: any;
    let matchingComponentIds: Set<string>;
    let instances: any[] = [];
    
    if (cachedData && cachedData.fileData && cachedData.pagesCanvasDetailed) {
      console.log('📦 Using cached data (skip Figma API calls)\n');
      fileData = cachedData.fileData;
      pagesCanvasDetailed = cachedData.pagesCanvasDetailed;
      matchingComponentIds = new Set(cachedData.matchingComponentIds || []);
      instances = cachedData.instances || [];
      
      console.log('1. ✓ File structure loaded from cache');
      console.log('2. ✓ Pages canvas loaded from cache');
      console.log('3. ✓ Component set loaded from cache');
      console.log(`4. ✓ Found ${instances.length} Page instance(s) from cache\n`);
    } else {
      // 1. Get the file structure
      console.log('1. Fetching file structure from Figma API...');
      fileData = await figmaRequest(`/files/${FIGMA_FILE_KEY}`);
    
    if (!fileData.document || !fileData.document.children) {
      throw new Error('Invalid file structure');
    }
    
    // 2. Find the "Pages" canvas/page
    console.log('2. Looking for "Pages" canvas...');
    const pagesCanvas = findNodeByName(fileData.document.children, 'Pages', 'CANVAS');
    
    if (!pagesCanvas) {
      console.error('❌ Could not find "Pages" canvas');
      console.log('\nAvailable top-level nodes:');
      fileData.document.children.forEach((child: any) => {
        console.log(`  - ${child.name} (${child.type})`);
      });
      process.exit(1);
    }
    
    console.log(`✓ Found "Pages" canvas (ID: ${pagesCanvas.id})`);
    console.log(`  Has ${pagesCanvas.children?.length || 0} children\n`);
    
    // 3. Get detailed information about the Pages canvas and its children
    console.log('3. Fetching detailed node information...');
    const nodeIds = [pagesCanvas.id, ...(pagesCanvas.children?.map((c: any) => c.id) || [])];
    const nodesData = await getNodeDetails(FIGMA_FILE_KEY, nodeIds);
    
    // Extract the Pages canvas node with full details
    const pagesCanvasDetailed = nodesData.nodes[pagesCanvas.id]?.document;
    if (!pagesCanvasDetailed) {
      throw new Error('Could not get detailed Pages canvas data');
    }
    
      // 4. Find the "Page" component definition
      console.log('4. Looking for "Page" component...');
      
      // First, check if there's a component set or component in the file metadata
      let pageComponentId: string | undefined;
      let pageComponentSetId: string | undefined;
      
      // Check in components metadata
      if (fileData.components) {
        for (const [compId, comp] of Object.entries(fileData.components as Record<string, any>)) {
          if (comp.name === 'Page') {
            pageComponentId = compId;
            console.log(`✓ Found "Page" component definition (ID: ${compId})`);
          }
        }
      }
      
      // Check in componentSets metadata (for variants)
      if (fileData.componentSets) {
        for (const [setId, compSet] of Object.entries(fileData.componentSets as Record<string, any>)) {
          if (compSet.name === 'Page') {
            pageComponentSetId = setId;
            console.log(`✓ Found "Page" component set (ID: ${setId})`);
          }
        }
      }
      
      // Also search in the Pages canvas for component definitions
      const pageComponent = findNodeByName(
        pagesCanvasDetailed.children || [],
        'Page',
        'COMPONENT'
      ) || findNodeByName(
        pagesCanvasDetailed.children || [],
        'Page',
        'COMPONENT_SET'
      );
      
      if (pageComponent) {
        if (pageComponent.type === 'COMPONENT_SET') {
          pageComponentSetId = pageComponent.id;
          console.log(`✓ Found "Page" component set in canvas (ID: ${pageComponent.id})`);
          // Component sets contain component children - get the main component ID
          if (pageComponent.children && pageComponent.children.length > 0) {
            // The first child or a specific child might be the main component
            // For now, we'll use instances that match any component in the set
            console.log(`  Component set has ${pageComponent.children.length} variant(s)`);
          }
        } else {
          pageComponentId = pageComponent.id;
          console.log(`✓ Found "Page" component in canvas (ID: ${pageComponent.id})`);
        }
      }
      
      if (!pageComponentId && !pageComponentSetId && !pageComponent) {
        console.warn('⚠️  Could not find "Page" component definition');
        console.log('\nAvailable components in Pages canvas:');
        function listComponents(nodes: any[], indent = '  ') {
          for (const node of nodes) {
            if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
              console.log(`${indent}- ${node.name} (${node.type}) - ID: ${node.id}`);
            }
            if (node.children) {
              listComponents(node.children, indent + '  ');
            }
          }
        }
        listComponents(pagesCanvasDetailed.children || []);
      }
      
      // Collect all possible component IDs to match
      matchingComponentIds = new Set<string>();
      if (pageComponentId) matchingComponentIds.add(pageComponentId);
      if (pageComponentSetId) matchingComponentIds.add(pageComponentSetId);
      
      // If we found a component set, we need to get its children to find all variant component IDs
      if (pageComponentSetId) {
        const componentSetDetails = await getNodeDetails(FIGMA_FILE_KEY, [pageComponentSetId]);
        const componentSetNode = componentSetDetails.nodes[pageComponentSetId]?.document;
        if (componentSetNode && componentSetNode.children) {
          for (const child of componentSetNode.children) {
            if (child.type === 'COMPONENT') {
              matchingComponentIds.add(child.id);
              console.log(`  Found variant component: ${child.name} (ID: ${child.id})`);
            }
          }
        }
      }
    
    // 5. Find all instances of the Page component
    console.log('\n5. Finding Page component instances (variants)...');
    
    // Instead of fetching all 2000+ nodes, let's be smarter:
    // Look at the top-level children first, then only fetch what we need
    const topLevelChildren = pagesCanvasDetailed.children || [];
    console.log(`  Pages canvas has ${topLevelChildren.length} top-level child(ren)`);
    
    // Collect instance node IDs from the structure we already have
    const instanceNodeIds: string[] = [];
    function findInstanceIds(nodes: any[], depth = 0) {
      for (const node of nodes) {
        if (node.type === 'INSTANCE') {
          // Match if componentId matches any of our target component IDs
          if (matchingComponentIds.size === 0 || matchingComponentIds.has(node.componentId)) {
            instanceNodeIds.push(node.id);
          }
        }
        // Only recurse a few levels deep to avoid collecting everything
        if (node.children && depth < 5) {
          findInstanceIds(node.children, depth + 1);
        }
      }
    }
    
    findInstanceIds(topLevelChildren);
    console.log(`  Found ${instanceNodeIds.length} potential Page instance(s) in structure`);
    
    if (instanceNodeIds.length === 0) {
      console.log('  No instances found in initial scan. The instances might be nested deeper.');
      console.log('  Note: To avoid rate limits, we\'re only scanning top-level structure.');
      console.log('  Consider fetching specific frames if you know where the pages are located.\n');
    } else {
      // Get detailed information only for the instances we found
      console.log(`  Fetching details for ${instanceNodeIds.length} instance(s)...`);
      const allNodesData = await getNodeDetails(FIGMA_FILE_KEY, instanceNodeIds);
    
      // Extract instances from the fetched data (reassign to outer scope variable)
      instances = [];
      
      for (const nodeId of instanceNodeIds) {
        const nodeData = allNodesData.nodes[nodeId];
        if (nodeData) {
          const node = nodeData.document;
          if (node && node.type === 'INSTANCE') {
            instances.push({ ...node, _nodeId: nodeId });
          }
        }
      }
      
      console.log(`✓ Found ${instances.length} Page instance(s)\n`);
      
      // Cache all the data we fetched
      saveCache({
        fileData,
        pagesCanvasDetailed,
        matchingComponentIds: Array.from(matchingComponentIds),
        instances,
      });
    }
    }
    
    // 6. Extract data from each variant
    console.log('\n6. Extracting data from each variant...\n');
    console.log('='.repeat(60));
    
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      const instanceNodeId = instance._nodeId || instance.id;
      
      console.log(`\n📄 Variant ${i + 1}: ${instance.name || 'Unnamed'}`);
      console.log(`   Instance ID: ${instanceNodeId}`);
      console.log(`   Component ID: ${instance.componentId}`);
      
      // Get full instance details with children
      // If we have cached data, the instance should already have full details
      let instanceNode = instance;
      
      // If we need to fetch details (not in cache or incomplete), do so
      if (!instanceNode.children || !instanceNode.componentProperties) {
        console.log(`   Fetching full instance details...`);
        const instanceDetails = await getNodeDetails(FIGMA_FILE_KEY, [instanceNodeId]);
        instanceNode = instanceDetails.nodes[instanceNodeId]?.document || instanceNode;
      }
      
      if (instanceNode) {
        // Extract variant properties
        const variantProps = extractVariantProperties(instanceNode);
        if (Object.keys(variantProps).length > 0) {
          console.log(`   Variant Properties:`);
          for (const [key, value] of Object.entries(variantProps)) {
            console.log(`     - ${key}: ${JSON.stringify(value)}`);
          }
        }
        
        // Extract texts
        const texts = extractTexts(instanceNode);
        if (texts.length > 0) {
          console.log(`   Text Content (${texts.length} text node(s)):`);
          texts.slice(0, 20).forEach((text, idx) => {
            console.log(`     ${idx + 1}. "${text.content.substring(0, 100)}${text.content.length > 100 ? '...' : ''}"`);
            if (text.style) {
              console.log(`        Style: ${text.style.fontSize}px ${text.style.fontFamily || ''}`);
            }
          });
          if (texts.length > 20) {
            console.log(`     ... and ${texts.length - 20} more text node(s)`);
          }
        }
        
        // Show layout info
        if (instanceNode.absoluteBoundingBox) {
          const bbox = instanceNode.absoluteBoundingBox;
          console.log(`   Dimensions: ${bbox.width} × ${bbox.height}`);
        }
        
        // Show children count
        if (instanceNode.children) {
          console.log(`   Children: ${instanceNode.children.length} node(s)`);
        }
      }
      
      console.log('-'.repeat(60));
    }
    
    console.log(`\n✅ Successfully extracted data from ${instances.length} variant(s)`);
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as testFigmaPageVariants };

