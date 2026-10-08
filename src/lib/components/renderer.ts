/**
 * Type-Safe Component Renderer
 *
 * Provides runtime type checking and safe component rendering
 * for widget data from adapters.
 */

import type { WidgetData } from "../../schema/ui/widget-data";
import {
  validateWidgetData,
  getWidgetDataErrorMessage,
  isValidWidgetType,
  type WidgetType,
} from "./component-map";

/**
 * Error thrown when widget data doesn't match expected type
 */
export class WidgetTypeMismatchError extends Error {
  constructor(
    public widgetType: WidgetType,
    public data: WidgetData,
    public message: string
  ) {
    super(message);
    this.name = "WidgetTypeMismatchError";
  }
}

/**
 * Options for rendering widgets
 */
export interface RenderOptions {
  title?: string;
  isTitleVisible: boolean;
  maxGridItems?: string;
}

/**
 * Validates widget data before rendering
 * Throws WidgetTypeMismatchError if validation fails
 */
export function validateWidgetDataForRendering(
  widgetType: string,
  data: WidgetData
): asserts data is WidgetData {
  if (!isValidWidgetType(widgetType)) {
    throw new Error(
      `Invalid widget type: "${widgetType}". ` +
        `Valid types are: splash, blockGrid, textGrid, calendar, doubleColumn, singleColumn, miniSplash, report, verticalTimeline, store, googleForm, imageMarquee`
    );
  }

  if (!validateWidgetData(widgetType, data)) {
    const errorMessage = getWidgetDataErrorMessage(widgetType, data);
    throw new WidgetTypeMismatchError(widgetType, data, errorMessage);
  }
}

/**
 * Gets a safe error component for rendering errors
 */
export function getErrorComponent(error: Error, widgetType: string): string {
  return `
    <div class="lg:container mx-auto px-4 py-8">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 class="text-red-800 dark:text-red-200 font-semibold mb-2">
          Widget Rendering Error
        </h3>
        <p class="text-red-700 dark:text-red-300 text-sm mb-2">
          <strong>Widget Type:</strong> ${widgetType}
        </p>
        <p class="text-red-700 dark:text-red-300 text-sm">
          <strong>Error:</strong> ${error.message}
        </p>
        ${
          error instanceof WidgetTypeMismatchError
            ? `
          <details class="mt-2">
            <summary class="text-red-700 dark:text-red-300 text-xs cursor-pointer">
              Technical Details
            </summary>
            <pre class="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto">
              ${JSON.stringify(error.data, null, 2).slice(0, 500)}
            </pre>
          </details>
        `
            : ""
        }
      </div>
    </div>
  `;
}
