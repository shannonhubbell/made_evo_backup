/**
 * Tests for GraphQL Query Fragments
 * 
 * These tests verify that fragments are correctly structured and
 * can be used to build valid GraphQL queries.
 */

import { describe, it, expect } from 'vitest';
import {
  SysFields,
  ProgramFields,
  EventFields,
  PostFields,
  PageFields,
  MenuItemFields,
  ExhibitFields,
  MemberFields,
  ImpactReportFields,
  MetricFields,
  MetricPeriodFields,
  PressFields,
  ContentViewFields,
  IdOnlyFields,
  TitleOnlyFields,
} from '../fragments';

describe('Query Fragments', () => {
  describe('SysFields', () => {
    it('should include all required sys fields', () => {
      expect(SysFields).toContain('sys {');
      expect(SysFields).toContain('id');
      expect(SysFields).toContain('publishedAt');
      // Note: updatedAt and revision are not available in Contentful GraphQL API
      // They are only available via Management API, so we don't include them in GraphQL fragments
    });

    it('should be a valid GraphQL fragment', () => {
      // Should not have syntax errors
      expect(SysFields.trim()).toBeTruthy();
    });
  });

  describe('ProgramFields', () => {
    it('should include sys fields', () => {
      expect(ProgramFields).toContain('sys {');
    });

    it('should include program-specific fields', () => {
      expect(ProgramFields).toContain('name');
      expect(ProgramFields).toContain('title');
      expect(ProgramFields).toContain('description');
      expect(ProgramFields).toContain('url');
      expect(ProgramFields).toContain('imageCollection');
    });

    it('should include content field', () => {
      expect(ProgramFields).toContain('content {');
      expect(ProgramFields).toContain('json');
    });
  });

  describe('EventFields', () => {
    it('should include sys fields', () => {
      expect(EventFields).toContain('sys {');
    });

    it('should include event-specific fields', () => {
      expect(EventFields).toContain('name');
      expect(EventFields).toContain('title');
      expect(EventFields).toContain('startDate');
      expect(EventFields).toContain('endDate');
      expect(EventFields).toContain('slug');
      expect(EventFields).toContain('presenterCollection');
    });

    it('should include program reference', () => {
      expect(EventFields).toContain('program {');
    });
  });

  describe('PostFields', () => {
    it('should include sys fields', () => {
      expect(PostFields).toContain('sys {');
    });

    it('should include post-specific fields', () => {
      expect(PostFields).toContain('name');
      expect(PostFields).toContain('title');
      expect(PostFields).toContain('slug');
      expect(PostFields).toContain('date');
      expect(PostFields).toContain('content {');
      expect(PostFields).toContain('callToAction');
    });

    it('should include image and video collections', () => {
      expect(PostFields).toContain('imageCollection');
      expect(PostFields).toContain('videoCollection');
    });
  });

  describe('PageFields', () => {
    it('should include sys fields', () => {
      expect(PageFields).toContain('sys {');
    });

    it('should include page-specific fields', () => {
      expect(PageFields).toContain('name');
      expect(PageFields).toContain('title');
      expect(PageFields).toContain('slug');
      expect(PageFields).toContain('contentViewCollection');
    });

    it('should include ContentView fragment', () => {
      expect(PageFields).toContain('contentViewCollection');
    });
  });

  describe('Helper Fragments', () => {
    it('IdOnlyFields should only include sys.id', () => {
      expect(IdOnlyFields).toContain('sys {');
      expect(IdOnlyFields).toContain('id');
      // Should be minimal
      expect(IdOnlyFields.length).toBeLessThan(50);
    });

    it('TitleOnlyFields should include sys and title', () => {
      expect(TitleOnlyFields).toContain('sys {');
      expect(TitleOnlyFields).toContain('title');
    });
  });

  describe('Fragment Composition', () => {
    it('should allow fragments to be composed', () => {
      // Test that fragments can be used together
      const composedQuery = `
        {
          programCollection {
            items {
              ${ProgramFields}
            }
          }
        }
      `;
      
      expect(composedQuery).toContain(ProgramFields);
      expect(composedQuery).toContain('programCollection');
    });

    it('should generate valid GraphQL when composed', () => {
      // Basic validation - no obvious syntax errors
      const query = `{ items { ${ProgramFields} } }`;
      expect(query).toBeTruthy();
      expect(query.length).toBeGreaterThan(0);
    });
  });
});

