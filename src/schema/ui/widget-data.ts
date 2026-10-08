/**
 * WidgetData - Standardized return types for all data adapters
 *
 * This union type represents all possible return shapes from adapter functions.
 * It ensures type safety and consistency across all adapters.
 */

import type { z } from "zod";
import { SplashPropsSchema } from "./index";
type SplashProps = z.infer<typeof SplashPropsSchema>;
import type {
  GridItem,
  GridCategory,
  TimelineItem,
  DoubleColumnItem,
  CalendarEvent,
  ImageMarqueeItem,
} from "./index";
import type { Report } from "./report";

/**
 * WidgetData - Union type for all adapter return values
 *
 * Adapters return different shapes based on their widget type:
 * - Atomic widgets (splash, report) return the widget props directly or wrapped
 * - Collection widgets (grid, calendar, etc.) return { items: T[] }
 */
export type WidgetData =
  | SplashWidgetData
  | GridWidgetData
  | CategorizedGridWidgetData
  | CalendarWidgetData
  | DoubleColumnWidgetData
  | SingleColumnWidgetData
  | MiniSplashWidgetData
  | VerticalTimelineWidgetData
  | ReportWidgetData
  | StoreWidgetData
  | GoogleFormWidgetData
  | ImageMarqueeWidgetData;

/**
 * Splash widget data (atomic)
 * Returns SplashProps directly
 */
export type SplashWidgetData = SplashProps;

/**
 * Grid widget data
 * Returns array of grid items
 */
export type GridWidgetData = {
  items: GridItem[];
};

/**
 * Categorized grid widget data
 * Returns categories, each with name, optional description, and grid items
 */
export type CategorizedGridWidgetData = {
  categories: GridCategory[];
};

/**
 * Calendar widget data
 * Returns array of calendar events
 */
export type CalendarWidgetData = {
  items: CalendarEvent[];
};

/**
 * Double column widget data
 * Returns array of double column items
 */
export type DoubleColumnWidgetData = {
  items: DoubleColumnItem[];
};

/**
 * Single column widget data
 * Uses the same shape as double column
 */
export type SingleColumnWidgetData = {
  items: DoubleColumnItem[];
};

/**
 * Mini splash widget data
 * Uses the same shape as double column (but requires images)
 */
export type MiniSplashWidgetData = {
  items: DoubleColumnItem[];
};

/**
 * Vertical timeline widget data
 * Returns array of timeline items
 */
export type VerticalTimelineWidgetData = {
  items: TimelineItem[];
};

/**
 * Report widget data (atomic)
 * Returns report object wrapped in { report: Report }
 */
export type ReportWidgetData = {
  report: Report;
};

/**
 * Store widget data (atomic)
 * Store widgets don't need data from adapters - they're static components
 */
export type StoreWidgetData = {
  // Store widgets are atomic and don't require data
  // This is a minimal structure to satisfy the type system
  type: "store";
};

/**
 * Google Form widget data (atomic)
 * Renders the native Google Form UI via GoogleFormLoader; slug is used to fetch form schema.
 */
export type GoogleFormWidgetData = {
  slug: string;
};

/**
 * Image marquee widget data
 * Returns array of logo/image marquee items
 */
export type ImageMarqueeWidgetData = {
  items: ImageMarqueeItem[];
};

/**
 * Type guard to check if WidgetData is a collection type (has items or categories)
 */
export function isCollectionWidgetData(
  data: WidgetData
): data is
  | GridWidgetData
  | CategorizedGridWidgetData
  | CalendarWidgetData
  | DoubleColumnWidgetData
  | SingleColumnWidgetData
  | MiniSplashWidgetData
  | VerticalTimelineWidgetData
  | ImageMarqueeWidgetData {
  return (
    ("items" in data && Array.isArray(data.items)) ||
    ("categories" in data && Array.isArray(data.categories))
  );
}

/**
 * Type guard to check if WidgetData is a splash widget
 * Splash is an atomic widget - it does NOT have an 'items' property
 */
export function isSplashWidgetData(data: WidgetData): data is SplashWidgetData {
  // Splash widgets are atomic - they don't have 'items'
  // If data has 'items', it's definitely not a splash widget
  if ("items" in data) return false;
  return (
    "contents" in data && Array.isArray(data.contents) && "padding" in data
  );
}

/**
 * Type guard to check if WidgetData is a grid widget
 * Handles empty arrays by checking structure only
 */
export function isGridWidgetData(data: WidgetData): data is GridWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches GridWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure
  return "image" in data.items[0] || "title" in data.items[0];
}

/**
 * Type guard to check if WidgetData is a categorized grid widget
 */
export function isCategorizedGridWidgetData(
  data: WidgetData
): data is CategorizedGridWidgetData {
  if (!("categories" in data) || !Array.isArray(data.categories)) return false;
  if (data.categories.length === 0) return true;
  const cat = data.categories[0];
  return (
    typeof cat === "object" &&
    cat !== null &&
    "name" in cat &&
    "items" in cat &&
    Array.isArray(cat.items)
  );
}

/**
 * Type guard to check if WidgetData is a calendar widget
 * Handles empty arrays by checking structure only
 */
export function isCalendarWidgetData(
  data: WidgetData
): data is CalendarWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches CalendarWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure
  return "date" in data.items[0] && "title" in data.items[0];
}

/**
 * Type guard to check if WidgetData is a double column widget
 * Handles empty arrays by checking structure only
 */
export function isDoubleColumnWidgetData(
  data: WidgetData
): data is DoubleColumnWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches DoubleColumnWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure
  return "content" in data.items[0] && "title" in data.items[0];
}

/**
 * Type guard to check if WidgetData is a single column widget
 * Handles empty arrays by checking structure only
 */
export function isSingleColumnWidgetData(
  data: WidgetData
): data is SingleColumnWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches SingleColumnWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure
  return "content" in data.items[0] && "title" in data.items[0];
}

/**
 * Type guard to check if WidgetData is a mini splash widget
 * Handles empty arrays by checking structure only
 * Mini splash requires images, so we check for image field
 */
export function isMiniSplashWidgetData(
  data: WidgetData
): data is MiniSplashWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches MiniSplashWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure - must have content, title, and image
  return (
    "content" in data.items[0] &&
    "title" in data.items[0] &&
    "image" in data.items[0] &&
    !!data.items[0].image
  );
}

/**
 * Type guard to check if WidgetData is a vertical timeline widget
 * Handles empty arrays by checking structure only
 */
export function isVerticalTimelineWidgetData(
  data: WidgetData
): data is VerticalTimelineWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  // If empty, we can't determine type from content, but structure matches VerticalTimelineWidgetData
  if (data.items.length === 0) return true;
  // If has items, check first item structure
  return (
    "date" in data.items[0] &&
    "title" in data.items[0] &&
    "description" in data.items[0]
  );
}

/**
 * Type guard to check if WidgetData is a report widget
 * Report is an atomic widget - it has 'report' property, not 'items'
 */
export function isReportWidgetData(data: WidgetData): data is ReportWidgetData {
  // Report widgets are atomic - they have 'report', not 'items'
  // If data has 'items', it's definitely not a report widget
  if ("items" in data) return false;
  return "report" in data && typeof data.report === "object";
}

/**
 * Type guard to check if WidgetData is a store widget
 * Store is an atomic widget - it doesn't have 'items' or 'report'
 */
export function isStoreWidgetData(data: WidgetData): data is StoreWidgetData {
  // Store widgets are atomic - they don't have 'items' or 'report'
  if ("items" in data || "report" in data) return false;
  return "type" in data && data.type === "store";
}

/**
 * Type guard to check if WidgetData is a Google Form widget
 */
export function isGoogleFormWidgetData(
  data: WidgetData
): data is GoogleFormWidgetData {
  if (
    "items" in data ||
    "report" in data ||
    ("type" in data && data.type === "store")
  )
    return false;
  return (
    "slug" in data && typeof (data as GoogleFormWidgetData).slug === "string"
  );
}

/**
 * Type guard to check if WidgetData is an image marquee widget
 * Handles empty arrays by checking structure only
 */
export function isImageMarqueeWidgetData(
  data: WidgetData
): data is ImageMarqueeWidgetData {
  if (!("items" in data) || !Array.isArray(data.items)) return false;
  if (data.items.length === 0) return true;
  // If has items, check first item structure - must have an image, but no content/date (unlike other collection types)
  return (
    "image" in data.items[0] &&
    !("content" in data.items[0]) &&
    !("date" in data.items[0])
  );
}
