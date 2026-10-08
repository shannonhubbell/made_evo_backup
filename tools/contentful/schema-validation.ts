/**
 * Schema Validation Helpers
 * 
 * Provides validation utilities for the widget mapping system:
 * - Validate extracted content against Contentful schemas
 * - Validate field mappings
 * - Validate widget data against UI schemas
 * - Map between widget fields and Contentful fields
 * 
 * Part of Phase 1: Core Mapping System
 */

import { z } from 'zod';
import type { WidgetType } from '../../src/lib/components/component-map';
import type { ContentType } from '../../src/lib/adapters/registry';
import {
  getWidgetMapping,
  getRequiredFields,
  getOptionalFields,
  getFieldMapping,
} from './widget-mapping';
import {
  ProgramSchema,
  EventSchema,
  PostSchema,
  PageSchema,
  ExhibitSchema,
  MemberSchema,
  PressSchema,
  ImpactReportSchema,
} from '../../src/schema/contentful';
import {
  GridItemSchema,
  CalendarEventSchema,
  DoubleColumnItemSchema,
  TimelineItemSchema,
  SplashPropsSchema,
} from '../../src/schema/ui';
import { ReportSchema } from '../../src/schema/ui/report';

/**
 * Content type to schema mapping
 */
const CONTENT_TYPE_SCHEMAS: Record<ContentType, z.ZodSchema<any>> = {
  Page: PageSchema,
  Program: ProgramSchema,
  Event: EventSchema,
  Post: PostSchema,
  Exhibit: ExhibitSchema,
  Member: MemberSchema,
  Press: PressSchema,
  ImpactReport: ImpactReportSchema,
};

/**
 * Widget type to UI schema mapping
 */
const WIDGET_UI_SCHEMAS: Record<WidgetType, z.ZodSchema<any>> = {
  splash: SplashPropsSchema,
  blockGrid: z.object({ items: z.array(GridItemSchema) }),
  textGrid: z.object({ items: z.array(GridItemSchema) }),
  calendar: z.object({ items: z.array(CalendarEventSchema) }),
  doubleColumn: z.object({ items: z.array(DoubleColumnItemSchema) }),
  singleColumn: z.object({ items: z.array(DoubleColumnItemSchema) }),
  verticalTimeline: z.object({ items: z.array(TimelineItemSchema) }),
  report: z.object({ report: ReportSchema }),
  store: z.object({ type: z.literal('store') }),
};

/**
 * Validation error with context
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly widgetType?: WidgetType,
    public readonly contentType?: ContentType,
    public readonly originalError?: z.ZodError
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validate extracted content against Contentful schema for a content type
 * 
 * @param content - Extracted content to validate
 * @param contentType - Target Contentful content type
 * @returns Validated content
 * @throws SchemaValidationError if validation fails
 */
export function validateContentfulSchema(
  content: unknown,
  contentType: ContentType
): any {
  const schema = CONTENT_TYPE_SCHEMAS[contentType];
  
  if (!schema) {
    throw new SchemaValidationError(
      `No schema found for content type: ${contentType}`,
      undefined,
      undefined,
      contentType
    );
  }
  
  try {
    return schema.parse(content);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SchemaValidationError(
        `Contentful schema validation failed for ${contentType}: ${error.message}`,
        undefined,
        undefined,
        contentType,
        error
      );
    }
    throw error;
  }
}

/**
 * Validate widget data against UI schema for a widget type
 * 
 * @param data - Widget data to validate
 * @param widgetType - Widget type
 * @returns Validated widget data
 * @throws SchemaValidationError if validation fails
 */
export function validateWidgetSchema(
  data: unknown,
  widgetType: WidgetType
): any {
  const schema = WIDGET_UI_SCHEMAS[widgetType];
  
  if (!schema) {
    throw new SchemaValidationError(
      `No UI schema found for widget type: ${widgetType}`,
      undefined,
      widgetType
    );
  }
  
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SchemaValidationError(
        `Widget schema validation failed for ${widgetType}: ${error.message}`,
        undefined,
        widgetType,
        undefined,
        error
      );
    }
    throw error;
  }
}

/**
 * Validate that extracted fields match required fields for a widget
 * 
 * @param extractedFields - Fields extracted from Figma/LLM
 * @param widgetType - Widget type
 * @returns Validation result with missing fields
 */
export function validateRequiredFields(
  extractedFields: Record<string, any>,
  widgetType: WidgetType
): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const requiredFields = getRequiredFields(widgetType);
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  for (const field of requiredFields) {
    if (!extractedFields[field.fieldName]) {
      // Check if field is truly required (some may be conditionally required)
      if (field.required) {
        missingFields.push(field.fieldName);
      } else {
        warnings.push(`Optional required field missing: ${field.fieldName}`);
      }
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

/**
 * Validate field type matches Contentful field type
 * 
 * @param fieldName - Field name
 * @param value - Field value
 * @param widgetType - Widget type
 * @returns True if field type is valid
 */
export function validateFieldType(
  fieldName: string,
  value: any,
  widgetType: WidgetType
): boolean {
  const fieldMapping = getFieldMapping(widgetType, fieldName);
  
  if (!fieldMapping) {
    // Field not in mapping - might be valid but not mapped
    return true;
  }
  
  const expectedType = fieldMapping.fieldType;
  const actualType = typeof value;
  
  // Basic type checking
  switch (expectedType) {
    case 'Text':
    case 'RichText':
      return typeof value === 'string';
    case 'Number':
      return typeof value === 'number';
    case 'Boolean':
      return typeof value === 'boolean';
    case 'Date':
      return value instanceof Date || typeof value === 'string';
    case 'Asset':
      return typeof value === 'string' || (typeof value === 'object' && value !== null);
    case 'Reference':
      return typeof value === 'string' || (typeof value === 'object' && value !== null);
    default:
      return true; // Unknown type, assume valid
  }
}

/**
 * Validate all extracted fields against widget mapping
 * 
 * @param extractedFields - Fields extracted from Figma/LLM
 * @param widgetType - Widget type
 * @returns Validation result with errors and warnings
 */
export function validateExtractedFields(
  extractedFields: Record<string, any>,
  widgetType: WidgetType
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  const requiredValidation = validateRequiredFields(extractedFields, widgetType);
  if (!requiredValidation.isValid) {
    errors.push(
      `Missing required fields: ${requiredValidation.missingFields.join(', ')}`
    );
  }
  warnings.push(...requiredValidation.warnings);
  
  // Check field types
  for (const [fieldName, value] of Object.entries(extractedFields)) {
    if (!validateFieldType(fieldName, value, widgetType)) {
      const fieldMapping = getFieldMapping(widgetType, fieldName);
      if (fieldMapping) {
        errors.push(
          `Field "${fieldName}" has invalid type. Expected ${fieldMapping.fieldType}, got ${typeof value}`
        );
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Map extracted fields to Contentful field format
 * 
 * @param extractedFields - Fields extracted from Figma/LLM
 * @param widgetType - Widget type
 * @param contentType - Target Contentful content type
 * @returns Mapped fields ready for Contentful
 */
export function mapFieldsToContentful(
  extractedFields: Record<string, any>,
  widgetType: WidgetType,
  contentType: ContentType
): Record<string, any> {
  const mapping = getWidgetMapping(widgetType);
  if (!mapping) {
    throw new SchemaValidationError(
      `No mapping found for widget type: ${widgetType}`,
      undefined,
      widgetType
    );
  }
  
  const mappedFields: Record<string, any> = {};
  
  // Map each extracted field
  for (const [fieldName, value] of Object.entries(extractedFields)) {
    const fieldMapping = getFieldMapping(widgetType, fieldName);
    
    if (fieldMapping) {
      // Field is mapped - use it
      mappedFields[fieldName] = value;
    } else {
      // Field not in mapping - might be a direct Contentful field
      // Include it but warn
      mappedFields[fieldName] = value;
    }
  }
  
  return mappedFields;
}

/**
 * Get Contentful schema for a content type
 * 
 * @param contentType - Content type
 * @returns Zod schema for the content type
 */
export function getContentfulSchema(contentType: ContentType): z.ZodSchema<any> {
  const schema = CONTENT_TYPE_SCHEMAS[contentType];
  
  if (!schema) {
    throw new SchemaValidationError(
      `No schema found for content type: ${contentType}`,
      undefined,
      undefined,
      contentType
    );
  }
  
  return schema;
}

/**
 * Get UI schema for a widget type
 * 
 * @param widgetType - Widget type
 * @returns Zod schema for the widget type
 */
export function getWidgetUISchema(widgetType: WidgetType): z.ZodSchema<any> {
  const schema = WIDGET_UI_SCHEMAS[widgetType];
  
  if (!schema) {
    throw new SchemaValidationError(
      `No UI schema found for widget type: ${widgetType}`,
      undefined,
      widgetType
    );
  }
  
  return schema;
}

/**
 * Safe validation wrapper that returns validation result instead of throwing
 * 
 * @param content - Content to validate
 * @param contentType - Content type
 * @returns Validation result
 */
export function safeValidateContentfulSchema(
  content: unknown,
  contentType: ContentType
): {
  isValid: boolean;
  data?: any;
  error?: SchemaValidationError;
} {
  try {
    const data = validateContentfulSchema(content, contentType);
    return { isValid: true, data };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return { isValid: false, error };
    }
    throw error;
  }
}

/**
 * Safe validation wrapper for widget data
 * 
 * @param data - Widget data to validate
 * @param widgetType - Widget type
 * @returns Validation result
 */
export function safeValidateWidgetSchema(
  data: unknown,
  widgetType: WidgetType
): {
  isValid: boolean;
  data?: any;
  error?: SchemaValidationError;
} {
  try {
    const validated = validateWidgetSchema(data, widgetType);
    return { isValid: true, data: validated };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return { isValid: false, error };
    }
    throw error;
  }
}

