/**
 * Type-Safe Component Map
 *
 * Maps widget types to their corresponding components and data types.
 * This ensures type safety when rendering widgets from adapter data.
 */

import type {
  SplashWidgetData,
  GridWidgetData,
  CategorizedGridWidgetData,
  CalendarWidgetData,
  DoubleColumnWidgetData,
  SingleColumnWidgetData,
  MiniSplashWidgetData,
  VerticalTimelineWidgetData,
  ReportWidgetData,
  StoreWidgetData,
  GoogleFormWidgetData,
  ImageMarqueeWidgetData,
  WidgetData,
} from "../../schema/ui/widget-data";
import {
  isSplashWidgetData,
  isGridWidgetData,
  isCategorizedGridWidgetData,
  isCalendarWidgetData,
  isDoubleColumnWidgetData,
  isSingleColumnWidgetData,
  isMiniSplashWidgetData,
  isVerticalTimelineWidgetData,
  isReportWidgetData,
  isStoreWidgetData,
  isGoogleFormWidgetData,
  isImageMarqueeWidgetData,
} from "../../schema/ui/widget-data";

/**
 * Widget type identifiers
 */
export type WidgetType =
  | "splash"
  | "blockGrid"
  | "textGrid"
  | "categorizedGrid"
  | "calendar"
  | "doubleColumn"
  | "singleColumn"
  | "miniSplash"
  | "report"
  | "verticalTimeline"
  | "store"
  | "googleForm"
  | "imageMarquee";

/**
 * Component renderer function type
 * Takes widget data and returns a renderable component
 */
export type ComponentRenderer = (
  data: WidgetData,
  options: {
    title?: string;
    isTitleVisible: boolean;
    maxGridItems?: string;
  }
) => any;

/**
 * Type-safe mapping of widget types to their data types
 */
export type WidgetTypeToData = {
  splash: SplashWidgetData;
  blockGrid: GridWidgetData;
  textGrid: GridWidgetData;
  categorizedGrid: CategorizedGridWidgetData;
  calendar: CalendarWidgetData;
  doubleColumn: DoubleColumnWidgetData;
  singleColumn: SingleColumnWidgetData;
  miniSplash: MiniSplashWidgetData;
  report: ReportWidgetData;
  verticalTimeline: VerticalTimelineWidgetData;
  store: StoreWidgetData;
  googleForm: GoogleFormWidgetData;
  imageMarquee: ImageMarqueeWidgetData;
};

/**
 * Validates that widget data matches the expected type for a widget
 * For empty arrays, we rely on the widgetType parameter to determine the correct type
 */
export function validateWidgetData<T extends WidgetType>(
  widgetType: T,
  data: WidgetData
): data is WidgetTypeToData[T] {
  switch (widgetType) {
    case "splash":
      return isSplashWidgetData(data);
    case "blockGrid":
    case "textGrid":
      // For empty arrays, accept if it has items array (structure matches)
      return isGridWidgetData(data);
    case "categorizedGrid":
      return isCategorizedGridWidgetData(data);
    case "calendar":
      // For empty arrays, accept if it has items array (structure matches)
      return isCalendarWidgetData(data);
    case "doubleColumn":
      // For empty arrays, accept if it has items array (structure matches)
      // Note: doubleColumn and singleColumn have same structure, so we trust widgetType
      return isDoubleColumnWidgetData(data) || isSingleColumnWidgetData(data);
    case "singleColumn":
      // For empty arrays, accept if it has items array (structure matches)
      // Note: doubleColumn and singleColumn have same structure, so we trust widgetType
      return isSingleColumnWidgetData(data) || isDoubleColumnWidgetData(data);
    case "miniSplash":
      // For empty arrays, accept if it has items array (structure matches)
      // Mini splash has same structure as double/single column but requires images
      return (
        isMiniSplashWidgetData(data) ||
        isDoubleColumnWidgetData(data) ||
        isSingleColumnWidgetData(data)
      );
    case "report":
      return isReportWidgetData(data);
    case "verticalTimeline":
      // For empty arrays, accept if it has items array (structure matches)
      return isVerticalTimelineWidgetData(data);
    case "store":
      return isStoreWidgetData(data);
    case "googleForm":
      return isGoogleFormWidgetData(data);
    case "imageMarquee":
      return isImageMarqueeWidgetData(data);
    default:
      return false;
  }
}

/**
 * Gets a human-readable error message for invalid widget data
 */
export function getWidgetDataErrorMessage(
  widgetType: WidgetType,
  data: WidgetData
): string {
  const expectedType = widgetType;
  const actualType = getWidgetDataType(data);

  return (
    `Widget type mismatch: Expected "${expectedType}" but received "${actualType}". ` +
    `Data structure: ${JSON.stringify(Object.keys(data)).slice(0, 100)}`
  );
}

/**
 * Infers the widget type from widget data structure
 * Note: For empty arrays, this may not be able to distinguish between similar types
 * (e.g., doubleColumn vs singleColumn, grid vs calendar vs verticalTimeline)
 *
 * IMPORTANT: Check atomic types (splash, report) FIRST because they have distinct
 * structures (no 'items' property). If data has 'items', it cannot be splash or report.
 */
export function getWidgetDataType(data: WidgetData): string {
  // Check atomic types first - they have distinct structures
  if (isSplashWidgetData(data)) return "splash";
  if (isReportWidgetData(data)) return "report";
  if (isStoreWidgetData(data)) return "store";
  if (isGoogleFormWidgetData(data)) return "googleForm";

  // If data has 'items', it's a collection type (not atomic)
  // For empty arrays, we can't distinguish between similar collection types
  // Check more specific types first
  if (isVerticalTimelineWidgetData(data)) return "verticalTimeline";
  if (isCalendarWidgetData(data)) return "calendar";
  if (isCategorizedGridWidgetData(data)) return "categorizedGrid";
  if (isMiniSplashWidgetData(data)) return "miniSplash";
  if (isDoubleColumnWidgetData(data)) return "doubleColumn";
  if (isSingleColumnWidgetData(data)) return "singleColumn";
  // Check before grid: image marquee items only have 'image' (no content/date), which
  // would otherwise also satisfy the looser grid heuristic.
  if (isImageMarqueeWidgetData(data)) return "imageMarquee";
  if (isGridWidgetData(data)) return "grid";
  return "unknown";
}

/**
 * Type guard to check if a widget type is valid
 */
export function isValidWidgetType(type: string): type is WidgetType {
  return [
    "splash",
    "blockGrid",
    "textGrid",
    "categorizedGrid",
    "calendar",
    "doubleColumn",
    "singleColumn",
    "miniSplash",
    "report",
    "verticalTimeline",
    "store",
    "googleForm",
    "imageMarquee",
  ].includes(type);
}
