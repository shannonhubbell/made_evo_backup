/**
 * Contentful Content Analyzer
 * 
 * Analyzes existing Contentful content to understand what's already on pages
 * before creating new entries from Figma designs.
 * 
 * This helps avoid duplicates and provides context for new content creation.
 */

import type { Page, ContentView } from '../../src/generated/contentful-types';
import { queryPages } from '../../src/lib/contentful/query-builder';
import { getByQuery } from '../../src/lib/contentful';
import type { WidgetType } from '../../src/lib/components/component-map';
import { getAdapter } from '../../src/lib/adapters/registry';

/**
 * Page content summary
 */
export interface PageContentSummary {
  /** Page ID */
  pageId: string;
  /** Page slug */
  slug: string;
  /** Page title */
  title?: string;
  /** Content views on this page */
  contentViews: ContentViewSummary[];
  /** Widget types used on this page */
  widgetTypes: WidgetType[];
  /** Total number of widgets */
  widgetCount: number;
}

/**
 * Content view summary
 */
export interface ContentViewSummary {
  /** Content view ID */
  id: string;
  /** Content view name */
  name: string;
  /** Widget type (inferred from adapter) */
  widgetType?: WidgetType;
  /** Adapter ID */
  adapterId?: string;
  /** Adapter name */
  adapterName?: string;
  /** Whether this is an atomic widget */
  isAtomic: boolean;
  /** Whether title is visible */
  isTitleVisible: boolean;
  /** Target content IDs (if any) */
  targetIds: string[];
}

/**
 * Site-wide content analysis
 */
export interface SiteContentAnalysis {
  /** All pages with their content */
  pages: PageContentSummary[];
  /** Widget type usage across all pages */
  widgetUsage: Map<WidgetType, number>;
  /** Content type usage */
  contentTypeUsage: Map<string, number>;
  /** Total pages */
  totalPages: number;
  /** Total widgets */
  totalWidgets: number;
}

/**
 * Analyze all pages and their content views
 * 
 * @returns Complete site content analysis
 */
export async function analyzeSiteContent(): Promise<SiteContentAnalysis> {
  // Query all pages with their content views
  const query = queryPages();
  const data = await getByQuery<{ pageCollection: { items: Page[] } }>(query);
  
  const pages: PageContentSummary[] = [];
  const widgetUsage = new Map<WidgetType, number>();
  const contentTypeUsage = new Map<string, number>();
  let totalWidgets = 0;
  
  for (const page of data.pageCollection.items) {
    const contentViews: ContentViewSummary[] = [];
    const widgetTypes: WidgetType[] = [];
    
    // Analyze each content view on the page
    if (page.contentViewCollection?.items) {
      for (const contentView of page.contentViewCollection.items) {
        const summary = analyzeContentView(contentView);
        contentViews.push(summary);
        
        if (summary.widgetType) {
          widgetTypes.push(summary.widgetType);
          
          // Track widget usage
          const currentCount = widgetUsage.get(summary.widgetType) || 0;
          widgetUsage.set(summary.widgetType, currentCount + 1);
        }
        
        // Track content type usage from target collection
        if (contentView.targetCollection?.items) {
          for (const target of contentView.targetCollection.items) {
            // Infer content type from the target entry
            // This is a simplified approach - in reality, we'd need to query the actual entries
            const contentType = inferContentType(target);
            if (contentType) {
              const currentCount = contentTypeUsage.get(contentType) || 0;
              contentTypeUsage.set(contentType, currentCount + 1);
            }
          }
        }
        
        totalWidgets++;
      }
    }
    
    pages.push({
      pageId: page.sys.id,
      slug: page.slug,
      title: page.title,
      contentViews,
      widgetTypes,
      widgetCount: contentViews.length,
    });
  }
  
  return {
    pages,
    widgetUsage,
    contentTypeUsage,
    totalPages: pages.length,
    totalWidgets,
  };
}

/**
 * Analyze a single content view
 */
function analyzeContentView(contentView: ContentView): ContentViewSummary {
  const adapterId = contentView.dataAdapter?.sys?.id;
  const adapterName = contentView.dataAdapter?.name;
  
  // Try to get widget type from adapter
  let widgetType: WidgetType | undefined;
  if (adapterId || adapterName) {
    try {
      const adapter = getAdapter(adapterId || adapterName || '');
      widgetType = adapter.outputType;
    } catch {
      // Adapter not found - widget type unknown
    }
  }
  
  // Extract target IDs
  const targetIds: string[] = [];
  if (contentView.targetCollection?.items) {
    for (const target of contentView.targetCollection.items) {
      if (target.sys?.id) {
        targetIds.push(target.sys.id);
      }
    }
  }
  
  return {
    id: contentView.sys.id,
    name: contentView.name,
    widgetType,
    adapterId,
    adapterName,
    isAtomic: contentView.isAtomic,
    isTitleVisible: contentView.isTitleVisible,
    targetIds,
  };
}

/**
 * Infer content type from a target entry
 * This is a simplified approach - in a real implementation, we'd query the actual entry
 */
function inferContentType(target: any): string | undefined {
  // Contentful GraphQL returns entries with __typename in some cases
  // For now, we'll use a heuristic based on the structure
  // In a full implementation, we'd query the entry to get its content type
  
  // This is a placeholder - actual implementation would query Contentful
  // to get the content type of each target entry
  return undefined;
}

/**
 * Get content summary for a specific page
 * 
 * @param slug - Page slug
 * @returns Page content summary or null if not found
 */
export async function getPageContent(slug: string): Promise<PageContentSummary | null> {
  const analysis = await analyzeSiteContent();
  return analysis.pages.find(p => p.slug === slug) || null;
}

/**
 * Check if a widget type is already used on a page
 * 
 * @param slug - Page slug
 * @param widgetType - Widget type to check
 * @returns True if widget type is already used on the page
 */
export async function isWidgetTypeUsedOnPage(
  slug: string,
  widgetType: WidgetType
): Promise<boolean> {
  const pageContent = await getPageContent(slug);
  if (!pageContent) return false;
  
  return pageContent.widgetTypes.includes(widgetType);
}

/**
 * Get all widget types used on a specific page
 * 
 * @param slug - Page slug
 * @returns Array of widget types used on the page
 */
export async function getPageWidgetTypes(slug: string): Promise<WidgetType[]> {
  const pageContent = await getPageContent(slug);
  return pageContent?.widgetTypes || [];
}

/**
 * Find pages that use a specific widget type
 * 
 * @param widgetType - Widget type to search for
 * @returns Array of page summaries that use this widget type
 */
export async function findPagesWithWidgetType(
  widgetType: WidgetType
): Promise<PageContentSummary[]> {
  const analysis = await analyzeSiteContent();
  return analysis.pages.filter(page => page.widgetTypes.includes(widgetType));
}

/**
 * Get widget usage statistics
 * 
 * @returns Map of widget type to usage count
 */
export async function getWidgetUsageStats(): Promise<Map<WidgetType, number>> {
  const analysis = await analyzeSiteContent();
  return analysis.widgetUsage;
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** Entry ID */
  entryId: string;
  /** Content type */
  contentType: string;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  /** Title similarity (0-1) */
  titleSimilarity: number;
  /** Other field similarities */
  fieldSimilarities: Map<string, number>;
  /** Entry data for reference */
  entryData?: any;
}

/**
 * Calculate text similarity using Levenshtein distance
 * Returns a score between 0 and 1 (1 = identical)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const s1 = text1.toLowerCase().trim();
  const s2 = text2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Use a simple similarity metric (Jaro-Winkler-like)
  // For exact substring match, return high similarity
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer;
  }
  
  // Calculate Levenshtein distance
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Find similar entries across all content types
 * 
 * @param extractedContent - Content extracted from Figma
 * @param contentType - Target content type
 * @param threshold - Minimum similarity threshold (0-1, default: 0.7)
 * @returns Array of similar entries sorted by similarity
 */
export async function findSimilarEntries(
  extractedContent: Record<string, any>,
  contentType: ContentType,
  threshold: number = 0.7
): Promise<SimilarityMatch[]> {
  // TODO: Query all entries of the specified content type from Contentful
  // For now, this is a placeholder that would need actual Contentful queries
  
  // This would need to:
  // 1. Query all entries of the content type
  // 2. Compare each entry's fields with extractedContent
  // 3. Calculate weighted similarity (title weighted heavily)
  // 4. Return matches above threshold
  
  const matches: SimilarityMatch[] = [];
  
  // Placeholder - in real implementation, query Contentful
  // const entries = await queryContentfulEntries(contentType);
  
  // For each entry, calculate similarity
  // for (const entry of entries) {
  //   const similarity = calculateEntrySimilarity(entry, extractedContent);
  //   if (similarity.similarity >= threshold) {
  //     matches.push(similarity);
  //   }
  // }
  
  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}

/**
 * Calculate similarity between an existing entry and extracted content
 * Title is weighted heavily (50% of total score)
 * 
 * @param entry - Existing Contentful entry
 * @param extractedContent - Content extracted from Figma
 * @returns Similarity match result
 */
export function calculateEntrySimilarity(
  entry: any,
  extractedContent: Record<string, any>
): SimilarityMatch {
  const fieldSimilarities = new Map<string, number>();
  let titleSimilarity = 0;
  let totalWeightedSimilarity = 0;
  let totalWeight = 0;
  
  // Title gets 50% weight
  const titleWeight = 0.5;
  if (extractedContent.title && entry.title) {
    titleSimilarity = calculateTextSimilarity(
      extractedContent.title,
      entry.title
    );
    totalWeightedSimilarity += titleSimilarity * titleWeight;
    totalWeight += titleWeight;
    fieldSimilarities.set('title', titleSimilarity);
  }
  
  // Description gets 20% weight
  const descriptionWeight = 0.2;
  if (extractedContent.description && entry.description) {
    const descSimilarity = calculateTextSimilarity(
      extractedContent.description,
      entry.description
    );
    totalWeightedSimilarity += descSimilarity * descriptionWeight;
    totalWeight += descriptionWeight;
    fieldSimilarities.set('description', descSimilarity);
  }
  
  // Slug gets 15% weight
  const slugWeight = 0.15;
  if (extractedContent.slug && entry.slug) {
    const slugSimilarity = calculateTextSimilarity(
      extractedContent.slug,
      entry.slug
    );
    totalWeightedSimilarity += slugSimilarity * slugWeight;
    totalWeight += slugWeight;
    fieldSimilarities.set('slug', slugSimilarity);
  }
  
  // Other fields get 15% weight combined
  const otherFieldsWeight = 0.15;
  const otherFields = Object.keys(extractedContent).filter(
    key => !['title', 'description', 'slug'].includes(key)
  );
  
  if (otherFields.length > 0) {
    let otherSimilarity = 0;
    for (const field of otherFields) {
      if (entry[field] && extractedContent[field]) {
        const fieldSim = calculateTextSimilarity(
          String(extractedContent[field]),
          String(entry[field])
        );
        otherSimilarity += fieldSim;
        fieldSimilarities.set(field, fieldSim);
      }
    }
    otherSimilarity = otherSimilarity / otherFields.length;
    totalWeightedSimilarity += otherSimilarity * otherFieldsWeight;
    totalWeight += otherFieldsWeight;
  }
  
  // Calculate final similarity score
  const finalSimilarity = totalWeight > 0 
    ? totalWeightedSimilarity / totalWeight 
    : 0;
  
  return {
    entryId: entry.sys?.id || '',
    contentType: entry.sys?.contentType?.sys?.id || '',
    similarity: finalSimilarity,
    titleSimilarity,
    fieldSimilarities,
    entryData: entry,
  };
}

/**
 * Check if content already exists that matches the design
 * 
 * @param slug - Page slug to check
 * @param widgetType - Widget type being added
 * @param extractedContent - Content extracted from Figma
 * @returns True if similar content already exists
 */
export async function checkForDuplicateContent(
  slug: string,
  widgetType: WidgetType,
  extractedContent: Record<string, any>
): Promise<boolean> {
  const pageContent = await getPageContent(slug);
  if (!pageContent) return false;
  
  // Check if this widget type is already on the page
  if (pageContent.widgetTypes.includes(widgetType)) {
    // Check for similar content by comparing titles
    // This is a simplified check - full implementation would query actual entries
    return true;
  }
  
  return false;
}

/**
 * Find the most similar entry for update
 * 
 * @param extractedContent - Content extracted from Figma
 * @param contentType - Target content type
 * @param threshold - Minimum similarity threshold (default: 0.7)
 * @returns Most similar entry match or null
 */
export async function findEntryToUpdate(
  extractedContent: Record<string, any>,
  contentType: ContentType,
  threshold: number = 0.7
): Promise<SimilarityMatch | null> {
  const similarEntries = await findSimilarEntries(
    extractedContent,
    contentType,
    threshold
  );
  
  // Return the most similar entry (first in sorted array)
  return similarEntries.length > 0 ? similarEntries[0] : null;
}

/**
 * Get recommendations for where to add new content
 * 
 * @param widgetType - Widget type to add
 * @param targetSlug - Target page slug (optional)
 * @returns Recommendations for content placement
 */
export async function getContentPlacementRecommendations(
  widgetType: WidgetType,
  targetSlug?: string
): Promise<{
  recommendedPage?: string;
  reason: string;
  existingUsage: number;
}> {
  const analysis = await analyzeSiteContent();
  const usage = analysis.widgetUsage.get(widgetType) || 0;
  
  if (targetSlug) {
    const pageContent = await getPageContent(targetSlug);
    if (pageContent) {
      const alreadyUsed = pageContent.widgetTypes.includes(widgetType);
      return {
        recommendedPage: targetSlug,
        reason: alreadyUsed
          ? 'Widget type already used on this page'
          : 'Target page specified',
        existingUsage: usage,
      };
    }
  }
  
  // Find pages that don't use this widget type
  const pagesWithoutWidget = analysis.pages.filter(
    page => !page.widgetTypes.includes(widgetType)
  );
  
  if (pagesWithoutWidget.length > 0) {
    // Recommend a page with fewer widgets
    const recommended = pagesWithoutWidget.sort(
      (a, b) => a.widgetCount - b.widgetCount
    )[0];
    
    return {
      recommendedPage: recommended.slug,
      reason: 'Page with fewest widgets that doesn\'t use this widget type',
      existingUsage: usage,
    };
  }
  
  return {
    reason: 'All pages already use this widget type',
    existingUsage: usage,
  };
}

