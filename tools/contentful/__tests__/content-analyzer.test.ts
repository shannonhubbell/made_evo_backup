/**
 * Content Analyzer Tests - Checkpoint 4
 * 
 * Tests for the Contentful content analyzer that checks existing content
 * before creating new entries from Figma designs.
 * 
 * To run: npm test tools/contentful/__tests__/content-analyzer.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeSiteContent,
  getPageContent,
  isWidgetTypeUsedOnPage,
  getPageWidgetTypes,
  findPagesWithWidgetType,
  getWidgetUsageStats,
  checkForDuplicateContent,
  getContentPlacementRecommendations,
} from '../content-analyzer';
import * as contentful from '../../../src/lib/contentful';

// Mock Contentful functions
vi.mock('../../../src/lib/contentful', () => ({
  getByQuery: vi.fn(),
}));

// Mock adapter registry
vi.mock('../../../src/lib/adapters/registry', () => ({
  getAdapter: vi.fn((id: string) => {
    const adapters: Record<string, any> = {
      'splash-from-page': { outputType: 'splash' },
      'grid-from-events': { outputType: 'blockGrid' },
      'calendar-from-events': { outputType: 'calendar' },
    };
    if (adapters[id]) {
      return adapters[id];
    }
    throw new Error(`Adapter not found: ${id}`);
  }),
}));

describe('Content Analyzer - Checkpoint 4', () => {
  const mockPageData = {
    pageCollection: {
      items: [
        {
          sys: { id: 'page-1' },
          slug: 'home',
          title: 'Home Page',
          contentViewCollection: {
            items: [
              {
                sys: { id: 'cv-1' },
                name: 'Hero Section',
                isAtomic: true,
                isTitleVisible: false,
                dataAdapter: {
                  sys: { id: 'adapter-1' },
                  name: 'splash-from-page',
                },
                targetCollection: {
                  items: [
                    { sys: { id: 'target-1' } },
                  ],
                },
              },
            ],
          },
        },
        {
          sys: { id: 'page-2' },
          slug: 'events',
          title: 'Events Page',
          contentViewCollection: {
            items: [
              {
                sys: { id: 'cv-2' },
                name: 'Events Grid',
                isAtomic: false,
                isTitleVisible: true,
                dataAdapter: {
                  sys: { id: 'adapter-2' },
                  name: 'grid-from-events',
                },
                targetCollection: {
                  items: [
                    { sys: { id: 'target-2' } },
                    { sys: { id: 'target-3' } },
                  ],
                },
              },
              {
                sys: { id: 'cv-3' },
                name: 'Events Calendar',
                isAtomic: false,
                isTitleVisible: true,
                dataAdapter: {
                  sys: { id: 'adapter-3' },
                  name: 'calendar-from-events',
                },
                targetCollection: {
                  items: [],
                },
              },
            ],
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contentful.getByQuery).mockResolvedValue(mockPageData as any);
  });

  describe('Site Content Analysis', () => {
    it('should analyze all pages and their content views', async () => {
      const analysis = await analyzeSiteContent();

      expect(analysis.totalPages).toBe(2);
      expect(analysis.totalWidgets).toBe(3);
      expect(analysis.pages.length).toBe(2);
    });

    it('should identify widget types on each page', async () => {
      const analysis = await analyzeSiteContent();

      const homePage = analysis.pages.find(p => p.slug === 'home');
      expect(homePage).toBeDefined();
      expect(homePage?.widgetTypes).toContain('splash');
      expect(homePage?.widgetCount).toBe(1);

      const eventsPage = analysis.pages.find(p => p.slug === 'events');
      expect(eventsPage).toBeDefined();
      expect(eventsPage?.widgetTypes).toContain('blockGrid');
      expect(eventsPage?.widgetTypes).toContain('calendar');
      expect(eventsPage?.widgetCount).toBe(2);
    });

    it('should track widget usage statistics', async () => {
      const analysis = await analyzeSiteContent();

      expect(analysis.widgetUsage.get('splash')).toBe(1);
      expect(analysis.widgetUsage.get('blockGrid')).toBe(1);
      expect(analysis.widgetUsage.get('calendar')).toBe(1);
    });

    it('should extract content view details', async () => {
      const analysis = await analyzeSiteContent();

      const homePage = analysis.pages.find(p => p.slug === 'home');
      expect(homePage?.contentViews.length).toBe(1);
      
      const contentView = homePage?.contentViews[0];
      expect(contentView?.name).toBe('Hero Section');
      expect(contentView?.widgetType).toBe('splash');
      expect(contentView?.isAtomic).toBe(true);
      expect(contentView?.targetIds).toContain('target-1');
    });
  });

  describe('Page Content Queries', () => {
    it('should get content for a specific page', async () => {
      const pageContent = await getPageContent('home');

      expect(pageContent).toBeDefined();
      expect(pageContent?.slug).toBe('home');
      expect(pageContent?.title).toBe('Home Page');
      expect(pageContent?.widgetTypes).toContain('splash');
    });

    it('should return null for non-existent page', async () => {
      const pageContent = await getPageContent('non-existent');

      expect(pageContent).toBeNull();
    });

    it('should check if widget type is used on page', async () => {
      const isUsed = await isWidgetTypeUsedOnPage('home', 'splash');
      expect(isUsed).toBe(true);

      const notUsed = await isWidgetTypeUsedOnPage('home', 'calendar');
      expect(notUsed).toBe(false);
    });

    it('should get all widget types on a page', async () => {
      const widgetTypes = await getPageWidgetTypes('events');
      
      expect(widgetTypes).toContain('blockGrid');
      expect(widgetTypes).toContain('calendar');
      expect(widgetTypes.length).toBe(2);
    });

    it('should return empty array for non-existent page', async () => {
      const widgetTypes = await getPageWidgetTypes('non-existent');
      expect(widgetTypes).toEqual([]);
    });
  });

  describe('Widget Type Search', () => {
    it('should find pages that use a specific widget type', async () => {
      const pages = await findPagesWithWidgetType('splash');

      expect(pages.length).toBe(1);
      expect(pages[0].slug).toBe('home');
    });

    it('should return empty array if no pages use widget type', async () => {
      const pages = await findPagesWithWidgetType('report' as any);

      expect(pages).toEqual([]);
    });
  });

  describe('Usage Statistics', () => {
    it('should get widget usage statistics', async () => {
      const stats = await getWidgetUsageStats();

      expect(stats.get('splash')).toBe(1);
      expect(stats.get('blockGrid')).toBe(1);
      expect(stats.get('calendar')).toBe(1);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect if widget type is already on page', async () => {
      const isDuplicate = await checkForDuplicateContent(
        'home',
        'splash',
        { title: 'Welcome' }
      );

      expect(isDuplicate).toBe(true);
    });

    it('should return false if widget type is not on page', async () => {
      const isDuplicate = await checkForDuplicateContent(
        'home',
        'calendar',
        { title: 'Events' }
      );

      expect(isDuplicate).toBe(false);
    });

    it('should return false for non-existent page', async () => {
      const isDuplicate = await checkForDuplicateContent(
        'non-existent',
        'splash',
        { title: 'Welcome' }
      );

      expect(isDuplicate).toBe(false);
    });
  });

  describe('Content Placement Recommendations', () => {
    it('should recommend target page if specified', async () => {
      const recommendations = await getContentPlacementRecommendations(
        'splash',
        'events'
      );

      expect(recommendations.recommendedPage).toBe('events');
      expect(recommendations.reason).toContain('Target page specified');
    });

    it('should detect if widget type already used on target page', async () => {
      const recommendations = await getContentPlacementRecommendations(
        'splash',
        'home'
      );

      expect(recommendations.recommendedPage).toBe('home');
      expect(recommendations.reason).toContain('already used');
    });

    it('should recommend page with fewest widgets if no target specified', async () => {
      const recommendations = await getContentPlacementRecommendations('report' as any);

      // Should recommend a page that doesn't use 'report' widget
      expect(recommendations.reason).toBeTruthy();
      expect(recommendations.existingUsage).toBeDefined();
    });

    it('should include existing usage statistics', async () => {
      const recommendations = await getContentPlacementRecommendations('splash');

      expect(recommendations.existingUsage).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle pages with no content views', async () => {
      const emptyPageData = {
        pageCollection: {
          items: [
            {
              sys: { id: 'page-empty' },
              slug: 'empty',
              title: 'Empty Page',
              contentViewCollection: {
                items: [],
              },
            },
          ],
        },
      };

      vi.mocked(contentful.getByQuery).mockResolvedValue(emptyPageData as any);

      const analysis = await analyzeSiteContent();
      const emptyPage = analysis.pages.find(p => p.slug === 'empty');

      expect(emptyPage).toBeDefined();
      expect(emptyPage?.widgetCount).toBe(0);
      expect(emptyPage?.widgetTypes).toEqual([]);
    });

    it('should handle content views with unknown adapters', async () => {
      const unknownAdapterData = {
        pageCollection: {
          items: [
            {
              sys: { id: 'page-unknown' },
              slug: 'unknown',
              contentViewCollection: {
                items: [
                  {
                    sys: { id: 'cv-unknown' },
                    name: 'Unknown Widget',
                    isAtomic: false,
                    isTitleVisible: true,
                    dataAdapter: {
                      sys: { id: 'adapter-unknown' },
                      name: 'unknown-adapter',
                    },
                    targetCollection: { items: [] },
                  },
                ],
              },
            },
          ],
        },
      };

      vi.mocked(contentful.getByQuery).mockResolvedValue(unknownAdapterData as any);

      const analysis = await analyzeSiteContent();
      const page = analysis.pages.find(p => p.slug === 'unknown');

      expect(page).toBeDefined();
      expect(page?.contentViews[0].widgetType).toBeUndefined();
    });

    it('should handle missing content view collections', async () => {
      const noCollectionData = {
        pageCollection: {
          items: [
            {
              sys: { id: 'page-no-collection' },
              slug: 'no-collection',
              contentViewCollection: null,
            },
          ],
        },
      };

      vi.mocked(contentful.getByQuery).mockResolvedValue(noCollectionData as any);

      const analysis = await analyzeSiteContent();
      const page = analysis.pages.find(p => p.slug === 'no-collection');

      expect(page).toBeDefined();
      expect(page?.widgetCount).toBe(0);
    });
  });
});

