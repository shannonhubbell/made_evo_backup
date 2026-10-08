/**
 * Figma Parser Tests - Checkpoint 2
 * 
 * Tests for the Figma design parser that extracts design information
 * from Figma files for conversion to Contentful entries.
 * 
 * To run: npm test tools/contentful/__tests__/figma-parser.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFigmaFile,
  detectWidgetType,
  extractTexts,
  extractImages,
  getFigmaImageUrls,
  FigmaAPIError,
} from '../figma-parser';
import type { FigmaConfig, FigmaDesignData } from '../figma-parser';

// Mock fetch globally
global.fetch = vi.fn();

describe('Figma Parser - Checkpoint 2', () => {
  const mockConfig: FigmaConfig = {
    accessToken: 'test-token',
    fileKey: 'test-file-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Figma API Integration', () => {
    it('should fetch and parse Figma file successfully', async () => {
      // Realistic Figma API response structure
      const mockFileData = {
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          children: [
            {
              id: '1:2',
              name: 'Page 1',
              type: 'CANVAS',
              children: [
                {
                  id: '2:3',
                  name: 'Hero Section',
                  type: 'FRAME',
                  layoutMode: null,
                  absoluteBoundingBox: { x: 0, y: 0, width: 1200, height: 600 },
                  children: [
                    {
                      id: '3:4',
                      name: 'Heading',
                      type: 'TEXT',
                      characters: 'Welcome to MADE',
                      style: {
                        fontSize: 48,
                        fontFamily: 'Inter',
                        fontWeight: 700,
                      },
                      fills: [
                        {
                          type: 'SOLID',
                          color: { r: 1, g: 1, b: 1, a: 1 },
                          visible: true,
                        },
                      ],
                      absoluteBoundingBox: { x: 100, y: 200, width: 1000, height: 60 },
                    },
                  ],
                },
              ],
            },
          ],
        },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFileData,
      } as Response);

      const result = await parseFigmaFile(mockConfig);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.figma.com/v1/files/test-file-key'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Figma-Token': 'test-token',
          }),
        })
      );
    });

    it('should handle node-specific queries', async () => {
      // Realistic Figma API nodes response
      const mockNodeData = {
        nodes: {
          '2:3': {
            document: {
              id: '2:3',
              name: 'Frame',
              type: 'FRAME',
              layoutMode: 'VERTICAL',
              absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
              children: [],
            },
            components: {},
            componentSets: {},
            schemaVersion: 0,
            styles: {},
          },
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNodeData,
      } as Response);

      const config: FigmaConfig = {
        ...mockConfig,
        nodeIds: ['node-1'],
      };

      const result = await parseFigmaFile(config);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('nodes?ids=node-1'),
        expect.any(Object)
      );
    });

    it('should handle authentication errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Invalid token' }),
      } as Response);

      await expect(parseFigmaFile(mockConfig)).rejects.toThrow(FigmaAPIError);
    });

    it('should handle rate limiting', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
      } as Response);

      await expect(parseFigmaFile(mockConfig)).rejects.toThrow(FigmaAPIError);
    });

    it('should handle invalid file keys', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'File not found' }),
      } as Response);

      await expect(parseFigmaFile(mockConfig)).rejects.toThrow(FigmaAPIError);
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(parseFigmaFile(mockConfig)).rejects.toThrow(FigmaAPIError);
    });
  });

  describe('Design Data Extraction', () => {
    it('should extract text content correctly', () => {
      const designData: FigmaDesignData = {
        name: 'Test Frame',
        nodeId: 'frame-1',
        texts: [
          {
            content: 'Heading Text',
            fontSize: 32,
            fontFamily: 'Inter',
            style: 'heading',
            nodeId: 'text-1',
          },
          {
            content: 'Body text',
            fontSize: 16,
            style: 'body',
            nodeId: 'text-2',
          },
        ],
        images: [],
        layout: { type: 'column' },
        children: [
          {
            name: 'Child Frame',
            nodeId: 'child-1',
            texts: [
              {
                content: 'Child text',
                style: 'body',
                nodeId: 'text-3',
              },
            ],
            images: [],
            layout: { type: 'stack' },
          },
        ],
      };

      const texts = extractTexts(designData);

      expect(texts.length).toBe(3);
      expect(texts[0].content).toBe('Heading Text');
      expect(texts[1].content).toBe('Body text');
      expect(texts[2].content).toBe('Child text');
    });

    it('should extract images correctly', () => {
      const designData: FigmaDesignData = {
        name: 'Test Frame',
        nodeId: 'frame-1',
        texts: [],
        images: [
          {
            url: 'https://example.com/image1.png',
            width: 800,
            height: 600,
            nodeId: 'img-1',
            format: 'png',
          },
        ],
        layout: { type: 'grid' },
        children: [
          {
            name: 'Child Frame',
            nodeId: 'child-1',
            texts: [],
            images: [
              {
                url: 'https://example.com/image2.png',
                width: 400,
                height: 300,
                nodeId: 'img-2',
                format: 'png',
              },
            ],
            layout: { type: 'stack' },
          },
        ],
      };

      const images = extractImages(designData);

      expect(images.length).toBe(2);
      expect(images[0].nodeId).toBe('img-1');
      expect(images[1].nodeId).toBe('img-2');
    });

    it('should preserve hierarchy in extraction', () => {
      const designData: FigmaDesignData = {
        name: 'Parent',
        nodeId: 'parent',
        texts: [{ content: 'Parent text', nodeId: 'text-1', style: 'body' }],
        images: [],
        layout: { type: 'column' },
        children: [
          {
            name: 'Child',
            nodeId: 'child',
            texts: [{ content: 'Child text', nodeId: 'text-2', style: 'body' }],
            images: [],
            layout: { type: 'stack' },
          },
        ],
      };

      const texts = extractTexts(designData);
      expect(texts.length).toBe(2);
      expect(texts.some(t => t.content === 'Parent text')).toBe(true);
      expect(texts.some(t => t.content === 'Child text')).toBe(true);
    });
  });

  describe('Widget Type Detection', () => {
    it('should detect splash widget for hero sections', () => {
      const designData: FigmaDesignData = {
        name: 'Hero Section',
        nodeId: 'hero-1',
        texts: [
          {
            content: 'Welcome',
            fontSize: 48,
            style: 'heading',
            nodeId: 'text-1',
          },
        ],
        images: [
          {
            url: 'https://example.com/hero.jpg',
            width: 1200,
            height: 600,
            nodeId: 'img-1',
          },
        ],
        layout: { type: 'absolute' },
      };

      const widgetType = detectWidgetType(designData);
      expect(widgetType).toBe('splash');
    });

    it('should detect grid widget for grid layouts', () => {
      const designData: FigmaDesignData = {
        name: 'Grid Layout',
        nodeId: 'grid-1',
        texts: [
          { content: 'Item 1', nodeId: 'text-1', style: 'body' },
          { content: 'Item 2', nodeId: 'text-2', style: 'body' },
        ],
        images: [
          { url: 'https://example.com/img1.jpg', width: 300, height: 200, nodeId: 'img-1' },
          { url: 'https://example.com/img2.jpg', width: 300, height: 200, nodeId: 'img-2' },
        ],
        layout: { type: 'grid', columns: 2 },
      };

      const widgetType = detectWidgetType(designData);
      expect(['blockGrid', 'textGrid']).toContain(widgetType);
    });

    it('should detect calendar widget for calendar patterns', () => {
      const designData: FigmaDesignData = {
        name: 'Calendar',
        nodeId: 'calendar-1',
        texts: [
          { content: 'January 2024', nodeId: 'text-1', style: 'heading' },
        ],
        images: [],
        layout: { type: 'grid' },
      };

      const widgetType = detectWidgetType(designData);
      expect(widgetType).toBe('calendar');
    });

    it('should detect timeline widget for chronological patterns', () => {
      const designData: FigmaDesignData = {
        name: 'Timeline',
        nodeId: 'timeline-1',
        texts: [
          { content: '2024-01-01', nodeId: 'text-1', style: 'body' },
          { content: 'Event 1', nodeId: 'text-2', style: 'heading' },
          { content: '2024-02-01', nodeId: 'text-3', style: 'body' },
          { content: 'Event 2', nodeId: 'text-4', style: 'heading' },
        ],
        images: [],
        layout: { type: 'column' },
        children: [
          { name: 'Item 1', nodeId: 'item-1', texts: [], images: [], layout: { type: 'stack' } },
          { name: 'Item 2', nodeId: 'item-2', texts: [], images: [], layout: { type: 'stack' } },
          { name: 'Item 3', nodeId: 'item-3', texts: [], images: [], layout: { type: 'stack' } },
          { name: 'Item 4', nodeId: 'item-4', texts: [], images: [], layout: { type: 'stack' } },
        ],
      };

      const widgetType = detectWidgetType(designData);
      expect(widgetType).toBe('verticalTimeline');
    });

    it('should return undefined for ambiguous designs', () => {
      const designData: FigmaDesignData = {
        name: 'Unknown',
        nodeId: 'unknown-1',
        texts: [],
        images: [],
        layout: { type: 'stack' },
      };

      const widgetType = detectWidgetType(designData);
      expect(widgetType).toBeUndefined();
    });
  });

  describe('Image URL Fetching', () => {
    it('should fetch image URLs from Figma API', async () => {
      const mockImageData = {
        images: {
          'node-1': 'https://figma.com/image1.png',
          'node-2': 'https://figma.com/image2.png',
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockImageData,
      } as Response);

      const imageMap = await getFigmaImageUrls(mockConfig, ['node-1', 'node-2']);

      expect(imageMap.size).toBe(2);
      expect(imageMap.get('node-1')).toBe('https://figma.com/image1.png');
      expect(imageMap.get('node-2')).toBe('https://figma.com/image2.png');
    });

    it('should handle missing image URLs', async () => {
      const mockImageData = {
        images: {
          'node-1': 'https://figma.com/image1.png',
          'node-2': null, // Image not available
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockImageData,
      } as Response);

      const imageMap = await getFigmaImageUrls(mockConfig, ['node-1', 'node-2']);

      expect(imageMap.size).toBe(1);
      expect(imageMap.get('node-1')).toBe('https://figma.com/image1.png');
      expect(imageMap.has('node-2')).toBe(false);
    });

    it('should handle empty node IDs', async () => {
      const imageMap = await getFigmaImageUrls(mockConfig, []);

      expect(imageMap.size).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle image API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(getFigmaImageUrls(mockConfig, ['node-1'])).rejects.toThrow(FigmaAPIError);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed API responses', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(parseFigmaFile(mockConfig)).rejects.toThrow();
    });

    it('should handle missing document in response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Empty response
      } as Response);

      const result = await parseFigmaFile(mockConfig);
      // Should return empty array or handle gracefully
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

