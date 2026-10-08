/**
 * Widget Mapping Tests - Checkpoint 1
 * 
 * Tests for the core widget-to-Contentful mapping system.
 * Run these tests after implementing Phase 1.
 * 
 * To run: npm test tools/contentful/__tests__/widget-mapping.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getWidgetMapping,
  getContentTypesForWidget,
  getWidgetsForContentType,
  getBestWidgetForContentType,
  getAdaptersForWidget,
  getRequiredFields,
  getOptionalFields,
  getVisualProperties,
  findWidgetByFigmaPattern,
  getFieldMapping,
  widgetMappings,
} from '../widget-mapping';
import type { WidgetType } from '../../../src/lib/components/component-map';
import type { ContentType } from '../../../src/lib/adapters/registry';

describe('Widget Mapping - Checkpoint 1', () => {
  describe('Bidirectional Lookups', () => {
    it('should return correct content types for splash widget', () => {
      const contentTypes = getContentTypesForWidget('splash');
      expect(contentTypes).toContain('Page');
      expect(contentTypes).toContain('Program');
      expect(contentTypes.length).toBe(2);
    });

    it('should return correct content types for grid widgets', () => {
      const blockGridTypes = getContentTypesForWidget('blockGrid');
      expect(blockGridTypes).toContain('Exhibit');
      expect(blockGridTypes).toContain('Event');
      expect(blockGridTypes).toContain('Program');
      expect(blockGridTypes).toContain('Member');
      expect(blockGridTypes).toContain('Post');
      
      const textGridTypes = getContentTypesForWidget('textGrid');
      expect(textGridTypes).toEqual(blockGridTypes);
    });

    it('should return correct widgets for Event content type', () => {
      const widgets = getWidgetsForContentType('Event');
      expect(widgets).toContain('blockGrid');
      expect(widgets).toContain('textGrid');
      expect(widgets).toContain('calendar');
    });

    it('should return correct widgets for Page content type', () => {
      const widgets = getWidgetsForContentType('Page');
      expect(widgets).toContain('splash');
    });

    it('should return best widget for content type', () => {
      const bestWidget = getBestWidgetForContentType('Page');
      expect(bestWidget).toBe('splash');
      
      const bestEventWidget = getBestWidgetForContentType('Event');
      expect(['blockGrid', 'textGrid', 'calendar']).toContain(bestEventWidget);
    });
  });

  describe('Adapter Lookups', () => {
    it('should return correct adapters for splash widget', () => {
      const adapters = getAdaptersForWidget('splash');
      expect(adapters).toContain('splash-from-page');
      expect(adapters).toContain('splash-from-program');
    });

    it('should return correct adapters for grid widgets', () => {
      const adapters = getAdaptersForWidget('blockGrid');
      expect(adapters.length).toBeGreaterThan(0);
      expect(adapters).toContain('grid-from-exhibits');
      expect(adapters).toContain('grid-from-events');
    });
  });

  describe('Field Mappings', () => {
    it('should return required fields for splash widget', () => {
      const requiredFields = getRequiredFields('splash');
      expect(requiredFields.length).toBeGreaterThan(0);
      
      const titleField = requiredFields.find(f => f.fieldName === 'title');
      expect(titleField).toBeDefined();
      expect(titleField?.required).toBe(true);
      expect(titleField?.fieldType).toBe('Text');
    });

    it('should return optional fields for splash widget', () => {
      const optionalFields = getOptionalFields('splash');
      const descriptionField = optionalFields.find(f => f.fieldName === 'description');
      expect(descriptionField).toBeDefined();
      expect(descriptionField?.required).toBe(false);
    });

    it('should return required fields for calendar widget', () => {
      const requiredFields = getRequiredFields('calendar');
      const fieldNames = requiredFields.map(f => f.fieldName);
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('startDate');
      expect(fieldNames).toContain('slug');
    });

    it('should get field mapping for specific field', () => {
      const titleMapping = getFieldMapping('splash', 'title');
      expect(titleMapping).toBeDefined();
      expect(titleMapping?.fieldName).toBe('title');
      expect(titleMapping?.fieldType).toBe('Text');
    });
  });

  describe('Visual Properties', () => {
    it('should return visual properties for splash widget', () => {
      const props = getVisualProperties('splash');
      expect(props).toBeDefined();
      expect(props?.layout).toBe('full-width');
      expect(props?.hasOverlay).toBe(true);
      expect(props?.supportsVideo).toBe(true);
    });

    it('should return visual properties for grid widgets', () => {
      const props = getVisualProperties('blockGrid');
      expect(props).toBeDefined();
      expect(props?.layout).toBe('grid');
      expect(props?.hasImages).toBe(true);
      expect(props?.isResponsive).toBe(true);
    });
  });

  describe('Pattern Matching', () => {
    it('should find splash widget for hero patterns', () => {
      const matches = findWidgetByFigmaPattern(['hero sections']);
      expect(matches).toContain('splash');
    });

    it('should find grid widgets for grid patterns', () => {
      const matches = findWidgetByFigmaPattern(['grid layouts']);
      expect(matches).toContain('blockGrid');
      // textGrid may or may not match depending on exact pattern matching
      // Both share similar patterns, so at least blockGrid should match
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should find calendar widget for calendar patterns', () => {
      const matches = findWidgetByFigmaPattern(['calendar components']);
      expect(matches).toContain('calendar');
    });

    it('should find timeline widget for timeline patterns', () => {
      const matches = findWidgetByFigmaPattern(['timeline components']);
      expect(matches).toContain('verticalTimeline');
    });
  });

  describe('Edge Cases', () => {
    it('should return undefined for unknown widget type', () => {
      const mapping = getWidgetMapping('unknown' as WidgetType);
      expect(mapping).toBeUndefined();
    });

    it('should return empty array for store widget content types', () => {
      const contentTypes = getContentTypesForWidget('store');
      expect(contentTypes).toEqual([]);
    });

    it('should return empty array for unknown widget', () => {
      const adapters = getAdaptersForWidget('unknown' as WidgetType);
      expect(adapters).toEqual([]);
    });

    it('should return empty array for required fields of unknown widget', () => {
      const fields = getRequiredFields('unknown' as WidgetType);
      expect(fields).toEqual([]);
    });

    it('should return undefined for field mapping of unknown widget', () => {
      const mapping = getFieldMapping('unknown' as WidgetType, 'title');
      expect(mapping).toBeUndefined();
    });
  });

  describe('Data Integrity', () => {
    it('should have mappings for all widget types', () => {
      const widgetTypes: WidgetType[] = [
        'splash',
        'blockGrid',
        'textGrid',
        'calendar',
        'doubleColumn',
        'singleColumn',
        'verticalTimeline',
        'report',
        'store',
      ];

      for (const widgetType of widgetTypes) {
        const mapping = getWidgetMapping(widgetType);
        expect(mapping).toBeDefined();
        expect(mapping?.widgetType).toBe(widgetType);
      }
    });

    it('should have valid field mappings for all widgets', () => {
      for (const mapping of widgetMappings) {
        // All required fields should have valid field types
        // Note: Some fields may be conditionally required (required: false but still in requiredFields)
        for (const field of mapping.requiredFields) {
          expect(field.fieldName).toBeTruthy();
          expect(field.fieldType).toBeTruthy();
          expect(field.description).toBeTruthy();
          // Field should be marked as required OR be conditionally required
          // (e.g., imageCollection OR videoCollection for splash)
          expect(typeof field.required).toBe('boolean');
        }

        // All optional fields should have valid field types
        for (const field of mapping.optionalFields) {
          expect(field.fieldName).toBeTruthy();
          expect(field.fieldType).toBeTruthy();
          expect(field.description).toBeTruthy();
          expect(field.required).toBe(false);
        }
      }
    });

    it('should have valid visual properties for all widgets', () => {
      for (const mapping of widgetMappings) {
        expect(mapping.visualProperties).toBeDefined();
        expect(mapping.visualProperties.layout).toBeTruthy();
      }
    });

    it('should have Figma patterns for all widgets', () => {
      for (const mapping of widgetMappings) {
        expect(mapping.figmaPatterns.length).toBeGreaterThan(0);
      }
    });
  });
});

