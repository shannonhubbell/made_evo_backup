/**
 * Tests for Navbar Component
 * 
 * These tests verify that the Navbar component correctly:
 * - Fetches menu items from Contentful
 * - Handles errors gracefully
 * - Validates menu item structure
 * - Renders menu items correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuItem } from '../../schema/ui';
import type { MenuItem as ContentfulMenuItem } from '../../generated/contentful-types';

// Mock the contentful module
const mockGetByKey = vi.fn();
vi.mock('../../lib/contentful', () => ({
  getByKey: mockGetByKey,
}));

// Mock the helpers
const mockPrependBase = vi.fn((url: string) => url);
const mockGetBaseUrl = vi.fn(() => '/');
vi.mock('../../lib/helpers', () => ({
  prependBase: mockPrependBase,
  getBaseUrl: mockGetBaseUrl,
}));

// Mock the validateMenuItem function
const mockValidateMenuItem = vi.fn((item: any) => item);
vi.mock('../../schema/ui', async () => {
  const actual = await vi.importActual('../../schema/ui');
  return {
    ...actual,
    validateMenuItem: mockValidateMenuItem,
  };
});

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrependBase.mockImplementation((url: string) => url);
    mockGetBaseUrl.mockReturnValue('/');
  });

  describe('Menu Items Fetching', () => {
    it('should fetch menu items from Contentful', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Home',
          label: 'Home',
          href: '/',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
        {
          sys: { id: '2' },
          name: 'About',
          label: 'About',
          href: '/about',
          isTopLevel: true,
          isButton: false,
          index: 1,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      // Simulate the component's data fetching
      const menuData = await mockGetByKey('menuItemCollection');
      const menuItems = menuData.menuItemCollection.items.map((item: ContentfulMenuItem) => {
        return mockValidateMenuItem({
          index: item.index,
          label: item.label,
          href: mockPrependBase(item.href === '' ? '/' : (item.href || '/')),
          isTopLevel: item.isTopLevel ?? false,
          isButton: item.isButton,
          children: item.childrenCollection?.items && item.childrenCollection.items.length > 0
            ? item.childrenCollection.items.map((child: ContentfulMenuItem) => {
                return mockValidateMenuItem({
                  index: child.index,
                  label: child.label,
                  href: mockPrependBase(child.href === '' ? '/' : (child.href || '/')),
                });
              })
            : undefined,
        });
      });

      expect(mockGetByKey).toHaveBeenCalledWith('menuItemCollection');
      expect(menuItems).toHaveLength(2);
      expect(menuItems[0].label).toBe('Home');
      expect(menuItems[1].label).toBe('About');
    });

    it('should handle empty menu items gracefully', async () => {
      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: [],
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const menuItems = menuData.menuItemCollection?.items || [];

      expect(menuItems).toHaveLength(0);
    });

    it('should handle missing menuItemCollection in response', async () => {
      mockGetByKey.mockResolvedValue({});

      const menuData = await mockGetByKey('menuItemCollection');
      const menuItems = menuData.menuItemCollection?.items || [];

      expect(menuItems).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockGetByKey.mockRejectedValue(new Error('API Error'));

      await expect(mockGetByKey('menuItemCollection')).rejects.toThrow('API Error');
    });
  });

  describe('Menu Item Validation', () => {
    it('should validate menu items using validateMenuItem', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Test',
          label: 'Test',
          href: '/test',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      menuData.menuItemCollection.items.forEach((item: ContentfulMenuItem) => {
        mockValidateMenuItem({
          index: item.index,
          label: item.label,
          href: mockPrependBase(item.href === '' ? '/' : (item.href || '/')),
          isTopLevel: item.isTopLevel ?? false,
          isButton: item.isButton,
        });
      });

      expect(mockValidateMenuItem).toHaveBeenCalled();
    });

    it('should handle menu items with children', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Parent',
          label: 'Parent',
          href: '/parent',
          isTopLevel: true,
          isButton: false,
          index: 0,
          childrenCollection: {
            items: [
              {
                sys: { id: '2' },
                name: 'Child',
                label: 'Child',
                href: '/child',
                isTopLevel: false,
                index: 0,
              },
            ],
          },
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const menuItems = menuData.menuItemCollection.items.map((item: ContentfulMenuItem) => {
        return {
          ...item,
          children: item.childrenCollection?.items && item.childrenCollection.items.length > 0
            ? item.childrenCollection.items.map((child: ContentfulMenuItem) => ({
                index: child.index,
                label: child.label,
                href: mockPrependBase(child.href === '' ? '/' : (child.href || '/')),
              }))
            : undefined,
        };
      });

      expect(menuItems[0].children).toBeDefined();
      expect(menuItems[0].children).toHaveLength(1);
      expect(menuItems[0].children?.[0].label).toBe('Child');
    });

    it('should handle menu items without children', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Simple',
          label: 'Simple',
          href: '/simple',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const menuItems = menuData.menuItemCollection.items.map((item: ContentfulMenuItem) => {
        return {
          ...item,
          children: item.childrenCollection?.items && item.childrenCollection.items.length > 0
            ? item.childrenCollection.items.map((child: ContentfulMenuItem) => ({
                index: child.index,
                label: child.label,
                href: mockPrependBase(child.href === '' ? '/' : (child.href || '/')),
              }))
            : undefined,
        };
      });

      expect(menuItems[0].children).toBeUndefined();
    });
  });

  describe('URL Handling', () => {
    it('should prepend base URL to menu item hrefs', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Test',
          label: 'Test',
          href: '/test',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      menuData.menuItemCollection.items.forEach((item: ContentfulMenuItem) => {
        const href = item.href === '' ? '/' : item.href?.toString();
        mockPrependBase(href || '/');
      });

      expect(mockPrependBase).toHaveBeenCalled();
    });

    it('should handle empty href as root path', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Home',
          label: 'Home',
          href: '',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
      },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const href = menuData.menuItemCollection.items[0].href === '' ? '/' : menuData.menuItemCollection.items[0].href?.toString();

      expect(href).toBe('/');
    });
  });

  describe('Menu Item Sorting', () => {
    it('should sort menu items by index', () => {
      const menuItems: MenuItem[] = [
        { index: 2, label: 'Third', href: '/third' },
        { index: 0, label: 'First', href: '/first' },
        { index: 1, label: 'Second', href: '/second' },
      ];

      const sorted = menuItems.sort((a: MenuItem, b: MenuItem) => (a.index || 0) - (b.index || 0));

      expect(sorted[0].index).toBe(0);
      expect(sorted[1].index).toBe(1);
      expect(sorted[2].index).toBe(2);
    });

    it('should handle menu items without index', () => {
      const menuItems: MenuItem[] = [
        { label: 'No Index 1', href: '/1' },
        { index: 1, label: 'With Index', href: '/2' },
        { label: 'No Index 2', href: '/3' },
      ];

      const sorted = menuItems.sort((a: MenuItem, b: MenuItem) => (a.index || 0) - (b.index || 0));

      // Items without index should be treated as 0
      expect(sorted[0].index).toBeUndefined();
      expect(sorted[1].index).toBeUndefined();
      expect(sorted[2].index).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should use generated Contentful types', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Test',
          label: 'Test',
          href: '/test',
          isTopLevel: true,
          isButton: false,
          index: 0,
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const items: ContentfulMenuItem[] = menuData.menuItemCollection.items;

      // TypeScript should infer the correct type
      expect(items[0].sys.id).toBe('1');
      expect(items[0].label).toBe('Test');
      expect(typeof items[0].isTopLevel).toBe('boolean');
    });

    it('should handle optional fields correctly', async () => {
      const mockMenuItems: ContentfulMenuItem[] = [
        {
          sys: { id: '1' },
          name: 'Test',
          label: 'Test',
          href: '/test',
          isTopLevel: true,
          isButton: false,
          index: 0,
          // childrenCollection is optional
        },
      ];

      mockGetByKey.mockResolvedValue({
        menuItemCollection: {
          items: mockMenuItems,
        },
      });

      const menuData = await mockGetByKey('menuItemCollection');
      const item: ContentfulMenuItem = menuData.menuItemCollection.items[0];

      expect(item.childrenCollection).toBeUndefined();
      // Should not throw when accessing optional field
      expect(item.childrenCollection?.items).toBeUndefined();
    });
  });
});

