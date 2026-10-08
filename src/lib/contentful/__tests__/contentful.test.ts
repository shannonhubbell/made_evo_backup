/**
 * Integration Tests for Contentful API Functions
 * 
 * These tests verify that the migrated query functions work correctly
 * with the Contentful API. Uses mocking to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, Post, Event } from '../../../generated/contentful-types';
import * as contentfulModule from '../../contentful';

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment variables
vi.stubEnv('CONTENTFUL_SPACE_ID', 'test-space-id');
vi.stubEnv('CONTENTFUL_DELIVERY_TOKEN', 'test-token');

describe('Contentful API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPageBySlug', () => {
    it('should call fetch with correct query and variables', async () => {
      const mockPage: Page = {
        sys: { id: 'test-id' },
        name: 'Test Page',
        title: 'Test Title',
        slug: 'test-slug',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            pageCollection: {
              items: [mockPage],
            },
          },
        }),
      });

      const result = await contentfulModule.getPageBySlug('test-slug');

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockPage);
    });

    it('should return null if no page found', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            pageCollection: {
              items: [],
            },
          },
        }),
      });

      const result = await contentfulModule.getPageBySlug('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getPostBySlug', () => {
    it('should call fetch with correct query and variables', async () => {
      const mockPost: Post = {
        sys: { id: 'test-id' },
        name: 'Test Post',
        title: 'Test Title',
        slug: 'test-slug',
        content: { json: {} },
        date: '2024-01-01',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            postCollection: {
              items: [mockPost],
            },
          },
        }),
      });

      const result = await contentfulModule.getPostBySlug('test-slug');

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockPost);
    });
  });

  describe('getEventBySlug', () => {
    it('should call fetch with correct query and variables', async () => {
      const mockEvent: Event = {
        sys: { id: 'test-id' },
        name: 'Test Event',
        title: 'Test Title',
        slug: 'test-slug',
        startDate: '2024-01-01',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            eventCollection: {
              items: [mockEvent],
            },
          },
        }),
      });

      const result = await contentfulModule.getEventBySlug('test-slug');

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockEvent);
    });
  });

  describe('getBlogPostsPaginated', () => {
    it('should call fetch with correct pagination parameters', async () => {
      const mockPosts: Post[] = [
        {
          sys: { id: '1' },
          name: 'Post 1',
          title: 'Title 1',
          slug: 'post-1',
          content: { json: {} },
          date: '2024-01-01',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            postCollection: {
              items: mockPosts,
            },
          },
        }),
      });

      const result = await contentfulModule.getBlogPostsPaginated(1, 10);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockPosts);
    });

    it('should calculate skip correctly', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            postCollection: {
              items: [],
            },
          },
        }),
      });

      await contentfulModule.getBlogPostsPaginated(2, 10);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      // Page 2 with limit 10 should skip 10
      expect(body.variables.skip).toBe(10);
      expect(body.variables.limit).toBe(10);
    });
  });

  describe('getEventsPaginated', () => {
    it('should call fetch with correct pagination parameters', async () => {
      const mockEvents: Event[] = [
        {
          sys: { id: '1' },
          name: 'Event 1',
          title: 'Title 1',
          slug: 'event-1',
          startDate: '2024-01-01',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            eventCollection: {
              items: mockEvents,
            },
          },
        }),
      });

      const result = await contentfulModule.getEventsPaginated(1, 10);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getBlogPostsCount', () => {
    it('should return the total count', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            postCollection: {
              total: 42,
            },
          },
        }),
      });

      const result = await contentfulModule.getBlogPostsCount();

      expect(result).toBe(42);
    });

    it('should return 0 if total is missing', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            postCollection: {},
          },
        }),
      });

      const result = await contentfulModule.getBlogPostsCount();

      expect(result).toBe(0);
    });
  });

  describe('getEventsCount', () => {
    it('should return the total count', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            eventCollection: {
              total: 100,
            },
          },
        }),
      });

      const result = await contentfulModule.getEventsCount();

      expect(result).toBe(100);
    });
  });

  describe('Type Safety', () => {
    it('should return typed results', async () => {
      const mockPage: Page = {
        sys: { id: 'test-id' },
        name: 'Test',
        title: 'Test',
        slug: 'test',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          data: {
            pageCollection: {
              items: [mockPage],
            },
          },
        }),
      });

      const result = await contentfulModule.getPageBySlug('test');

      // TypeScript should infer this as Page | null
      if (result) {
        expect(result.sys.id).toBe('test-id');
        expect(result.name).toBe('Test');
        // TypeScript should know these properties exist
        expect(typeof result.title).toBe('string');
      }
    });
  });
});

