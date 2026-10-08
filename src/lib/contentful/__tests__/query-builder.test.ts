/**
 * Tests for Type-Safe Query Builder
 * 
 * These tests verify that query builder functions generate
 * correct GraphQL queries and maintain type safety.
 */

import { describe, it, expect } from 'vitest';
import {
  queryPrograms,
  queryEvents,
  queryPosts,
  queryPages,
  queryPageBySlug,
  queryPostBySlug,
  queryEventBySlug,
  queryMenuItems,
  queryBlogPostsPaginated,
  queryBlogPostsCount,
  queryEventsPaginated,
  queryEventsCount,
  queryPagesSlugOnly,
  queryPostsTitleSlug,
  buildQueryArgs,
  type QueryOptions,
} from '../query-builder';

describe('Query Builder', () => {
  describe('queryPrograms', () => {
    it('should generate a valid GraphQL query', () => {
      const query = queryPrograms();
      
      expect(query).toContain('programCollection');
      expect(query).toContain('items');
      expect(query).toContain('sys');
      expect(query).toContain('name');
      expect(query).toContain('title');
    });

    it('should include all required fields from ProgramFields', () => {
      const query = queryPrograms();
      
      expect(query).toContain('description');
      expect(query).toContain('url');
      expect(query).toContain('imageCollection');
    });

    it('should accept query options', () => {
      const query = queryPrograms({ limit: 10 });
      
      expect(query).toContain('limit: 10');
    });

    it('should handle where clause', () => {
      const query = queryPrograms({ where: 'url_exists: true' });
      
      expect(query).toContain('where:');
      expect(query).toContain('url_exists: true');
    });

    it('should handle multiple options', () => {
      const query = queryPrograms({
        where: 'url_exists: true',
        limit: 5,
        skip: 10,
        order: 'title_ASC',
      });
      
      expect(query).toContain('limit: 5');
      expect(query).toContain('skip: 10');
      expect(query).toContain('order: title_ASC');
    });
  });

  describe('queryEvents', () => {
    it('should generate a valid GraphQL query', () => {
      const query = queryEvents();
      
      expect(query).toContain('eventCollection');
      expect(query).toContain('items');
      expect(query).toContain('startDate');
      expect(query).toContain('endDate');
      expect(query).toContain('slug');
    });

    it('should include presenter collection', () => {
      const query = queryEvents();
      
      expect(query).toContain('presenterCollection');
    });
  });

  describe('queryPosts', () => {
    it('should generate a valid GraphQL query', () => {
      const query = queryPosts();
      
      expect(query).toContain('postCollection');
      expect(query).toContain('items');
      expect(query).toContain('slug');
      expect(query).toContain('content');
    });

    it('should include callToAction field', () => {
      const query = queryPosts();
      
      expect(query).toContain('callToAction');
    });
  });

  describe('queryPages', () => {
    it('should generate a valid GraphQL query', () => {
      const query = queryPages();
      
      expect(query).toContain('pageCollection');
      expect(query).toContain('items');
      expect(query).toContain('contentViewCollection');
    });
  });

  describe('queryPageBySlug', () => {
    it('should generate a query with slug parameter', () => {
      const query = queryPageBySlug('test-slug');
      
      expect(query).toContain('query PageBySlug');
      expect(query).toContain('$slug: String!');
      expect(query).toContain('where: { slug: $slug }');
      expect(query).toContain('limit: 1');
    });

    it('should include all page fields', () => {
      const query = queryPageBySlug('test-slug');
      
      expect(query).toContain('pageCollection');
      expect(query).toContain('contentViewCollection');
    });
  });

  describe('queryPostBySlug', () => {
    it('should generate a query with slug parameter', () => {
      const query = queryPostBySlug('test-slug');
      
      expect(query).toContain('query PostBySlug');
      expect(query).toContain('$slug: String!');
      expect(query).toContain('where: { slug: $slug }');
    });
  });

  describe('queryEventBySlug', () => {
    it('should generate a query with slug parameter', () => {
      const query = queryEventBySlug('test-slug');
      
      expect(query).toContain('query EventBySlug');
      expect(query).toContain('$slug: String!');
      expect(query).toContain('where: { slug: $slug }');
    });
  });

  describe('queryBlogPostsPaginated', () => {
    it('should generate a paginated query', () => {
      const query = queryBlogPostsPaginated(0, 10);
      
      expect(query).toContain('query BlogPostsPaginated');
      expect(query).toContain('$skip: Int!');
      expect(query).toContain('$limit: Int!');
      expect(query).toContain('skip: $skip');
      expect(query).toContain('limit: $limit');
    });

    it('should include blog tag filter', () => {
      const query = queryBlogPostsPaginated(0, 10);
      
      expect(query).toContain('contentfulMetadata');
      expect(query).toContain('tags');
      expect(query).toContain('id_contains_some: ["blog"]');
    });

    it('should include order by publishedAt', () => {
      const query = queryBlogPostsPaginated(0, 10);
      
      expect(query).toContain('order: sys_publishedAt_DESC');
    });
  });

  describe('queryBlogPostsCount', () => {
    it('should generate a count query', () => {
      const query = queryBlogPostsCount();
      
      expect(query).toContain('postCollection');
      expect(query).toContain('total');
    });

    it('should include blog tag filter', () => {
      const query = queryBlogPostsCount();
      
      expect(query).toContain('contentfulMetadata');
      expect(query).toContain('tags');
    });
  });

  describe('queryEventsPaginated', () => {
    it('should generate a paginated query', () => {
      const query = queryEventsPaginated(0, 10);
      
      expect(query).toContain('query EventsPaginated');
      expect(query).toContain('$skip: Int!');
      expect(query).toContain('$limit: Int!');
    });

    it('should include order by startDate', () => {
      const query = queryEventsPaginated(0, 10);
      
      expect(query).toContain('order: startDate_DESC');
    });
  });

  describe('queryEventsCount', () => {
    it('should generate a count query', () => {
      const query = queryEventsCount();
      
      expect(query).toContain('eventCollection');
      expect(query).toContain('total');
    });
  });

  describe('queryPagesSlugOnly', () => {
    it('should generate a minimal query with only slug', () => {
      const query = queryPagesSlugOnly();
      
      expect(query).toContain('pageCollection');
      expect(query).toContain('slug');
      expect(query).toContain('sys');
      expect(query).toContain('id');
    });

    it('should not include unnecessary fields', () => {
      const query = queryPagesSlugOnly();
      
      // Should not include contentViewCollection (too heavy for getStaticPaths)
      expect(query).not.toContain('contentViewCollection');
    });
  });

  describe('queryPostsTitleSlug', () => {
    it('should generate a minimal query with title and slug', () => {
      const query = queryPostsTitleSlug();
      
      expect(query).toContain('postCollection');
      expect(query).toContain('title');
      expect(query).toContain('slug');
    });

    it('should include blog tag filter', () => {
      const query = queryPostsTitleSlug();
      
      expect(query).toContain('contentfulMetadata');
      expect(query).toContain('tags');
    });
  });

  describe('buildQueryArgs', () => {
    it('should build empty args for no options', () => {
      const args = buildQueryArgs({});
      expect(args).toBe('');
    });

    it('should build args with limit', () => {
      const args = buildQueryArgs({ limit: 10 });
      expect(args).toContain('limit: 10');
    });

    it('should build args with skip', () => {
      const args = buildQueryArgs({ skip: 20 });
      expect(args).toContain('skip: 20');
    });

    it('should build args with order', () => {
      const args = buildQueryArgs({ order: 'title_ASC' });
      expect(args).toContain('order: title_ASC');
    });

    it('should build args with where clause string', () => {
      const args = buildQueryArgs({ where: 'url_exists: true' });
      expect(args).toContain('where:');
      expect(args).toContain('url_exists: true');
    });

    it('should combine multiple args', () => {
      const args = buildQueryArgs({
        where: 'url_exists: true',
        limit: 10,
        skip: 0,
        order: 'title_ASC',
      });
      
      expect(args).toContain('where:');
      expect(args).toContain('limit: 10');
      expect(args).toContain('skip: 0');
      expect(args).toContain('order: title_ASC');
    });
  });

  describe('Query Structure Validation', () => {
    it('should generate queries with proper GraphQL structure', () => {
      const queries = [
        queryPrograms(),
        queryEvents(),
        queryPosts(),
        queryPages(),
      ];

      queries.forEach(query => {
        // Should have opening and closing braces
        expect(query).toContain('{');
        expect(query).toContain('}');
        // Should not have obvious syntax errors
        expect(query.trim().length).toBeGreaterThan(0);
      });
    });

    it('should generate named queries with variables', () => {
      const queries = [
        queryPageBySlug('test'),
        queryPostBySlug('test'),
        queryEventBySlug('test'),
        queryBlogPostsPaginated(0, 10),
        queryEventsPaginated(0, 10),
      ];

      queries.forEach(query => {
        expect(query).toContain('query');
        expect(query).toContain('$');
      });
    });
  });
});

