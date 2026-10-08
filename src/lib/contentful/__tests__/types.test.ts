/**
 * Type Safety Tests
 * 
 * These tests verify that generated types match the query responses
 * and that type safety is maintained throughout the query layer.
 */

import { describe, it, expect } from 'vitest';
import type {
  Program,
  Event,
  Post,
  Page,
  MenuItem,
  Exhibit,
  Member,
  ImpactReport,
  Metric,
  MetricPeriod,
  Press,
} from '../../../generated/contentful-types';
import type {
  ProgramCollectionResponse,
  EventCollectionResponse,
  PostCollectionResponse,
  PageCollectionResponse,
  MenuItemCollectionResponse,
  ExhibitCollectionResponse,
  MemberCollectionResponse,
  ImpactReportResponse,
  MetricCollectionResponse,
  MetricPeriodCollectionResponse,
  PressCollectionResponse,
} from '../query-builder';

describe('Type Safety', () => {
  describe('Generated Types', () => {
    it('should have Program type with required fields', () => {
      const program: Program = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        description: 'Test',
      };

      expect(program.sys.id).toBe('test');
      expect(program.name).toBe('Test');
      expect(program.title).toBe('Test');
      expect(program.description).toBe('Test');
    });

    it('should have Event type with required fields', () => {
      const event: Event = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        startDate: '2024-01-01',
        slug: 'test',
      };

      expect(event.sys.id).toBe('test');
      expect(event.startDate).toBe('2024-01-01');
      expect(event.slug).toBe('test');
    });

    it('should have Post type with required fields', () => {
      const post: Post = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        slug: 'test',
        content: { json: {} },
        date: '2024-01-01',
      };

      expect(post.sys.id).toBe('test');
      expect(post.content).toBeDefined();
      expect(post.date).toBe('2024-01-01');
    });

    it('should have Page type with required fields', () => {
      const page: Page = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        slug: 'test',
      };

      expect(page.sys.id).toBe('test');
      expect(page.slug).toBe('test');
    });
  });

  describe('Response Types', () => {
    it('should match ProgramCollectionResponse structure', () => {
      const response: ProgramCollectionResponse = {
        programCollection: {
          items: [
            {
              sys: { id: '1' },
              name: 'Test',
              title: 'Test',
              description: 'Test',
            },
          ],
        },
      };

      expect(response.programCollection.items).toHaveLength(1);
      expect(response.programCollection.items[0].sys.id).toBe('1');
    });

    it('should match EventCollectionResponse structure', () => {
      const response: EventCollectionResponse = {
        eventCollection: {
          items: [
            {
              sys: { id: '1' },
              name: 'Test',
              title: 'Test',
              startDate: '2024-01-01',
              slug: 'test',
            },
          ],
        },
      };

      expect(response.eventCollection.items).toHaveLength(1);
      expect(response.eventCollection.items[0].slug).toBe('test');
    });

    it('should match PostCollectionResponse structure', () => {
      const response: PostCollectionResponse = {
        postCollection: {
          items: [
            {
              sys: { id: '1' },
              name: 'Test',
              title: 'Test',
              slug: 'test',
              content: { json: {} },
              date: '2024-01-01',
            },
          ],
        },
      };

      expect(response.postCollection.items).toHaveLength(1);
      expect(response.postCollection.items[0].content).toBeDefined();
    });

    it('should match PageCollectionResponse structure', () => {
      const response: PageCollectionResponse = {
        pageCollection: {
          items: [
            {
              sys: { id: '1' },
              name: 'Test',
              title: 'Test',
              slug: 'test',
            },
          ],
        },
      };

      expect(response.pageCollection.items).toHaveLength(1);
      expect(response.pageCollection.items[0].slug).toBe('test');
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional fields to be undefined', () => {
      const program: Program = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        description: 'Test',
        // url is optional, so it can be undefined
      };

      expect(program.url).toBeUndefined();
    });

    it('should allow optional fields to be set', () => {
      const program: Program = {
        sys: { id: 'test' },
        name: 'Test',
        title: 'Test',
        description: 'Test',
        url: 'https://example.com',
      };

      expect(program.url).toBe('https://example.com');
    });
  });

  describe('Sys Fields', () => {
    it('should have consistent sys structure across all types', () => {
      const program: Program = {
        sys: { id: '1' },
        name: 'Test',
        title: 'Test',
        description: 'Test',
      };

      const event: Event = {
        sys: { id: '2' },
        name: 'Test',
        title: 'Test',
        startDate: '2024-01-01',
        slug: 'test',
      };

      expect(program.sys.id).toBe('1');
      expect(event.sys.id).toBe('2');
      expect(program.sys).toHaveProperty('id');
      expect(event.sys).toHaveProperty('id');
    });

    it('should allow optional sys fields', () => {
      const program: Program = {
        sys: {
          id: '1',
          publishedAt: '2024-01-01',
          updatedAt: '2024-01-02',
          revision: 1,
        },
        name: 'Test',
        title: 'Test',
        description: 'Test',
      };

      expect(program.sys.publishedAt).toBe('2024-01-01');
      expect(program.sys.updatedAt).toBe('2024-01-02');
      expect(program.sys.revision).toBe(1);
    });
  });
});

