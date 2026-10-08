/**
 * Figma Design Parser
 * 
 * Extracts design information from Figma files/API for conversion to Contentful entries.
 * 
 * Status: ✅ Implemented
 * 
 * This module:
 * - Connects to Figma API
 * - Parses frame/node structures
 * - Extracts text, images, and layout information
 * - Identifies widget patterns
 * - Extracts styling information
 */

import type { WidgetType } from '../../src/lib/components/component-map';
import { findWidgetByFigmaPattern } from './widget-mapping';

/**
 * Figma API base URL
 */
const FIGMA_API_BASE = 'https://api.figma.com/v1';

/**
 * Figma API error
 */
export class FigmaAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'FigmaAPIError';
  }
}

/**
 * Figma API configuration
 */
export interface FigmaConfig {
  /** Figma personal access token */
  accessToken: string;
  /** Figma file key/ID */
  fileKey: string;
  /** Optional node IDs to parse (if not provided, parses entire file) */
  nodeIds?: string[];
}

/**
 * Extracted text content from Figma
 */
export interface FigmaText {
  /** Text content */
  content: string;
  /** Font size */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Text color */
  color?: string;
  /** Text style (heading, body, etc.) */
  style?: 'heading' | 'body' | 'caption' | 'button';
  /** Node ID in Figma */
  nodeId: string;
}

/**
 * Extracted image from Figma
 */
export interface FigmaImage {
  /** Image URL (from Figma API) */
  url: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Node ID in Figma */
  nodeId: string;
  /** Image format */
  format?: 'png' | 'jpg' | 'svg';
}

/**
 * Layout information from Figma
 */
export interface FigmaLayout {
  /** Layout type */
  type: 'grid' | 'column' | 'row' | 'stack' | 'absolute';
  /** Number of columns (for grid) */
  columns?: number;
  /** Gap between items */
  gap?: number;
  /** Padding */
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Parsed Figma design data
 */
export interface FigmaDesignData {
  /** Frame/node name */
  name: string;
  /** Node ID */
  nodeId: string;
  /** Detected widget type (if pattern matches) */
  detectedWidgetType?: WidgetType;
  /** Extracted text content */
  texts: FigmaText[];
  /** Extracted images */
  images: FigmaImage[];
  /** Layout information */
  layout: FigmaLayout;
  /** Child frames/nodes */
  children?: FigmaDesignData[];
  /** Styling information */
  styles?: {
    backgroundColor?: string;
    borderRadius?: number;
    shadows?: Array<{
      color: string;
      blur: number;
      offset: { x: number; y: number };
    }>;
  };
}

/**
 * Fetch file data from Figma API
 * 
 * @param config - Figma API configuration
 * @returns Raw Figma file data
 */
async function fetchFigmaFile(config: FigmaConfig): Promise<any> {
  const url = config.nodeIds && config.nodeIds.length > 0
    ? `${FIGMA_API_BASE}/files/${config.fileKey}/nodes?ids=${config.nodeIds.join(',')}`
    : `${FIGMA_API_BASE}/files/${config.fileKey}`;
  
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': config.accessToken,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new FigmaAPIError(
      `Figma API error: ${response.statusText}`,
      response.status,
      errorData
    );
  }
  
  return await response.json();
}

/**
 * Parse a Figma node into design data
 * 
 * @param node - Figma node data (from Figma REST API)
 * @param nodeId - Node ID
 * @returns Parsed design data
 */
function parseFigmaNode(node: any, nodeId: string): FigmaDesignData {
  const texts: FigmaText[] = [];
  const images: FigmaImage[] = [];
  const children: FigmaDesignData[] = [];
  
  // Extract text from TEXT nodes
  // Note: Only TEXT type nodes have 'characters' property in Figma API
  if (node.type === 'TEXT' && node.characters) {
    const textStyle = node.style || {};
    const fill = node.fills?.[0];
    
    texts.push({
      content: node.characters,
      fontSize: textStyle.fontSize,
      fontFamily: textStyle.fontFamily,
      color: fill && fill.type === 'SOLID' && fill.color
        ? `rgba(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)}, ${fill.color.a ?? 1})`
        : undefined,
      style: inferTextStyle(node),
      nodeId: nodeId,
    });
  }
  
  // Extract images from nodes with image fills or IMAGE type nodes
  // Figma API: IMAGE type nodes or nodes with IMAGE fills
  if (node.type === 'IMAGE') {
    // Direct image node
    images.push({
      url: '', // Will be fetched via getFigmaImageUrls()
      width: node.absoluteBoundingBox?.width || 0,
      height: node.absoluteBoundingBox?.height || 0,
      nodeId: nodeId,
      format: 'png',
    });
  } else if (node.fills && Array.isArray(node.fills)) {
    // Check for image fills (type: "IMAGE")
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageRef) {
        images.push({
          url: '', // Will be fetched via getFigmaImageUrls()
          width: node.absoluteBoundingBox?.width || 0,
          height: node.absoluteBoundingBox?.height || 0,
          nodeId: nodeId,
          format: 'png',
        });
        break; // Only need one image per node
      }
    }
  }
  
  // Also check export settings (nodes that can be exported as images)
  if (node.exportSettings && Array.isArray(node.exportSettings) && node.exportSettings.length > 0) {
    // Node can be exported - might be an image or contain images
    if (!images.find(img => img.nodeId === nodeId)) {
      images.push({
        url: '', // Will be fetched via getFigmaImageUrls()
        width: node.absoluteBoundingBox?.width || 0,
        height: node.absoluteBoundingBox?.height || 0,
        nodeId: nodeId,
        format: node.exportSettings[0]?.format || 'png',
      });
    }
  }
  
  // Parse children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      children.push(parseFigmaNode(child, child.id));
    }
  }
  
  // Determine layout type
  const layout = inferLayout(node);
  
  // Extract styles
  const styles = extractStyles(node);
  
  const designData: FigmaDesignData = {
    name: node.name || 'Untitled',
    nodeId: nodeId,
    texts,
    images,
    layout,
    children: children.length > 0 ? children : undefined,
    styles,
  };
  
  // Detect widget type
  designData.detectedWidgetType = detectWidgetType(designData);
  
  return designData;
}

/**
 * Infer text style from Figma node
 */
function inferTextStyle(node: any): 'heading' | 'body' | 'caption' | 'button' | undefined {
  const fontSize = node.style?.fontSize || 0;
  const name = (node.name || '').toLowerCase();
  
  if (name.includes('heading') || name.includes('h1') || name.includes('h2') || name.includes('h3') || fontSize >= 24) {
    return 'heading';
  }
  if (name.includes('button') || name.includes('btn')) {
    return 'button';
  }
  if (fontSize <= 12) {
    return 'caption';
  }
  return 'body';
}

/**
 * Infer layout type from Figma node
 * 
 * Figma API: layoutMode can be "VERTICAL", "HORIZONTAL", or null
 */
function inferLayout(node: any): FigmaLayout {
  const layoutMode = node.layoutMode; // "VERTICAL" | "HORIZONTAL" | null
  
  // Auto-layout frames
  if (layoutMode === 'HORIZONTAL') {
    return {
      type: 'row',
      gap: node.itemSpacing || 0,
      padding: extractPadding(node),
    };
  }
  
  if (layoutMode === 'VERTICAL') {
    // Check if it's a grid (nested auto-layout or similar widths)
    if (node.children && Array.isArray(node.children) && node.children.length > 1) {
      // Check if children are in horizontal layout (suggests grid rows)
      const firstChild = node.children[0];
      if (firstChild?.layoutMode === 'HORIZONTAL') {
        return {
          type: 'grid',
          columns: firstChild.children?.length || estimateColumns(node),
          gap: node.itemSpacing || firstChild.itemSpacing || 0,
          padding: extractPadding(node),
        };
      }
      
      // Check for similar widths (suggests grid)
      const childWidths = node.children
        .map((c: any) => c.absoluteBoundingBox?.width)
        .filter((w: number | undefined): w is number => typeof w === 'number');
      
      if (childWidths.length > 0) {
        const uniqueWidths = new Set(childWidths);
        // If most children have similar widths, it's likely a grid
        if (uniqueWidths.size <= 2 && childWidths.length >= 2) {
          return {
            type: 'grid',
            columns: estimateColumns(node),
            gap: node.itemSpacing || 0,
            padding: extractPadding(node),
          };
        }
      }
    }
    
    return {
      type: 'column',
      gap: node.itemSpacing || 0,
      padding: extractPadding(node),
    };
  }
  
  // No auto-layout - check for grid patterns in children
  if (node.children && Array.isArray(node.children) && node.children.length > 1) {
    const childWidths = node.children
      .map((c: any) => c.absoluteBoundingBox?.width)
      .filter((w: number | undefined): w is number => typeof w === 'number');
    
    if (childWidths.length > 0) {
      const uniqueWidths = new Set(childWidths);
      // Similar widths suggest grid
      if (uniqueWidths.size <= 2 && childWidths.length >= 2) {
        return {
          type: 'grid',
          columns: estimateColumns(node),
          gap: 0, // No auto-layout, so no itemSpacing
          padding: extractPadding(node),
        };
      }
    }
  }
  
  // Default: absolute positioning or stack
  return {
    type: node.absoluteBoundingBox ? 'absolute' : 'stack',
    padding: extractPadding(node),
  };
}

/**
 * Estimate number of columns in a grid layout
 */
function estimateColumns(node: any): number {
  if (!node.children || node.children.length === 0) return 1;
  
  // If children are in horizontal layout, count them
  if (node.children[0]?.layoutMode === 'HORIZONTAL') {
    return node.children[0].children?.length || 1;
  }
  
  // Estimate based on child widths
  const childWidths = node.children
    .map((c: any) => c.absoluteBoundingBox?.width)
    .filter(Boolean);
  
  if (childWidths.length === 0) return 1;
  
  const avgWidth = childWidths.reduce((a: number, b: number) => a + b, 0) / childWidths.length;
  const containerWidth = node.absoluteBoundingBox?.width || 0;
  
  if (containerWidth > 0 && avgWidth > 0) {
    return Math.round(containerWidth / avgWidth);
  }
  
  return Math.ceil(Math.sqrt(childWidths.length));
}

/**
 * Extract padding from Figma node
 * 
 * Figma API: paddingLeft, paddingRight, paddingTop, paddingBottom (for auto-layout frames)
 */
function extractPadding(node: any): { top: number; right: number; bottom: number; left: number } | undefined {
  // Figma API uses paddingLeft, paddingRight, paddingTop, paddingBottom
  const paddingLeft = typeof node.paddingLeft === 'number' ? node.paddingLeft : 0;
  const paddingRight = typeof node.paddingRight === 'number' ? node.paddingRight : 0;
  const paddingTop = typeof node.paddingTop === 'number' ? node.paddingTop : 0;
  const paddingBottom = typeof node.paddingBottom === 'number' ? node.paddingBottom : 0;
  
  if (paddingLeft === 0 && paddingRight === 0 && paddingTop === 0 && paddingBottom === 0) {
    return undefined;
  }
  
  return {
    top: paddingTop,
    right: paddingRight,
    bottom: paddingBottom,
    left: paddingLeft,
  };
}

/**
 * Extract styles from Figma node
 * 
 * Figma API: fills (array), effects (array), cornerRadius
 */
function extractStyles(node: any): FigmaDesignData['styles'] {
  const styles: FigmaDesignData['styles'] = {};
  
  // Background color from SOLID fills
  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    const solidFill = node.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill && solidFill.color) {
      const c = solidFill.color;
      styles.backgroundColor = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a ?? 1})`;
    }
  }
  
  // Border radius
  // Figma API: cornerRadius (single value) or cornerRadii (array for different corners)
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    styles.borderRadius = node.cornerRadius;
  }
  
  // Shadows/effects
  // Figma API: effects array with type, color, radius, offset
  if (node.effects && Array.isArray(node.effects) && node.effects.length > 0) {
    const shadowEffects = node.effects.filter((e: any) => 
      (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && e.visible !== false
    );
    
    if (shadowEffects.length > 0) {
      styles.shadows = shadowEffects.map((e: any) => {
        const color = e.color || { r: 0, g: 0, b: 0, a: 0.25 };
        return {
          color: `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a ?? 1})`,
          blur: e.radius || 0,
          offset: {
            x: e.offset?.x || 0,
            y: e.offset?.y || 0,
          },
        };
      });
    }
  }
  
  return Object.keys(styles).length > 0 ? styles : undefined;
}

/**
 * Parse a Figma file and extract design data
 * 
 * @param config - Figma API configuration
 * @returns Parsed design data
 */
export async function parseFigmaFile(config: FigmaConfig): Promise<FigmaDesignData[]> {
  try {
    const fileData = await fetchFigmaFile(config);
    const designData: FigmaDesignData[] = [];
    
    // Handle different response formats based on Figma API structure
    if (config.nodeIds && config.nodeIds.length > 0) {
      // Node-specific query: GET /v1/files/:file_key/nodes?ids=...
      // Response: { nodes: { "nodeId": { document: {...}, ... } } }
      const nodes = fileData.nodes || {};
      for (const [nodeId, nodeData] of Object.entries(nodes)) {
        const nodeDoc = (nodeData as any).document;
        if (nodeDoc) {
          designData.push(parseFigmaNode(nodeDoc, nodeId));
        }
      }
    } else {
      // Full file query: GET /v1/files/:file_key
      // Response: { document: {...}, components: {}, ... }
      const document = fileData.document;
      
      if (document) {
        // Document root - parse its children (pages/canvases)
        if (document.children && Array.isArray(document.children)) {
          for (const child of document.children) {
            // CANVAS = Page in Figma
            if (child.type === 'CANVAS') {
              // Parse the canvas and its children (frames)
              if (child.children && Array.isArray(child.children)) {
                for (const frame of child.children) {
                  if (frame.type === 'FRAME' || frame.type === 'COMPONENT') {
                    designData.push(parseFigmaNode(frame, frame.id));
                  }
                }
              } else {
                // Canvas itself might be the design
                designData.push(parseFigmaNode(child, child.id));
              }
            } else if (child.type === 'FRAME' || child.type === 'COMPONENT') {
              // Direct frame/component at document level
              designData.push(parseFigmaNode(child, child.id));
            }
          }
        } else {
          // No children, parse document itself
          designData.push(parseFigmaNode(document, document.id));
        }
      }
    }
    
    return designData;
  } catch (error) {
    if (error instanceof FigmaAPIError) {
      throw error;
    }
    throw new FigmaAPIError(
      `Failed to parse Figma file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Get image URLs from Figma nodes
 * 
 * @param config - Figma API configuration
 * @param nodeIds - Node IDs to get images for
 * @param format - Image format (default: 'png')
 * @param scale - Image scale (default: 1)
 * @returns Map of node ID to image URL
 */
export async function getFigmaImageUrls(
  config: FigmaConfig,
  nodeIds: string[],
  format: 'png' | 'jpg' | 'svg' = 'png',
  scale: number = 1
): Promise<Map<string, string>> {
  if (nodeIds.length === 0) {
    return new Map();
  }
  
  const url = `${FIGMA_API_BASE}/images/${config.fileKey}?ids=${nodeIds.join(',')}&format=${format}&scale=${scale}`;
  
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': config.accessToken,
    },
  });
  
  if (!response.ok) {
    throw new FigmaAPIError(
      `Failed to fetch Figma images: ${response.statusText}`,
      response.status
    );
  }
  
  const data = await response.json();
  const imageMap = new Map<string, string>();
  
  if (data.images) {
    for (const [nodeId, imageUrl] of Object.entries(data.images)) {
      if (imageUrl) {
        imageMap.set(nodeId, imageUrl as string);
      }
    }
  }
  
  return imageMap;
}

/**
 * Identify widget type from Figma design patterns
 * 
 * @param designData - Parsed Figma design data
 * @returns Detected widget type or undefined
 */
export function detectWidgetType(designData: FigmaDesignData): WidgetType | undefined {
  // Extract patterns from design data
  const patterns: string[] = [];
  const nameLower = designData.name.toLowerCase();
  
  // Check for calendar patterns first (prioritize name-based detection)
  if (nameLower.includes('calendar') || 
      nameLower.includes('schedule') ||
      nameLower.includes('event list')) {
    patterns.push('calendar components');
    patterns.push('Date pickers');
    patterns.push('Event lists');
    // Return calendar immediately if name strongly suggests it
    const calendarMatches = findWidgetByFigmaPattern(['calendar components']);
    if (calendarMatches.length > 0) {
      return calendarMatches[0];
    }
  }
  
  // Check for timeline patterns (prioritize name and date patterns)
  if (nameLower.includes('timeline') || 
      nameLower.includes('history') ||
      nameLower.includes('chronological')) {
    patterns.push('Timeline components');
    patterns.push('Chronological lists');
    patterns.push('History views');
    patterns.push('Event timelines');
    // Return timeline immediately if name strongly suggests it
    const timelineMatches = findWidgetByFigmaPattern(['Timeline components']);
    if (timelineMatches.length > 0) {
      return timelineMatches[0];
    }
  }
  
  // Analyze layout
  if (designData.layout.type === 'grid') {
    patterns.push('grid layouts');
    patterns.push('Card components');
  }
  if (designData.layout.type === 'column') {
    patterns.push('article layouts');
    patterns.push('Blog posts');
  }
  
  // Analyze content structure
  if (designData.images.length > 0 && designData.images.length === designData.texts.length) {
    patterns.push('card components');
    patterns.push('Image galleries');
  }
  
  // Check for hero/hero section patterns
  const hasLargeHeading = designData.texts.some(t => 
    t.style === 'heading' && t.fontSize && t.fontSize > 40
  );
  const hasFullWidthImage = designData.images.some(img => 
    img.width > 800 || (designData.children && designData.children.length === 0)
  );
  
  if (hasLargeHeading && (hasFullWidthImage || designData.images.length > 0)) {
    patterns.push('hero sections');
    patterns.push('Large image/video backgrounds');
    patterns.push('Full-width banners');
  }
  
  // Also check for timeline patterns in content
  if (designData.children && designData.children.length > 3) {
    const hasDates = designData.texts.some(t => 
      /\d{4}|\d{1,2}\/\d{1,2}|\w+day/i.test(t.content)
    );
    if (hasDates) {
      patterns.push('Timeline components');
      patterns.push('Chronological lists');
      patterns.push('History views');
      patterns.push('Event timelines');
    }
  }
  
  // Check for report/dashboard patterns
  if (nameLower.includes('report') ||
      nameLower.includes('dashboard') ||
      nameLower.includes('statistics')) {
    patterns.push('Dashboard layouts');
    patterns.push('Data tables');
  }
  
  // Find matching widget
  const matches = findWidgetByFigmaPattern(patterns);
  return matches[0]; // Return first match
}

/**
 * Extract text content from Figma design
 * 
 * @param designData - Parsed Figma design data
 * @returns Array of extracted text with metadata
 */
export function extractTexts(designData: FigmaDesignData): FigmaText[] {
  // Flatten all texts from design and children
  const texts: FigmaText[] = [...designData.texts];
  
  if (designData.children) {
    for (const child of designData.children) {
      texts.push(...extractTexts(child));
    }
  }
  
  return texts;
}

/**
 * Extract images from Figma design
 * 
 * @param designData - Parsed Figma design data
 * @returns Array of extracted images
 */
export function extractImages(designData: FigmaDesignData): FigmaImage[] {
  // Flatten all images from design and children
  const images: FigmaImage[] = [...designData.images];
  
  if (designData.children) {
    for (const child of designData.children) {
      images.push(...extractImages(child));
    }
  }
  
  return images;
}
