#!/usr/bin/env tsx
/**
 * Extract Structured Data from Figma People Page
 * 
 * Extracts text content from the People page variant in Figma,
 * organizing it by section headers (STAFF, KEY VOLUNTEERS, etc.)
 * and saves it as structured JSON.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
const FIGMA_FILE_KEY = env.FIGMA_FILE_KEY || 'IKAgwheFeuzTfGkP4qEpUe';
const CACHE_FILE = join(projectRoot, 'local', `figma-pages-cache-${FIGMA_FILE_KEY}.json`);
const OUTPUT_DIR = join(projectRoot, 'local', 'figma-data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'people-page.json');

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
 * Normalize space characters to ASCII space (0x20)
 * Replaces non-breaking spaces, zero-width spaces, and other Unicode spaces
 * Covers all Unicode space separator characters
 */
function normalizeSpaces(text: string): string {
  // Replace all Unicode space characters with ASCII space (0x20)
  // This includes:
  // - Non-breaking space (U+00A0)
  // - En quad, em quad, en space, em space, thin space, etc. (U+2000-U+200B)
  // - Narrow no-break space (U+202F)
  // - Medium mathematical space (U+205F)
  // - Ideographic space (U+3000)
  // - Zero-width no-break space / BOM (U+FEFF)
  // Using \s in a character class would also match \t, \n, \r, so we're specific
  return text.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
}

/**
 * Extract text content from a Figma node recursively with position information
 */
function extractTextsWithPosition(node: any, parentY: number = 0): Array<{
  content: string;
  style?: any;
  nodeId: string;
  y: number;
  fontSize?: number;
  fontWeight?: number;
  isBold?: boolean;
}> {
  const texts: Array<{
    content: string;
    style?: any;
    nodeId: string;
    y: number;
    fontSize?: number;
    fontWeight?: number;
    isBold?: boolean;
  }> = [];
  
  function traverse(n: any, currentY: number = 0) {
    const nodeY = n.absoluteBoundingBox?.y || currentY;
    
    if (n.type === 'TEXT' && n.characters) {
      const fontWeight = n.style?.fontWeight || 400;
      const isBold = fontWeight >= 600; // Consider 600+ as bold
      
      // Normalize space characters in the text content
      const normalizedContent = normalizeSpaces(n.characters);
      
      texts.push({
        content: normalizedContent,
        style: n.style,
        nodeId: n.id,
        y: nodeY,
        fontSize: n.style?.fontSize,
        fontWeight,
        isBold,
      });
    }
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child, nodeY);
      }
    }
  }
  
  traverse(node);
  return texts;
}

/**
 * Identify section headers based on font size and content patterns
 */
function identifySectionHeaders(texts: Array<{ content: string; fontSize?: number; y: number }>): string[] {
  // Headers are typically larger font sizes and in ALL CAPS
  const headers: string[] = [];
  const headerPatterns = [
    /^STAFF$/i,
    /^KEY VOLUNTEERS$/i,
    /^BOARD OF DIRECTORS$/i,
    /^ADVISORY BOARD$/i,
    /^SPONSORS$/i,
    /^CORPORATE DONORS$/i,
    /^DONORS$/i,
    /^KICKSTARTERS$/i,
  ];
  
  for (const text of texts) {
    const isLarge = (text.fontSize || 0) >= 24;
    const isAllCaps = text.content === text.content.toUpperCase() && text.content.length > 3;
    const matchesPattern = headerPatterns.some(pattern => pattern.test(text.content));
    
    if ((isLarge && isAllCaps) || matchesPattern) {
      headers.push(text.content.toUpperCase().trim());
    }
  }
  
  // Remove duplicates and return unique headers
  return [...new Set(headers)];
}

/**
 * Group texts by section based on header positions
 */
function groupTextsBySection(
  texts: Array<{ content: string; fontSize?: number; y: number; fontWeight?: number; isBold?: boolean; style?: any; nodeId: string }>,
  headers: string[]
): Record<string, Array<{ content: string; fontSize?: number; y: number; fontWeight?: number; isBold?: boolean }>> {
  // Sort texts by Y position (top to bottom)
  const sortedTexts = [...texts].sort((a, b) => a.y - b.y);
  
  // Find header positions
  const headerPositions: Array<{ name: string; y: number }> = [];
  for (const header of headers) {
    const headerText = sortedTexts.find(t => 
      t.content.toUpperCase().trim() === header.toUpperCase().trim()
    );
    if (headerText) {
      headerPositions.push({ name: header, y: headerText.y });
    }
  }
  
  // Sort headers by position
  headerPositions.sort((a, b) => a.y - b.y);
  
  // Group texts under each header
  const sections: Record<string, Array<{ content: string; fontSize?: number; y: number; fontWeight?: number; isBold?: boolean }>> = {};
  
  for (let i = 0; i < headerPositions.length; i++) {
    const header = headerPositions[i];
    const nextHeaderY = i < headerPositions.length - 1 
      ? headerPositions[i + 1].y 
      : Infinity;
    
    // Get all texts between this header and the next
    const sectionTexts = sortedTexts
      .filter(t => {
        const textY = t.y;
        return textY > header.y && textY < nextHeaderY;
      })
      .map(t => ({
        content: t.content,
        fontSize: t.fontSize,
        y: t.y,
        fontWeight: t.fontWeight,
        isBold: t.isBold,
      }));
    
    sections[header.name] = sectionTexts;
  }
  
  return sections;
}

/**
 * Parse structured data from sections
 */
function parseSectionData(sections: Record<string, Array<{ content: string; fontSize?: number; y: number }>>): Record<string, any> {
  const structured: Record<string, any> = {};
  
  for (const [sectionName, texts] of Object.entries(sections)) {
    // Remove the header itself from the texts
    const contentTexts = texts.filter(t => 
      t.content.toUpperCase().trim() !== sectionName.toUpperCase().trim()
    );
    
    switch (sectionName.toUpperCase()) {
      case 'STAFF':
      case 'KEY VOLUNTEERS':
      case 'BOARD OF DIRECTORS':
      case 'ADVISORY BOARD':
        // These sections have name + role format
        structured[sectionName] = parseNameRoleList(contentTexts);
        break;
        
      case 'SPONSORS':
      case 'CORPORATE DONORS':
        // These have logos/years
        structured[sectionName] = parseSponsorList(contentTexts);
        break;
        
      case 'DONORS':
      case 'KICKSTARTERS':
        // These are simple name lists
        structured[sectionName] = parseNameList(contentTexts);
        break;
        
      default:
        // Default: just store all text content
        structured[sectionName] = contentTexts.map(t => t.content);
    }
  }
  
  return structured;
}

/**
 * Parse name and role entries from text nodes
 * Text nodes may contain multiple people entries separated by double newlines
 * Each entry typically has: Name\nRole\n\nNextName\nRole
 * Returns entries with name, role (first role), and description (additional roles/affiliations)
 */
function parseNameRoleList(texts: Array<{ content: string; fontSize?: number; y: number; fontWeight?: number; isBold?: boolean }>): Array<{ name: string; role?: string; description?: string }> {
  const entries: Array<{ name: string; role?: string; description?: string }> = [];
  
  // Sort by Y position to process top to bottom
  const sortedTexts = [...texts].sort((a, b) => a.y - b.y);
  
  // Process each text node - they may contain multiple people entries
  for (const text of sortedTexts) {
    const content = text.content.trim();
    if (!content) continue;
    
    // Skip section headers
    if (content.match(/^(STAFF|KEY VOLUNTEERS|BOARD OF DIRECTORS|ADVISORY BOARD|SPONSORS|CORPORATE DONORS|DONORS|KICKSTARTERS|PEOPLE)$/i)) {
      continue;
    }
    
    // Split by double newlines to get individual people entries
    // Each entry is typically: "Name\nRole" or "Name\nRole\nAdditional Info"
    const peopleEntries = content.split(/\n\n+/).map(e => e.trim()).filter(e => e);
    
    for (const entryText of peopleEntries) {
      // Split by single newlines to get name and role(s)
      const lines = entryText.split(/\n/).map(l => l.trim()).filter(l => l);
      
      if (lines.length === 0) continue;
      
      // First line is typically the name
      const name = lines[0];
      
      // Check if name looks valid (not a role)
      const looksLikeRole = name.match(/^(Executive Director|Operations Manager|Front Desk Associate|Board Member|Community Ambassador|Illustrator|Animator|Tech Art|Deputy|Fund Manager|President|CEO|CLO|Director|Manager|Engineer|Associate|Member|Founder|Staff|Partner|Designer|Committee)/i);
      
      if (looksLikeRole) {
        // This might be a role without a name, skip it
        continue;
      }
      
      // Remaining lines are roles/affiliations
      if (lines.length === 1) {
        // Just a name, no role
        entries.push({ name });
      } else if (lines.length === 2) {
        // Name and one role
        entries.push({ name, role: lines[1] });
      } else {
        // Name, role, and additional info
        entries.push({
          name,
          role: lines[1],
          description: lines.slice(2).join(', '),
        });
      }
    }
  }
  
  // Remove duplicates based on name
  const seen = new Set<string>();
  const uniqueEntries: Array<{ name: string; role?: string; description?: string }> = [];
  
  for (const entry of entries) {
    const key = entry.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEntries.push(entry);
    }
  }
  
  return uniqueEntries;
}

/**
 * Build a single entry from a collection of texts
 */
function buildEntryFromTexts(texts: Array<{ content: string; isBold?: boolean; y: number }>): { name: string; role?: string; description?: string } | null {
  if (texts.length === 0) return null;
  
  // Sort by Y position
  const sorted = [...texts].sort((a, b) => a.y - b.y);
  
  // First bold text is the name
  const nameText = sorted.find(t => t.isBold);
  const name = nameText ? nameText.content.trim() : sorted[0].content.trim();
  
  if (!name) return null;
  
  // Remaining texts are roles/affiliations
  const roleTexts = sorted.filter(t => t !== nameText && t.content.trim());
  
  if (roleTexts.length === 0) {
    return { name };
  }
  
  // First role text is the primary role
  const role = roleTexts[0].content.trim();
  
  // Additional role texts go to description
  const description = roleTexts.length > 1 
    ? roleTexts.slice(1).map(t => t.content.trim()).join(', ')
    : undefined;
  
  return { name, role, description };
}

/**
 * Parse a single name/role entry
 * Returns entry with name, role (first role), and description (additional roles/affiliations)
 */
function parseSingleNameRole(content: string): { name: string; role?: string; description?: string } | null {
  if (!content) return null;
  
  // Skip if it's clearly just a role
  if (content.match(/^(Executive Director|Operations Manager|Front Desk Associate|Board Member|Community Ambassador|Illustrator|Animator|Tech Art|Deputy|Fund Manager|President|CEO|CLO|Director|Manager|Engineer|Associate|Member|Founder|Staff|Partner|Designer|Committee)\b/i) &&
      !content.match(/^[A-Z][a-z]+\s+[A-Z]/)) { // Not a name pattern
    return null;
  }
  
  // Try to parse "Name (Role)" format
  const parenMatch = content.match(/^(.+?)\s*\((.+?)\)$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      role: parenMatch[2].trim(),
    };
  }
  
  // Try "Name, Role, Additional Role" format
  // Split by comma and check if parts look like roles
  const commaMatch = content.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const name = commaMatch[1].trim();
    const rest = commaMatch[2].trim();
    
    // Check if rest contains role keywords
    if (rest.match(/\b(at|of|for|Director|Manager|Engineer|Associate|Member|Founder|CEO|President|Staff|Partner)\b/i)) {
      // Split by comma to see if there are multiple roles
      const roleParts = rest.split(',').map(p => p.trim());
      
      if (roleParts.length > 1) {
        // First role goes to "role", rest to "description"
        return {
          name,
          role: roleParts[0],
          description: roleParts.slice(1).join(', '),
        };
      } else {
        // Single role
        return {
          name,
          role: rest,
        };
      }
    }
  }
  
  // Just a name
  return { name: content };
}

/**
 * Parse sponsor list with years
 */
function parseSponsorList(texts: Array<{ content: string; fontSize?: number; y: number }>): Array<{ name: string; years?: string }> {
  const sponsors: Array<{ name: string; years?: string }> = [];
  
  for (const text of texts) {
    const content = text.content.trim();
    if (!content) continue;
    
    // Look for year patterns like "2016-2023" or "2018"
    const yearMatch = content.match(/(\d{4}(?:-\d{4})?)/);
    const name = content.replace(/\d{4}(?:-\d{4})?/g, '').trim();
    
    if (name) {
      sponsors.push({
        name: name,
        years: yearMatch ? yearMatch[1] : undefined,
      });
    }
  }
  
  return sponsors;
}

/**
 * Parse simple name list
 */
function parseNameList(texts: Array<{ content: string; fontSize?: number; y: number }>): string[] {
  const names: string[] = [];
  
  for (const text of texts) {
    const content = text.content.trim();
    if (content && !content.match(/^\d{4}/)) { // Skip year-only entries
      // Split by common delimiters if multiple names on one line
      const splitNames = content.split(/[,\n]/).map(n => n.trim()).filter(n => n);
      names.push(...splitNames);
    }
  }
  
  return names;
}

/**
 * Main function
 */
async function main() {
  console.log('📊 Extracting People Page Data from Figma\n');
  console.log('='.repeat(60));
  
  try {
    // Load cached data
    console.log('1. Loading cached Figma data...');
    const cache = loadCache();
    console.log(`✓ Loaded cache from ${CACHE_FILE}\n`);
    
    // Find the People page instance
    console.log('2. Finding People page variant...');
    let peopleInstance: any = null;
    
    // Check instances first
    if (cache.instances && Array.isArray(cache.instances)) {
      peopleInstance = cache.instances.find((inst: any) => {
        const variantName = inst.componentProperties?.['Property 1']?.value || inst.name;
        return variantName && variantName.toLowerCase().includes('people');
      });
    }
    
    // If not found in instances, check variant map
    if (!peopleInstance && cache.pagesCanvasDetailed) {
      function findPeopleVariant(nodes: any[]): any | null {
        for (const node of nodes) {
          if (node.type === 'COMPONENT_SET' && node.name === 'Page') {
            if (node.children) {
              for (const variant of node.children) {
                if (variant.type === 'COMPONENT') {
                  const nameMatch = variant.name.match(/Property\s+1\s*=\s*(.+)/i);
                  const variantName = nameMatch ? nameMatch[1] : variant.name;
                  if (variantName && variantName.toLowerCase().includes('people')) {
                    return variant;
                  }
                }
              }
            }
          }
          if (node.children) {
            const found = findPeopleVariant(node.children);
            if (found) return found;
          }
        }
        return null;
      }
      
      const variant = findPeopleVariant(cache.pagesCanvasDetailed.children || []);
      if (variant) {
        peopleInstance = variant;
      }
    }
    
    if (!peopleInstance) {
      throw new Error('Could not find People page variant in cache');
    }
    
    console.log(`✓ Found People page (Instance ID: ${peopleInstance._nodeId || peopleInstance.id})\n`);
    
    // Extract all texts with position information
    console.log('3. Extracting text content...');
    const texts = extractTextsWithPosition(peopleInstance);
    console.log(`✓ Extracted ${texts.length} text node(s)`);
    
    // Debug: Show sample of text data with fontWeight
    if (texts.length > 0) {
      console.log(`\n   Sample text nodes (first 3):`);
      for (const text of texts.slice(0, 3)) {
        console.log(`   - "${text.content.substring(0, 50)}..." (bold: ${text.isBold}, fontWeight: ${text.fontWeight}, fontSize: ${text.fontSize})`);
      }
    }
    console.log();
    
    // Identify section headers
    console.log('4. Identifying section headers...');
    const headers = identifySectionHeaders(texts);
    console.log(`✓ Found ${headers.length} section(s): ${headers.join(', ')}\n`);
    
    // Group texts by section
    console.log('5. Grouping texts by section...');
    const sections = groupTextsBySection(texts, headers);
    console.log(`✓ Organized into ${Object.keys(sections).length} section(s)\n`);
    
    // Debug: Show sample texts from STAFF section
    if (sections.STAFF && sections.STAFF.length > 0) {
      console.log('\n   Sample texts from STAFF section (first 5):');
      for (const text of sections.STAFF.slice(0, 5)) {
        console.log(`   - "${text.content.substring(0, 60)}..." (bold: ${text.isBold}, fontWeight: ${text.fontWeight})`);
      }
    }
    
    // Parse structured data
    console.log('\n6. Parsing structured data...');
    const structuredData = parseSectionData(sections);
    
    // Count entries per section and show sample
    for (const [sectionName, data] of Object.entries(structuredData)) {
      if (Array.isArray(data)) {
        console.log(`  ${sectionName}: ${data.length} entry/entries`);
        if (data.length > 0 && data.length <= 10) {
          // Show first entry as sample
          console.log(`    Sample: ${JSON.stringify(data[0])}`);
        }
      }
    }
    console.log();
    
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✓ Created output directory: ${OUTPUT_DIR}\n`);
    }
    
    // Save to JSON
    console.log('7. Saving to JSON...');
    const outputData = {
      extractedAt: new Date().toISOString(),
      source: 'Figma People Page Variant',
      instanceId: peopleInstance._nodeId || peopleInstance.id,
      sections: structuredData,
      metadata: {
        totalTextNodes: texts.length,
        sectionsFound: headers.length,
      },
    };
    
    writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`✓ Saved to ${OUTPUT_FILE}\n`);
    
    console.log('✅ Successfully extracted People page data!');
    console.log(`\n📝 Data structure:`);
    console.log(`   - ${Object.keys(structuredData).length} section(s) extracted`);
    console.log(`   - View the full data in: ${OUTPUT_FILE}\n`);
    
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

export { extractTextsWithPosition, identifySectionHeaders, groupTextsBySection, parseSectionData };

