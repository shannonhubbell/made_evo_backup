/**
 * Adapter Validation Utilities
 * 
 * Provides validation helpers for the adapter validation chain:
 * 1. Validate Contentful API responses (before transformation)
 * 2. Validate UI widget data (after transformation)
 */

import { z } from 'zod';
import type {
  ProgramSchema,
  EventSchema,
  PostSchema,
  PageSchema,
  ExhibitSchema,
  MemberSchema,
  PressSchema,
  ImpactReportSchema,
  ProgramCollectionSchema,
  EventCollectionSchema,
  PostCollectionSchema,
  PageCollectionSchema,
  ExhibitCollectionSchema,
  MemberCollectionSchema,
  PressCollectionSchema,
} from '../../schema/contentful';
import type {
  GridItemSchema,
  CalendarEventSchema,
  DoubleColumnItemSchema,
  TimelineItemSchema,
  SplashPropsSchema,
} from '../../schema/ui';
import type { ReportSchema } from '../../schema/ui/report';

/**
 * Validation error with context
 */
export class AdapterValidationError extends Error {
  constructor(
    message: string,
    public readonly stage: 'contentful' | 'ui',
    public readonly originalError?: z.ZodError
  ) {
    super(message);
    this.name = 'AdapterValidationError';
  }
}

/**
 * Validate Contentful data before transformation
 * 
 * @param data - Raw Contentful API response
 * @param schema - Zod schema to validate against
 * @param context - Context for error messages
 * @returns Validated data
 * @throws AdapterValidationError if validation fails
 */
export function validateContentfulData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdapterValidationError(
        `Contentful validation failed for ${context}: ${error.message}`,
        'contentful',
        error
      );
    }
    throw error;
  }
}

/**
 * Validate UI widget data after transformation
 * 
 * @param data - Transformed UI data
 * @param schema - Zod schema to validate against
 * @param context - Context for error messages
 * @returns Validated data
 * @throws AdapterValidationError if validation fails
 */
export function validateUIData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AdapterValidationError(
        `UI validation failed for ${context}: ${error.message}`,
        'ui',
        error
      );
    }
    throw error;
  }
}

/**
 * Validate an array of Contentful items
 */
export function validateContentfulCollection<T>(
  items: unknown[],
  itemSchema: z.ZodSchema<T>,
  context: string
): T[] {
  return items.map((item, index) => {
    try {
      return validateContentfulData(item, itemSchema, `${context}[${index}]`);
    } catch (error) {
      if (error instanceof AdapterValidationError) {
        throw new AdapterValidationError(
          `Failed to validate item ${index} in ${context}: ${error.message}`,
          'contentful',
          error.originalError
        );
      }
      throw error;
    }
  });
}

/**
 * Validate an array of UI items
 */
export function validateUICollection<T>(
  items: unknown[],
  itemSchema: z.ZodSchema<T>,
  context: string
): T[] {
  return items.map((item, index) => {
    try {
      return validateUIData(item, itemSchema, `${context}[${index}]`);
    } catch (error) {
      if (error instanceof AdapterValidationError) {
        throw new AdapterValidationError(
          `Failed to validate UI item ${index} in ${context}: ${error.message}`,
          'ui',
          error.originalError
        );
      }
      throw error;
    }
  });
}

/**
 * Safe validation wrapper that returns null on error instead of throwing
 * Useful for graceful degradation
 */
export function safeValidateContentfulData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T | null {
  try {
    return validateContentfulData(data, schema, context);
  } catch (error) {
    console.warn(`Validation warning for ${context}:`, error);
    return null;
  }
}

/**
 * Safe validation wrapper for UI data
 */
export function safeValidateUIData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T | null {
  try {
    return validateUIData(data, schema, context);
  } catch (error) {
    console.warn(`UI validation warning for ${context}:`, error);
    return null;
  }
}

