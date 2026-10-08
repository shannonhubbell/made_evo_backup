/**
 * Adapter Tests
 *
 * Tests for all data adapter functions to ensure they:
 * 1. Return correct WidgetData types
 * 2. Handle edge cases gracefully
 * 3. Transform Contentful data correctly
 * 4. Work with the adapter registry
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  splashFromPage,
  splashFromPrograms,
  gridFromExhibits,
  gridFromEvents,
  gridFromPrograms,
  gridFromMembers,
  gridFromPosts,
  calendarFromEvents,
  doubleColumnFromPosts,
  doubleColumnFromPrograms,
  singleColumnFromPosts,
  verticalTimelineFromPress,
  verticalTimelineFromHistory,
  impactReportFromImpactReport,
} from "../../adapters";
import type {
  SplashWidgetData,
  GridWidgetData,
  CalendarWidgetData,
  DoubleColumnWidgetData,
  SingleColumnWidgetData,
  VerticalTimelineWidgetData,
  ReportWidgetData,
  WidgetData,
} from "../../../schema/ui/widget-data";
import {
  isSplashWidgetData,
  isReportWidgetData,
  isCollectionWidgetData,
} from "../../../schema/ui/widget-data";
import * as contentful from "../../contentful";

// Mock Contentful functions
vi.mock("../../contentful", () => ({
  getByQuery: vi.fn(),
  getByQueryAndVariables: vi.fn(),
  getPageBySlug: vi.fn(),
  apiCall: vi.fn(),
}));

// Mock helpers
vi.mock("../../helpers", () => ({
  prependBase: (path: string) => path,
  EVENT_TIME_ZONE: "America/Los_Angeles",
}));

// Helper to create valid Contentful mock data with required fields
const createMockSys = (id: string = "test-id") => ({
  id,
  publishedAt: "2024-01-01T00:00:00Z",
});

const createMockPage = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "test-page",
  title: "Test Page",
  slug: "test-page",
  ...overrides,
});

const createMockProgram = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "test-program",
  title: "Test Program",
  description: "Test Description",
  imageCollection: {
    items: [
      {
        sys: { id: "asset-1" },
        url: "https://example.com/image.jpg",
      },
    ],
  },
  ...overrides,
});

const createMockEvent = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "test-event",
  title: "Test Event Title",
  description: "Test Description",
  startDate: "2024-01-01",
  slug: "test-event",
  imageCollection: {
    items: [
      {
        sys: { id: "asset-1" },
        url: "https://example.com/image.jpg",
      },
    ],
  },
  ...overrides,
});

const createMockPost = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "test-post",
  title: "Test Post",
  slug: "test-post",
  description: "Test Description",
  content: {
    json: {
      nodeType: "document",
      data: {},
      content: [
        {
          nodeType: "paragraph",
          data: {},
          content: [
            {
              nodeType: "text",
              value: "Test content",
              marks: [],
              data: {},
            },
          ],
        },
      ],
    },
  },
  date: "2024-01-01",
  ...overrides,
});

const createMockExhibit = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "Test Exhibit",
  title: "Test Exhibit Title",
  ...overrides,
});

const createMockPress = (overrides: any = {}) => ({
  sys: createMockSys(),
  name: "test-press",
  title: "Test Press",
  date: "2024-01-01",
  description: "Test Description",
  ...overrides,
});

describe("Adapter Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Splash Adapters", () => {
    it("splashFromPage should return SplashWidgetData", async () => {
      const mockPage = {
        pageCollection: {
          items: [createMockPage()],
        },
      };

      (contentful.getByQueryAndVariables as any).mockResolvedValue(mockPage);

      const result = await splashFromPage([], [], ["test-id"], true);

      expect(result).toBeDefined();
      expect(isSplashWidgetData(result)).toBe(true);
      expect(result).toHaveProperty("contents");
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toHaveProperty("title");
      expect(result).toHaveProperty("padding");
    });

    it("splashFromPrograms should return SplashWidgetData", async () => {
      const mockProgram = {
        programCollection: {
          items: [createMockProgram()],
        },
      };

      (contentful.getByQueryAndVariables as any).mockResolvedValue(mockProgram);

      const result = await splashFromPrograms([], [], ["test-id"], true);

      expect(result).toBeDefined();
      expect(isSplashWidgetData(result)).toBe(true);
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].title).toBe("Test Program");
      expect(result.contents[0].videoPoster).toBe(
        "https://example.com/image.jpg"
      );
    });
  });

  describe("Grid Adapters", () => {
    it("gridFromExhibits should return GridWidgetData", async () => {
      const mockExhibits = {
        exhibitCollection: {
          items: [createMockExhibit()],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockExhibits);

      const result = await gridFromExhibits([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result).toHaveProperty("items");
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("gridFromEvents should return GridWidgetData", async () => {
      const mockEvents = {
        eventCollection: {
          items: [
            createMockEvent({
              program: {
                sys: { id: "program-1" },
                title: "Test Program",
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockEvents);

      const result = await gridFromEvents([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty("title");
      expect(result.items[0]).toHaveProperty("url");
    });

    it('gridFromEvents should filter by tag when keyword="featured" is provided', async () => {
      const mockEvents = {
        eventCollection: {
          items: [
            createMockEvent({
              program: {
                sys: { id: "program-1" },
                title: "Test Program",
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockEvents);

      const result = await gridFromEvents(["keyword"], ["featured"], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);

      const [query] = (contentful.getByQuery as any).mock.calls[0];
      expect(query).toContain("contentfulMetadata");
      expect(query).toContain('id_contains_some: ["featured"]');
    });

    it("gridFromEvents should not filter by tag when no keyword is provided", async () => {
      const mockEvents = {
        eventCollection: {
          items: [
            createMockEvent({
              program: {
                sys: { id: "program-1" },
                title: "Test Program",
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockEvents);

      await gridFromEvents([], [], [], false);

      const [query] = (contentful.getByQuery as any).mock.calls[0];
      expect(query).not.toContain("contentfulMetadata");
    });

    it("gridFromPrograms should return GridWidgetData", async () => {
      const mockPrograms = {
        programCollection: {
          items: [
            createMockProgram({
              url: "/programs/test",
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPrograms);

      const result = await gridFromPrograms([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("gridFromMembers should return GridWidgetData", async () => {
      const mockMembers = {
        memberCollection: {
          items: [
            {
              sys: createMockSys(),
              firstName: "John",
              lastName: "Doe",
            },
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockMembers);

      const result = await gridFromMembers([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
    });

    it("gridFromPosts should return GridWidgetData", async () => {
      const mockPosts = {
        postCollection: {
          items: [
            createMockPost({
              callToAction: {
                sys: { id: "cta-1" },
                title: "Read More",
                url: "/blog/test",
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPosts);

      const result = await gridFromPosts([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
    });
  });

  describe("Calendar Adapters", () => {
    it("calendarFromEvents should return CalendarWidgetData", async () => {
      const mockEvents = {
        eventCollection: {
          items: [createMockEvent()],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockEvents);

      const result = await calendarFromEvents([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty("date");
      expect(result.items[0]).toHaveProperty("title");
      expect(result.items[0]).toHaveProperty("url");
    });
  });

  describe("Double Column Adapters", () => {
    it("doubleColumnFromPosts should return DoubleColumnWidgetData", async () => {
      const mockPosts = {
        postCollection: {
          items: [
            createMockPost({
              callToAction: {
                sys: { id: "cta-1" },
                title: "Read More",
                url: "/blog/test",
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPosts);

      const result = await doubleColumnFromPosts([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty("content");
    });

    it("doubleColumnFromPrograms should return DoubleColumnWidgetData", async () => {
      const mockPrograms = {
        programCollection: {
          items: [createMockProgram()],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPrograms);

      const result = await doubleColumnFromPrograms([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
    });
  });

  describe("Single Column Adapters", () => {
    it("singleColumnFromPosts should return SingleColumnWidgetData", async () => {
      const mockPosts = {
        postCollection: {
          items: [
            createMockPost({
              content: {
                json: {
                  nodeType: "document",
                  data: {},
                  content: [
                    {
                      nodeType: "paragraph",
                      data: {},
                      content: [
                        {
                          nodeType: "text",
                          value: "Test content",
                          marks: [],
                          data: {},
                        },
                      ],
                    },
                  ],
                },
              },
            }),
          ],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPosts);

      const result = await singleColumnFromPosts([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
    });
  });

  describe("Vertical Timeline Adapters", () => {
    it("verticalTimelineFromPress should return VerticalTimelineWidgetData", async () => {
      const mockPress = {
        pressCollection: {
          items: [createMockPress()],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPress);

      const result = await verticalTimelineFromPress([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty("date");
      expect(result.items[0]).toHaveProperty("title");
    });

    it("verticalTimelineFromHistory should return VerticalTimelineWidgetData", async () => {
      const mockPosts = {
        postCollection: {
          items: [createMockPost()],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockPosts);

      const result = await verticalTimelineFromHistory([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
    });
  });

  describe("Report Adapters", () => {
    it("impactReportFromImpactReport should return ReportWidgetData", async () => {
      const mockImpactReport = {
        impactReport: {
          sys: createMockSys(),
          name: "Test Report",
          title: "Test Report Title",
          date: "2024-01-01",
          period: "Year",
          goal: "Test Goal",
          description: { json: { nodeType: "document", content: [] } },
          programCollection: {
            items: [
              {
                sys: createMockSys("program-1"),
                name: "test-program",
                title: "Test Program",
                description: "Test Description",
              },
            ],
          },
        },
      };

      const mockMetrics = {
        metricCollection: {
          items: [
            {
              name: "Test Metric",
              title: "Test Metric Title",
              description: "Test Description",
              sys: { id: "metric-1" },
            },
          ],
        },
      };

      const mockMetricPeriods = {
        metricPeriodCollection: {
          items: [],
        },
      };

      (contentful.getByQuery as any)
        .mockResolvedValueOnce(mockImpactReport)
        .mockResolvedValueOnce(mockMetrics)
        .mockResolvedValueOnce(mockMetricPeriods);

      const result = await impactReportFromImpactReport(
        [],
        [],
        ["test-id"],
        true
      );

      expect(result).toBeDefined();
      expect(isReportWidgetData(result)).toBe(true);
      expect(result).toHaveProperty("report");
      expect(result.report).toHaveProperty("name");
      expect(result.report).toHaveProperty("title");
      expect(result.report).toHaveProperty("categories");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty collections gracefully", async () => {
      const mockEmpty = {
        exhibitCollection: {
          items: [],
        },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockEmpty);

      const result = await gridFromExhibits([], [], [], false);

      expect(result).toBeDefined();
      expect(isCollectionWidgetData(result)).toBe(true);
      expect(result.items).toEqual([]);
    });

    it("should handle missing optional fields", async () => {
      // Include required fields (sys, name, slug) but omit optional ones
      const mockPage = {
        pageCollection: {
          items: [
            createMockPage({
              // title is optional, but we include it for the test
              // contentViewCollection is optional and omitted
            }),
          ],
        },
      };

      (contentful.getByQueryAndVariables as any).mockResolvedValue(mockPage);

      const result = await splashFromPage([], [], ["test-id"], true);

      expect(result).toBeDefined();
      expect(isSplashWidgetData(result)).toBe(true);
    });
  });

  describe("Type Safety", () => {
    it("all adapters should return WidgetData", async () => {
      const mockData = {
        pageCollection: { items: [createMockPage()] },
        programCollection: { items: [createMockProgram()] },
        exhibitCollection: { items: [createMockExhibit()] },
        eventCollection: {
          items: [
            createMockEvent({
              program: {
                sys: { id: "program-1" },
                title: "Test Program",
              },
            }),
          ],
        },
        memberCollection: {
          items: [
            {
              sys: createMockSys(),
              firstName: "John",
              lastName: "Doe",
            },
          ],
        },
        postCollection: {
          items: [
            createMockPost({
              callToAction: {
                sys: { id: "cta-1" },
                title: "Read",
                url: "/",
              },
            }),
          ],
        },
        pressCollection: { items: [createMockPress()] },
        impactReport: {
          sys: createMockSys(),
          name: "Test",
          title: "Test",
          period: "Year",
          goal: "Test",
          description: { json: { nodeType: "document", content: [] } },
          programCollection: { items: [] },
        },
        metricCollection: { items: [] },
        metricPeriodCollection: { items: [] },
      };

      (contentful.getByQuery as any).mockResolvedValue(mockData);
      (contentful.getByQueryAndVariables as any).mockResolvedValue(mockData);

      const adapters = [
        () => splashFromPage([], [], ["test"], true),
        () => splashFromPrograms([], [], ["test"], true),
        () => gridFromExhibits([], [], [], false),
        () => gridFromEvents([], [], [], false),
        () => gridFromPrograms([], [], [], false),
        () => gridFromMembers([], [], [], false),
        () => gridFromPosts([], [], [], false),
        () => calendarFromEvents([], [], [], false),
        () => doubleColumnFromPosts([], [], [], false),
        () => doubleColumnFromPrograms([], [], [], false),
        () => singleColumnFromPosts([], [], [], false),
        () => verticalTimelineFromPress([], [], [], false),
        () => verticalTimelineFromHistory([], [], [], false),
        () => impactReportFromImpactReport([], [], ["test"], true),
      ];

      // Setup mocks for all adapters
      let callCount = 0;
      (contentful.getByQuery as any).mockImplementation((query: string) => {
        if (query.includes("impactReport")) {
          // First call for impactReport
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              impactReport: {
                sys: createMockSys(),
                name: "Test",
                title: "Test",
                date: "2024-01-01",
                period: "Year",
                goal: "Test",
                description: { json: { nodeType: "document", content: [] } },
                programCollection: { items: [] },
              },
            });
          } else if (callCount === 2) {
            // Second call for metrics
            return Promise.resolve({
              metricCollection: { items: [] },
            });
          } else {
            // Third call for metricPeriods
            return Promise.resolve({
              metricPeriodCollection: { items: [] },
            });
          }
        }
        if (query.includes("postCollection")) {
          return Promise.resolve({
            postCollection: {
              items: [
                createMockPost({
                  callToAction: {
                    sys: { id: "cta-1" },
                    title: "Read",
                    url: "/",
                  },
                }),
              ],
            },
          });
        }
        if (query.includes("programCollection") && query.includes("id_in")) {
          // For doubleColumnFromPrograms - needs description
          return Promise.resolve({
            programCollection: {
              items: [
                createMockProgram({
                  description: "Test program description for double column",
                }),
              ],
            },
          });
        } else if (query.includes("programCollection")) {
          return Promise.resolve({
            programCollection: {
              items: [createMockProgram()],
            },
          });
        }
        return Promise.resolve(mockData);
      });

      for (const adapter of adapters) {
        const result = await adapter();
        // Type check: result should be assignable to WidgetData
        const widgetData: WidgetData = result;
        expect(widgetData).toBeDefined();
      }
    });
  });
});
