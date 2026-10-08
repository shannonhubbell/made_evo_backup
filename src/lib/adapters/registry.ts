/**
 * Adapter Registry
 *
 * Type-safe registry for Contentful data adapters.
 * Replaces string-based adapter lookup with a type-safe system.
 *
 * Usage:
 *   import { getAdapter } from './registry';
 *   const adapter = getAdapter(adapterId);
 *   const result = await adapter.handler(keys, values, targetIDs, isAtomic);
 */

import {
  splashFromPage,
  splashFromPrograms,
  gridFromExhibits,
  gridFromEvents,
  gridFromPrograms,
  gridFromMembers,
  gridFromPosts,
  categorizedGridFromUpcomingEvents,
  verticalTimelineFromPress,
  verticalTimelineFromHistory,
  impactReportFromImpactReport,
  calendarFromEvents,
  doubleColumnFromPosts,
  doubleColumnFromPrograms,
  singleColumnFromPosts,
  singleColumnFromUpcomingEvents,
  miniSplashFromPosts,
  miniSplashFromUpcomingEvents,
  googleFormFromGoogleForm,
  imageMarqueeFromOrganizations,
} from "../adapters";

import type { WidgetData } from "../../schema/ui/widget-data";

/**
 * Adapter function signature
 * All adapters follow this pattern and return standardized WidgetData
 */
export type AdapterFunction = (
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
) => Promise<WidgetData>;

/**
 * Widget types that adapters can produce
 */
export type WidgetType =
  | "splash"
  | "grid"
  | "categorizedGrid"
  | "calendar"
  | "verticalTimeline"
  | "report"
  | "doubleColumn"
  | "singleColumn"
  | "miniSplash"
  | "googleForm"
  | "imageMarquee";

/**
 * Content types that adapters can accept as input
 */
export type ContentType =
  | "Page"
  | "Program"
  | "Event"
  | "Post"
  | "Exhibit"
  | "Member"
  | "Press"
  | "ImpactReport"
  | "GoogleForm"
  | "Organization";

/**
 * Adapter definition metadata
 */
export interface AdapterDefinition {
  /** Stable identifier for the adapter (used for lookup in code) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Contentful entry name; used as the key from Contentful data (nameToStableId) */
  contentfulName: string;
  /** The adapter function */
  handler: AdapterFunction;
  /** Which Contentful content types this adapter accepts */
  inputTypes: ContentType[];
  /** Which widget type this adapter produces */
  outputType: WidgetType;
  /** Whether this adapter produces atomic widgets (single item) */
  isAtomic: boolean;
  /** Description of what the adapter does */
  description?: string;
}

/**
 * Adapter Registry
 *
 * Maps adapter IDs to their definitions.
 *
 * Note: During migration, we support both:
 * - Lookup by stable ID (preferred)
 * - Lookup by Contentful entry name (for backward compatibility)
 */
export const adapterRegistry = new Map<string, AdapterDefinition>();

/**
 * Register an adapter in the registry
 */
export function registerAdapter(definition: AdapterDefinition): void {
  adapterRegistry.set(definition.id, definition);
  adapterRegistry.set(definition.contentfulName, definition);
}

/**
 * Get an adapter by ID or Contentful name
 *
 * @param identifier - Adapter ID or Contentful entry name
 * @returns Adapter definition if found
 * @throws Error if adapter not found
 */
export function getAdapter(identifier: string): AdapterDefinition {
  const adapter = adapterRegistry.get(identifier);

  if (!adapter) {
    const availableIds = Array.from(adapterRegistry.keys())
      .filter((key) => !key.includes("Data Adapter:")) // Filter out Contentful names
      .join(", ");

    throw new Error(
      `Adapter not found: "${identifier}". ` +
        `Available adapter IDs: ${availableIds || "none"}`
    );
  }

  return adapter;
}

/**
 * Check if an adapter exists in the registry
 */
export function hasAdapter(identifier: string): boolean {
  return adapterRegistry.has(identifier);
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): AdapterDefinition[] {
  // Return only unique adapters (by ID, not Contentful name)
  const seen = new Set<string>();
  const adapters: AdapterDefinition[] = [];

  for (const adapter of adapterRegistry.values()) {
    if (!seen.has(adapter.id)) {
      seen.add(adapter.id);
      adapters.push(adapter);
    }
  }

  return adapters;
}

// Register all adapters
// Note: isAtomic values match the original switch statement in getAdapterDataByType
registerAdapter({
  id: "splash-from-page",
  name: "Splash from Page",
  contentfulName: "Data Adapter: Splash from Page",
  handler: splashFromPage,
  inputTypes: ["Page"],
  outputType: "splash",
  isAtomic: true,
  description: "Creates a splash widget from a Page content type",
});

registerAdapter({
  id: "splash-from-program",
  name: "Splash from Program",
  contentfulName: "Data Adapter: Splash from Program",
  handler: splashFromPrograms,
  inputTypes: ["Program"],
  outputType: "splash",
  isAtomic: true,
  description: "Creates a splash widget from Program content types",
});

registerAdapter({
  id: "grid-from-exhibits",
  name: "Grid Items from Exhibits",
  contentfulName: "Data Adapter: Grid Items from Exhibits",
  handler: gridFromExhibits,
  inputTypes: ["Exhibit"],
  outputType: "grid",
  isAtomic: false,
  description: "Creates grid items from Exhibit content types",
});

registerAdapter({
  id: "grid-from-events",
  name: "Grid Items from Events",
  contentfulName: "Data Adapter: Grid Items from Events",
  handler: gridFromEvents,
  inputTypes: ["Event"],
  outputType: "grid",
  isAtomic: false,
  description:
    'Creates grid items from Event content types. Supports an optional "keyword" key/value pair to filter events by a matching Contentful tag (e.g. keyword="featured" only shows events tagged "featured").',
});

registerAdapter({
  id: "categorized-grid-from-upcoming-events",
  name: "Categorized Catalog from Upcoming Events",
  contentfulName: "Data Adapter: Categorized Catalog from Upcoming Events",
  handler: categorizedGridFromUpcomingEvents,
  inputTypes: ["Event"],
  outputType: "categorizedGrid",
  isAtomic: false,
  description: "Upcoming events grouped by program for CategorizedCatalog",
});

registerAdapter({
  id: "grid-from-programs",
  name: "Grid Items from Programs",
  contentfulName: "Data Adapter: Grid Items from Programs",
  handler: gridFromPrograms,
  inputTypes: ["Program"],
  outputType: "grid",
  isAtomic: false,
  description: "Creates grid items from Program content types",
});

registerAdapter({
  id: "grid-from-members",
  name: "Grid Items from Members",
  contentfulName: "Data Adapter: Grid Items from Members",
  handler: gridFromMembers,
  inputTypes: ["Member"],
  outputType: "grid",
  isAtomic: false,
  description: "Creates grid items from Member content types",
});

registerAdapter({
  id: "grid-from-posts",
  name: "Grid Items from Posts",
  contentfulName: "Data Adapter: Grid Items from Posts",
  handler: gridFromPosts,
  inputTypes: ["Post"],
  outputType: "grid",
  isAtomic: false,
  description: "Creates grid items from Post content types",
});

registerAdapter({
  id: "vertical-timeline-from-press",
  name: "Vertical Timeline Items from Press",
  contentfulName: "Data Adapter: Vertical Timeline Items from Press",
  handler: verticalTimelineFromPress,
  inputTypes: ["Press"],
  outputType: "verticalTimeline",
  isAtomic: false,
  description: "Creates vertical timeline items from Press content types",
});

registerAdapter({
  id: "vertical-timeline-from-history",
  name: "Vertical Timeline Items from History",
  contentfulName: "Data Adapter: Vertical Timeline Items from History",
  handler: verticalTimelineFromHistory,
  inputTypes: ["Post"],
  outputType: "verticalTimeline",
  isAtomic: false,
  description:
    "Creates vertical timeline items from Post content types (history tagged)",
});

registerAdapter({
  id: "report-from-impact-report",
  name: "Report from Impact Report",
  contentfulName: "Data Adapter: Report from Impact Report",
  handler: impactReportFromImpactReport,
  inputTypes: ["ImpactReport"],
  outputType: "report",
  isAtomic: true, // Report widgets are atomic (single report object), not collections
  description: "Creates a report widget from ImpactReport content type",
});

registerAdapter({
  id: "calendar-from-events",
  name: "Calendar Items from Events",
  contentfulName: "Data Adapter: Calendar Items from Events",
  handler: calendarFromEvents,
  inputTypes: ["Event"],
  outputType: "calendar",
  isAtomic: false,
  description: "Creates calendar items from Event content types",
});

registerAdapter({
  id: "double-column-from-posts",
  name: "Double Column from Posts",
  contentfulName: "Data Adapter: Double Column from Posts",
  handler: doubleColumnFromPosts,
  inputTypes: ["Post"],
  outputType: "doubleColumn",
  isAtomic: true,
  description: "Creates double column items from Post content types",
});

registerAdapter({
  id: "double-column-from-programs",
  name: "Double Column from Programs",
  contentfulName: "Data Adapter: Double Column from Programs",
  handler: doubleColumnFromPrograms,
  inputTypes: ["Program"],
  outputType: "doubleColumn",
  isAtomic: true,
  description: "Creates double column items from Program content types",
});

registerAdapter({
  id: "single-column-from-posts",
  name: "Single Column from Posts",
  contentfulName: "Data Adapter: Single Column from Posts",
  handler: singleColumnFromPosts,
  inputTypes: ["Post"],
  outputType: "singleColumn",
  isAtomic: true,
  description: "Creates single column items from Post content types",
});

registerAdapter({
  id: "single-column-from-upcoming-events",
  name: "Single Column from Upcoming Events",
  contentfulName: "Data Adapter: Single Column from Upcoming Events",
  handler: singleColumnFromUpcomingEvents,
  inputTypes: ["Program"],
  outputType: "singleColumn",
  isAtomic: true,
  description: "Creates single column items from Event content types",
});

registerAdapter({
  id: "mini-splash-from-posts",
  name: "Mini Splash from Posts",
  contentfulName: "Data Adapter: Mini Splash from Posts",
  handler: miniSplashFromPosts,
  inputTypes: ["Post"],
  outputType: "miniSplash",
  isAtomic: true,
  description: "Creates mini splash items from Post content types",
});

registerAdapter({
  id: "mini-splash-from-upcoming-events",
  name: "Mini Splash from Upcoming Events",
  contentfulName: "Data Adapter: Mini Splash from Upcoming Events",
  handler: miniSplashFromUpcomingEvents,
  inputTypes: ["Program"],
  outputType: "miniSplash",
  isAtomic: true,
  description: "Creates mini splash items from Event content types",
});

registerAdapter({
  id: "google-form-ui-from-google-form",
  name: "Google Form UI from Google Form",
  contentfulName: "Data Adapter: Google Form UI from Google Form",
  handler: googleFormFromGoogleForm,
  inputTypes: ["GoogleForm"],
  outputType: "googleForm",
  isAtomic: true,
  description:
    "Renders native Google Form UI from a GoogleForm content type (slug)",
});

registerAdapter({
  id: "image-marquee-from-organizations",
  name: "Image Marquee from Organizations",
  contentfulName: "Data Adapter: Image Marquee from Organizations",
  handler: imageMarqueeFromOrganizations,
  inputTypes: ["Organization"],
  outputType: "imageMarquee",
  isAtomic: false,
  description:
    "Creates an auto-rotating logo marquee from Organization content types",
});
