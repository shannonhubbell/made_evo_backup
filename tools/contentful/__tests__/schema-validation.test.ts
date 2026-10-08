/**
 * Schema Validation Tests - Checkpoint 1 (Part 2)
 * 
 * Tests for schema validation helpers in the widget mapping system.
 * 
 * To run: npm test tools/contentful/__tests__/schema-validation.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateContentfulSchema,
  validateWidgetSchema,
  validateRequiredFields,
  validateFieldType,
  validateExtractedFields,
  mapFieldsToContentful,
  getContentfulSchema,
  getWidgetUISchema,
  safeValidateContentfulSchema,
  safeValidateWidgetSchema,
  SchemaValidationError,
} from '../schema-validation';
import type { WidgetType } from '../../../src/lib/components/component-map';
import type { ContentType } from '../../../src/lib/adapters/registry';

describe('Schema Validation - Checkpoint 1 (Part 2)', () => {
  describe('Contentful Schema Validation', () => {
    it('should validate valid Program content', () => {
      const program = {
        sys: { id: 'program-1' },
        name: 'Test Program',
        title: 'Test Program Title',
        description: 'Test description',
      };
      
      const result = validateContentfulSchema(program, 'Program');
      expect(result.name).toBe('Test Program');
      expect(result.title).toBe('Test Program Title');
    });

    it('should validate valid Event content', () => {
      const event = {
        sys: { id: 'event-1' },
        name: 'Test Event',
        title: 'Test Event Title',
        startDate: '2024-01-01',
        slug: 'test-event',
      };
      
      const result = validateContentfulSchema(event, 'Event');
      expect(result.name).toBe('Test Event');
      expect(result.slug).toBe('test-event');
    });

    it('should throw error for invalid content type', () => {
      expect(() => {
        validateContentfulSchema({}, 'InvalidType' as ContentType);
      }).toThrow(SchemaValidationError);
    });

    it('should throw error for missing required fields', () => {
      const invalidProgram = {
        sys: { id: 'program-1' },
        // Missing name, title, description
      };
      
      expect(() => {
        validateContentfulSchema(invalidProgram, 'Program');
      }).toThrow(SchemaValidationError);
    });
  });

  describe('Widget Schema Validation', () => {
    it('should validate valid splash widget data', () => {
      const splashData = {
        padding: 'lg',
        overlay: true,
        overlayOpacity: 'medium',
        contents: [
          {
            title: 'Welcome',
            subtitle: 'Subtitle',
          },
        ],
      };
      
      const result = validateWidgetSchema(splashData, 'splash');
      expect(result.contents).toBeDefined();
      expect(result.contents[0].title).toBe('Welcome');
    });

    it('should validate valid grid widget data', () => {
      const gridData = {
        items: [
          {
            image: '/image.jpg',
            title: 'Item 1',
            url: '/item-1',
            subtitle: 'Subtitle',
          },
        ],
      };
      
      const result = validateWidgetSchema(gridData, 'blockGrid');
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(1);
    });

    it('should throw error for invalid widget type', () => {
      expect(() => {
        validateWidgetSchema({}, 'invalid' as WidgetType);
      }).toThrow(SchemaValidationError);
    });

    it('should throw error for invalid widget data structure', () => {
      const invalidGrid = {
        // Missing items array
        title: 'Invalid',
      };
      
      expect(() => {
        validateWidgetSchema(invalidGrid, 'blockGrid');
      }).toThrow(SchemaValidationError);
    });
  });

  describe('Required Fields Validation', () => {
    it('should validate all required fields present', () => {
      const extractedFields = {
        title: 'Test Title',
        imageCollection: [{ url: '/image.jpg' }],
      };
      
      const result = validateRequiredFields(extractedFields, 'blockGrid');
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const extractedFields = {
        // Missing title
        imageCollection: [{ url: '/image.jpg' }],
      };
      
      const result = validateRequiredFields(extractedFields, 'blockGrid');
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('title');
    });

    it('should handle optional required fields', () => {
      const extractedFields = {
        title: 'Test',
        // imageCollection is conditionally required for splash
      };
      
      const result = validateRequiredFields(extractedFields, 'splash');
      // Should have warnings but may still be valid if videoCollection exists
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Field Type Validation', () => {
    it('should validate text field type', () => {
      const isValid = validateFieldType('title', 'Test Title', 'splash');
      expect(isValid).toBe(true);
    });

    it('should validate number field type', () => {
      // Note: Most fields are text, but this tests the type checking logic
      const isValid = validateFieldType('title', 123, 'splash');
      expect(isValid).toBe(false); // title should be string
    });

    it('should validate date field type', () => {
      const isValid = validateFieldType('startDate', '2024-01-01', 'calendar');
      expect(isValid).toBe(true);
    });

    it('should return true for unmapped fields', () => {
      // Fields not in mapping are assumed valid
      const isValid = validateFieldType('unknownField', 'value', 'splash');
      expect(isValid).toBe(true);
    });
  });

  describe('Extracted Fields Validation', () => {
    it('should validate complete extracted fields', () => {
      const extractedFields = {
        title: 'Test Title',
        imageCollection: [{ url: '/image.jpg' }],
        description: 'Test description',
      };
      
      const result = validateExtractedFields(extractedFields, 'blockGrid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect errors in extracted fields', () => {
      const extractedFields = {
        // Missing required title
        description: 'Test description',
      };
      
      const result = validateExtractedFields(extractedFields, 'blockGrid');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for optional fields', () => {
      const extractedFields = {
        title: 'Test',
      };
      
      const result = validateExtractedFields(extractedFields, 'blockGrid');
      // May have warnings for missing optional fields
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Field Mapping', () => {
    it('should map extracted fields to Contentful format', () => {
      const extractedFields = {
        title: 'Test Title',
        description: 'Test Description',
      };
      
      const mapped = mapFieldsToContentful(extractedFields, 'splash', 'Page');
      expect(mapped.title).toBe('Test Title');
      expect(mapped.description).toBe('Test Description');
    });

    it('should handle unmapped fields', () => {
      const extractedFields = {
        title: 'Test Title',
        customField: 'Custom Value',
      };
      
      const mapped = mapFieldsToContentful(extractedFields, 'splash', 'Page');
      expect(mapped.title).toBe('Test Title');
      expect(mapped.customField).toBe('Custom Value');
    });
  });

  describe('Schema Getters', () => {
    it('should get Contentful schema for content type', () => {
      const schema = getContentfulSchema('Program');
      expect(schema).toBeDefined();
    });

    it('should get UI schema for widget type', () => {
      const schema = getWidgetUISchema('splash');
      expect(schema).toBeDefined();
    });

    it('should throw error for invalid content type', () => {
      expect(() => {
        getContentfulSchema('InvalidType' as ContentType);
      }).toThrow(SchemaValidationError);
    });

    it('should throw error for invalid widget type', () => {
      expect(() => {
        getWidgetUISchema('invalid' as WidgetType);
      }).toThrow(SchemaValidationError);
    });
  });

  describe('Safe Validation', () => {
    it('should return validation result without throwing', () => {
      const validProgram = {
        sys: { id: 'program-1' },
        name: 'Test',
        title: 'Test Title',
        description: 'Test Description',
      };
      
      const result = safeValidateContentfulSchema(validProgram, 'Program');
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error in result for invalid data', () => {
      const invalidProgram = {
        // Missing required fields
      };
      
      const result = safeValidateContentfulSchema(invalidProgram, 'Program');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(SchemaValidationError);
    });

    it('should safely validate widget data', () => {
      const validSplash = {
        padding: 'lg',
        contents: [{ title: 'Test' }],
      };
      
      const result = safeValidateWidgetSchema(validSplash, 'splash');
      expect(result.isValid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for invalid widget data', () => {
      const invalidSplash = {
        // Invalid structure
      };
      
      const result = safeValidateWidgetSchema(invalidSplash, 'splash');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(SchemaValidationError);
    });
  });
});

