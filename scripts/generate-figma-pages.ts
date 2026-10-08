#!/usr/bin/env tsx
/**
 * Generate Test Pages from Figma Components
 * 
 * Reads cached Figma data and generates Astro pages in src/pages/conversion/
 * that use Figma components as content sources and map them to our widgets.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

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
const FIGMA_FILE_KEY = env.FIGMA_FILE_KEY || 'IKAgwheFeuzTfGkP4qEpUe';
const FIGMA_ACCESS_TOKEN = env.FIGMA_ACCESS_TOKEN || env.FIGMA_PAT || env.FIGMA_CLIENT_SECRET || env.FIGMA_TOKEN;
const CACHE_FILE = join(projectRoot, 'local', `figma-pages-cache-${FIGMA_FILE_KEY}.json`);
const OUTPUT_DIR = join(projectRoot, 'src', 'pages', 'conversion');
const FIGMA_IMAGES_DIR = join(projectRoot, 'local', 'figma-references');
const FIGMA_API_BASE = 'https://api.figma.com/v1';

/**
 * Load cached Figma data
 */
function loadCache() {
  if (!existsSync(CACHE_FILE)) {
    throw new Error(`Cache file not found: ${CACHE_FILE}\nRun 'npm run test:figma-pages' first to generate cache.`);
  }
  
  const cacheContent = readFileSync(CACHE_FILE, 'utf-8');
  return JSON.parse(cacheContent);
}

/**
 * Fetch image URL from Figma API for a node
 */
async function getFigmaImageUrl(nodeId: string, format: 'png' | 'jpg' = 'png', scale: number = 2): Promise<string | null> {
  if (!FIGMA_ACCESS_TOKEN) {
    console.warn('⚠️  No Figma access token found, skipping image fetch');
    return null;
  }
  
  try {
    const url = `${FIGMA_API_BASE}/images/${FIGMA_FILE_KEY}?ids=${nodeId}&format=${format}&scale=${scale}`;
    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': FIGMA_ACCESS_TOKEN,
      },
    });
    
    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch image for node ${nodeId}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.images && data.images[nodeId]) {
      return data.images[nodeId];
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️  Error fetching image for node ${nodeId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Download image from URL and save to public folder
 */
async function downloadImage(imageUrl: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.warn(`⚠️  Error downloading image to ${outputPath}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Extract text content from a Figma node recursively
 */
function extractTexts(node: any): Array<{ content: string; style?: any; nodeId: string }> {
  const texts: Array<{ content: string; style?: any; nodeId: string }> = [];
  
  function traverse(n: any) {
    if (n.type === 'TEXT' && n.characters) {
      texts.push({
        content: n.characters,
        style: n.style,
        nodeId: n.id,
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
 * Extract images from a Figma node recursively
 */
function extractImages(node: any): Array<{ nodeId: string; width?: number; height?: number }> {
  const images: Array<{ nodeId: string; width?: number; height?: number }> = [];
  
  function traverse(n: any) {
    if (n.type === 'IMAGE') {
      images.push({
        nodeId: n.id,
        width: n.absoluteBoundingBox?.width,
        height: n.absoluteBoundingBox?.height,
      });
    }
    if (n.fills && Array.isArray(n.fills)) {
      for (const fill of n.fills) {
        if (fill.type === 'IMAGE' && fill.imageRef) {
          images.push({
            nodeId: n.id,
            width: n.absoluteBoundingBox?.width,
            height: n.absoluteBoundingBox?.height,
          });
        }
      }
    }
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  
  traverse(node);
  return images;
}

/**
 * Detect widget type from Figma component name and structure
 */
function detectWidgetFromFigma(componentName: string, node: any): string | null {
  const nameLower = componentName.toLowerCase();
  const texts = extractTexts(node);
  const images = extractImages(node);
  
  // Check component name patterns
  if (nameLower.includes('splash') || nameLower.includes('hero') || nameLower.includes('header')) {
    return 'splash';
  }
  if (nameLower.includes('grid') || nameLower.includes('card grid')) {
    return 'textGrid';
  }
  if (nameLower.includes('timeline') || nameLower.includes('vertical')) {
    return 'verticalTimeline';
  }
  if (nameLower.includes('calendar')) {
    return 'calendar';
  }
  if (nameLower.includes('report') || nameLower.includes('graph') || nameLower.includes('chart')) {
    return 'report';
  }
  if (nameLower.includes('store') || nameLower.includes('shop')) {
    return 'store';
  }
  if (nameLower.includes('double column') || nameLower.includes('two column')) {
    return 'doubleColumn';
  }
  if (nameLower.includes('single column') || nameLower.includes('one column')) {
    return 'singleColumn';
  }
  
  // Check structure patterns
  if (images.length > 0 && texts.length > 0) {
    const hasLargeHeading = texts.some(t => (t.style?.fontSize || 0) >= 32);
    if (hasLargeHeading && images.length > 0) {
      return 'splash';
    }
  }
  
  // Check for grid-like structures
  if (node.children && Array.isArray(node.children)) {
    const childCount = node.children.length;
    if (childCount >= 3 && childCount <= 12) {
      // Could be a grid
      const hasMultipleTexts = texts.length >= childCount;
      if (hasMultipleTexts) {
        return 'textGrid';
      }
    }
  }
  
  return null;
}

/**
 * Generate Astro page content from Figma variant
 */
function generatePageContent(variantName: string, instance: any): string {
  const texts = extractTexts(instance);
  const images = extractImages(instance);
  const widgetType = detectWidgetFromFigma(instance.name || '', instance) || 'singleColumn';
  
  // Sanitize variant name for file path
  const sanitizedName = variantName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Extract main heading (largest text)
  const headings = texts
    .filter(t => (t.style?.fontSize || 0) >= 24)
    .sort((a, b) => (b.style?.fontSize || 0) - (a.style?.fontSize || 0));
  const mainHeading = headings[0]?.content || variantName;
  
  // Extract body text
  const bodyTexts = texts
    .filter(t => (t.style?.fontSize || 0) < 24 && (t.style?.fontSize || 0) >= 12)
    .map(t => t.content)
    .join(' ');
  
  // Generate component imports and usage based on widget type
  let componentImports = '';
  let componentUsage = '';
  
  switch (widgetType) {
    case 'splash':
      componentImports = `import Splash from "../../components/Splash.astro";`;
      componentUsage = `<Splash 
  contents={[
    {
      title: ${JSON.stringify(mainHeading)},
      subtitle: ${JSON.stringify(bodyTexts.substring(0, 200))},
      ${images.length > 0 ? `imageSrc: "/placeholder-hero.jpg",` : ''}
    }
  ]}
  padding="lg"
  overlay={true}
  overlayOpacity="dark"
/>`;
      break;
      
    case 'calendar':
      componentImports = `import Calendar from "../../components/Calendar.astro";`;
      // Calendar component expects events prop, but we'll use empty array for now
      // The calendar will load events from the API endpoint
      componentUsage = `<div class="lg:container mx-auto px-4 py-8">
  <h2 class="ui-h3 mb-4">${mainHeading}</h2>
  <Calendar 
    showNavigation={true}
  />
</div>`;
      break;
      
    case 'textGrid':
      componentImports = `import TextGrid from "../../components/TextGrid.astro";`;
      // Group texts into grid items (assuming 3-4 items per grid)
      const gridItems = texts
        .filter(t => (t.style?.fontSize || 0) >= 16)
        .slice(0, 8)
        .map((t, idx) => ({
          title: t.content.substring(0, 100),
          description: texts[idx + 1]?.content?.substring(0, 200) || '',
        }));
      
      componentUsage = `<div class="lg:container mx-auto px-4 py-8">
  <h2 class="ui-h3 mb-4">${mainHeading}</h2>
  <TextGrid 
    items={${JSON.stringify(gridItems, null, 2)}}
  />
</div>`;
      break;
      
    case 'singleColumn':
      componentImports = `import SingleColumn from "../../components/SingleColumn.astro";`;
      const columnItems = texts
        .filter(t => (t.style?.fontSize || 0) >= 16)
        .slice(0, 5)
        .map((t, idx) => ({
          title: (t.style?.fontSize || 0) >= 20 ? t.content : undefined,
          content: `<p>${t.content}</p>`,
        }))
        .filter(item => item.content);
      
      componentUsage = `<SingleColumn 
  title=${JSON.stringify(mainHeading)}
  items={${JSON.stringify(columnItems, null, 2)}}
  isTitleVisible={true}
/>`;
      break;
      
    case 'doubleColumn':
      componentImports = `import DoubleColumn from "../../components/DoubleColumn.astro";`;
      const doubleColumnItems = texts
        .filter(t => (t.style?.fontSize || 0) >= 16)
        .slice(0, 6)
        .map((t, idx) => ({
          title: (t.style?.fontSize || 0) >= 20 ? t.content : `Section ${idx + 1}`,
          content: `<p>${t.content}</p>`,
        }));
      
      componentUsage = `<DoubleColumn 
  title=${JSON.stringify(mainHeading)}
  items={${JSON.stringify(doubleColumnItems, null, 2)}}
  isTitleVisible={true}
/>`;
      break;
      
    default:
      componentImports = `import SingleColumn from "../../components/SingleColumn.astro";`;
      componentUsage = `<SingleColumn 
  title=${JSON.stringify(mainHeading)}
  items={[
    {
      title: "Content",
      content: ${JSON.stringify(`<p>${bodyTexts.substring(0, 500)}</p>`)}
    }
  ]}
  isTitleVisible={true}
/>`;
  }
  
  // Note: Figma reference images are saved to local/figma-references/ for manual reference
  // They are not served via API to keep them private
  
  return `---
import Layout from "../../layouts/Layout.astro";
import NavBar from "../../components/Navbar.astro";
import "../../styles/global.css";
${componentImports}

// Generated from Figma variant: ${variantName}
// Instance ID: ${instance._nodeId || instance.id}
// Component ID: ${instance.componentId}
// Figma reference image saved to: local/figma-references/${sanitizedName}-figma-reference.png
---

<Layout>
  <NavBar />
  
  ${componentUsage}
  
  <!-- 
    Figma Data Summary:
    - Texts: ${texts.length} text node(s)
    - Images: ${images.length} image node(s)
    - Detected Widget: ${widgetType}
    - Variant: ${variantName}
    - Reference Image: local/figma-references/${sanitizedName}-figma-reference.png (saved locally, not served)
  -->
</Layout>
`;
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 Generating Pages from Figma Components\n');
  console.log('='.repeat(60));
  
  try {
    // Load cached data
    console.log('1. Loading cached Figma data...');
    const cache = loadCache();
    console.log(`✓ Loaded cache from ${CACHE_FILE}`);
    console.log(`  Timestamp: ${cache.timestamp}`);
    console.log(`  File Key: ${cache.fileKey}\n`);
    
    // Extract variant information from component set
    const variantNames: string[] = [];
    const variantMap = new Map<string, any>();
    
    // Get variant names from matchingComponentIds (these are the variant component IDs)
    if (cache.matchingComponentIds && Array.isArray(cache.matchingComponentIds)) {
      // These IDs correspond to variant components
      // We need to extract variant names from the component set structure
      if (cache.pagesCanvasDetailed) {
        // Find the Page component set
        function findComponentSet(nodes: any[]): any | null {
          for (const node of nodes) {
            if (node.type === 'COMPONENT_SET' && node.name === 'Page') {
              return node;
            }
            if (node.children) {
              const found = findComponentSet(node.children);
              if (found) return found;
            }
          }
          return null;
        }
        
        const componentSet = findComponentSet(cache.pagesCanvasDetailed.children || []);
        if (componentSet && componentSet.children) {
          for (const variant of componentSet.children) {
            if (variant.type === 'COMPONENT') {
              // Extract variant name from component name (format: "Property 1=Home")
              const nameMatch = variant.name.match(/Property\s+1\s*=\s*(.+)/i);
              const variantName = nameMatch ? nameMatch[1] : variant.name;
              variantNames.push(variantName);
              variantMap.set(variantName, variant);
            }
          }
        }
      }
    }
    
    // Also add instances we have data for
    if (cache.instances && cache.instances.length > 0) {
      for (const instance of cache.instances) {
        let variantName = 'Page';
        if (instance.componentProperties) {
          const prop1 = instance.componentProperties['Property 1'];
          if (prop1 && prop1.value) {
            variantName = prop1.value;
          }
        }
        if (variantName === 'Page' && instance.name) {
          variantName = instance.name;
        }
        
        if (!variantMap.has(variantName)) {
          variantNames.push(variantName);
          variantMap.set(variantName, instance);
        } else {
          // Update with instance data if we have it (more complete)
          variantMap.set(variantName, instance);
        }
      }
    }
    
    if (variantNames.length === 0) {
      throw new Error('No variants found. Run "npm run test:figma-pages" first to populate cache.');
    }
    
    console.log(`2. Found ${variantNames.length} Page variant(s)\n`);
    
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✓ Created output directory: ${OUTPUT_DIR}\n`);
    }
    
    // Ensure Figma images directory exists
    if (!existsSync(FIGMA_IMAGES_DIR)) {
      mkdirSync(FIGMA_IMAGES_DIR, { recursive: true });
      console.log(`✓ Created Figma images directory: ${FIGMA_IMAGES_DIR}\n`);
    }
    
    // Generate pages for each variant
    console.log('3. Generating pages with Figma reference images...\n');
    
    for (const variantName of variantNames) {
      const variantData = variantMap.get(variantName);
      
      // Create a minimal instance structure if we only have component definition
      const instance = variantData || {
        name: variantName,
        componentId: 'unknown',
        children: [],
        componentProperties: {
          'Property 1': { value: variantName }
        }
      };
      
      const sanitizedName = variantName
        .replace(/[^a-zA-Z0-9]/g, '-')
        .toLowerCase()
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Get instance node ID for image fetching
      const instanceNodeId = instance._nodeId || instance.id;
      
      // Fetch and download Figma image if we have a valid node ID
      // Images are saved locally for reference but not served via API
      if (instanceNodeId && instanceNodeId !== 'unknown') {
        console.log(`  📸 Fetching Figma image for ${variantName}...`);
        const imageUrl = await getFigmaImageUrl(instanceNodeId);
        
        if (imageUrl) {
          const imageFileName = `${sanitizedName}-figma-reference.png`;
          const imageOutputPath = join(FIGMA_IMAGES_DIR, imageFileName);
          
          const downloaded = await downloadImage(imageUrl, imageOutputPath);
          if (downloaded) {
            console.log(`    ✓ Saved reference image: ${imageOutputPath}`);
            // Note: Images are saved locally but not served via API
            // They can be viewed manually in local/figma-references/
          }
        } else {
          console.log(`    ⚠️  No image URL returned for ${variantName}`);
        }
      } else {
        console.log(`    ⚠️  No valid node ID for ${variantName}, skipping image fetch`);
      }
      
      const outputPath = join(OUTPUT_DIR, `${sanitizedName}.astro`);
      // Don't pass figmaImagePath since we're not displaying images in pages
      const pageContent = generatePageContent(variantName, instance);
      
      writeFileSync(outputPath, pageContent, 'utf-8');
      console.log(`  ✓ Generated: ${sanitizedName}.astro (${variantName})`);
    }
    
    console.log(`\n✅ Successfully generated ${variantNames.length} page(s) in ${OUTPUT_DIR}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Visit http://localhost:4321/conversion/{variant-name} to view pages`);
    console.log(`   2. Review the generated pages and adjust widget mappings as needed`);
    console.log(`   3. Update the detection logic in generate-figma-pages.ts to improve accuracy\n`);
    
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

export { generatePageContent, detectWidgetFromFigma };

