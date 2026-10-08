/**
 * Contentful Schemas
 *
 * Zod schemas for validating Contentful API responses.
 * These schemas match the structure returned by Contentful's GraphQL API.
 *
 * Generated from: src/generated/contentful-types.ts
 *
 * Usage:
 *   import { ProgramSchema } from '@/schema/contentful';
 *   const program = ProgramSchema.parse(contentfulData);
 */

import { z } from "zod";

/**
 * Base sys fields that appear in all Contentful entries
 */
export const SysFieldsSchema = z.object({
  id: z.string(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  revision: z.number().optional(),
});

/**
 * Asset reference schema (for images, videos, etc.)
 * Note: Contentful can return null for optional fields, so we use .nullable().optional()
 */
export const AssetReferenceSchema = z.object({
  sys: z.object({
    id: z.string(),
  }),
  url: z.string().nullable().optional(),
  content: z
    .object({
      json: z.any(),
    })
    .nullable()
    .optional(),
});

/**
 * Asset collection schema
 * Note: Contentful can return null items in collections, so we filter them out
 */
export const AssetCollectionSchema = z
  .object({
    items: z.array(AssetReferenceSchema.nullable()).nullable().optional(),
  })
  .nullable()
  .optional()
  .transform((data) => {
    // Filter out null items from the array
    if (!data || !data.items) return data;
    return {
      ...data,
      items: data.items.filter(
        (item): item is NonNullable<typeof item> => item !== null
      ),
    };
  });

/**
 * Rich text content schema (Contentful rich text field)
 * Note: Contentful can return null for optional fields
 */
const RichTextLinkedAssetSchema = z.object({
  sys: z.object({
    id: z.string(),
  }),
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const RichTextContentSchema = z
  .object({
    json: z.any(), // Contentful rich text JSON structure
    links: z
      .object({
        assets: z
          .object({
            block: z.array(RichTextLinkedAssetSchema).optional(),
            hyperlink: z.array(RichTextLinkedAssetSchema).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .nullable()
  .optional();

/**
 * Program content type schema
 * Note: Contentful can return null for optional fields
 */
export const ProgramSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string().nullable().optional(),
  recurringWeekday: z.array(z.string()).nullable().optional(), // Array of weekday strings (e.g., ["Monday", "Wednesday"]). Contentful can return null.
  content: RichTextContentSchema.optional(), // RichTextContentSchema is already .nullable().optional()
  imageCollection: AssetCollectionSchema.optional(), // AssetCollectionSchema is already .nullable().optional()
});

/**
 * Event content type schema
 */
export const EventSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  slug: z.string(),
  description: z.string().nullable().optional(), // Contentful can return null for optional fields
  content: RichTextContentSchema.nullable().optional(),
  imageCollection: AssetCollectionSchema.optional(),
  // Note: Contentful can return null items when a linked Member entry is deleted/unpublished
  // (an "unresolvable link"), so we filter those out rather than failing validation.
  presenterCollection: z
    .object({
      items: z.array(
        z
          .object({
            sys: SysFieldsSchema,
            firstName: z.string().optional(),
            lastName: z.string().optional(),
          })
          .nullable()
      ),
    })
    .optional()
    .transform((data) => {
      if (!data) return data;
      return {
        ...data,
        items: data.items.filter(
          (item): item is NonNullable<typeof item> => item !== null
        ),
      };
    }),
  program: z
    .object({
      sys: z.object({
        id: z.string(),
      }),
      title: z.string().optional(),
      url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  callToAction: z
    .object({
      sys: z.object({
        id: z.string(),
      }),
      title: z.string().optional(),
      url: z.string().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Post content type schema
 */
export const PostSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(), // Contentful can return null for optional fields
  content: RichTextContentSchema,
  date: z.string(),
  imageCollection: AssetCollectionSchema.optional(),
  videoCollection: AssetCollectionSchema.optional(),
  callToAction: z
    .object({
      sys: z.object({
        id: z.string(),
      }),
      title: z.string().optional(),
      url: z.string().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Page content type schema
 */
export const PageSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().optional(),
  sharingTitle: z.string().nullable().optional(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  imageCollection: AssetCollectionSchema.optional(), // AssetCollectionSchema is already .nullable().optional()
  contentViewCollection: z
    .object({
      items: z.array(z.any()), // ContentView is complex, will be defined separately
    })
    .optional(),
});

/**
 * Exhibit content type schema
 */
export const ExhibitSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  creator: z.string(),
  releaseDate: z.string().nullable().optional(), // ISO date string; Contentful returns null (not just undefined) when empty
  isDateEstimated: z.boolean().nullable().optional(),
  imageCollection: AssetCollectionSchema.optional(), // AssetCollectionSchema is already .nullable().optional()
});

/**
 * Member content type schema
 */
export const MemberSchema = z.object({
  sys: SysFieldsSchema,
  firstName: z.string(),
  lastName: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  email: z.string().nullable().optional(), // Contentful can return null for optional fields
  displayPriority: z.number().nullable().optional(), // Lower sorts first; unset members sort last
  organization: z
    .object({
      sys: z.object({
        id: z.string(),
      }),
    })
    .nullable()
    .optional(),
});

/**
 * Press content type schema
 */
export const PressSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: RichTextContentSchema.optional(),
  url: z.string().optional(),
  date: z.string().optional(),
  slug: z.string().optional(),
  organization: z
    .object({
      sys: z.object({
        id: z.string(),
      }),
      name: z.string().optional(),
      title: z.string().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * Organization content type schema
 * Used for e.g. partner/sponsor logos (see the Image Marquee widget).
 */
export const OrganizationSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().optional(),
  entityType: z.string().optional(),
  url: z.string().nullable().optional(),
  logo: AssetReferenceSchema.nullable().optional(),
});

export const OrganizationCollectionSchema = z.object({
  items: z.array(OrganizationSchema),
});

/**
 * ImpactReport content type schema
 */
export const ImpactReportSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().optional(),
  date: z.string(),
  period: z.string(),
  goal: RichTextContentSchema,
  description: RichTextContentSchema.nullable().optional(),
  programCollection: z
    .object({
      items: z.array(ProgramSchema),
    })
    .optional(),
});

/**
 * ContentView content type schema
 */
export const ContentViewSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
  title: z.string().optional(),
  type: z.string(),
  dataAdapter: z.object({
    sys: z.object({
      id: z.string(),
    }),
    name: z.string().optional(),
  }),
  targetCollection: z
    .object({
      items: z.array(
        z.object({
          sys: z.object({
            id: z.string(),
          }),
        })
      ),
    })
    .optional(),
  isAtomic: z.boolean(),
  isTitleVisible: z.boolean(),
  keys: z.array(z.string()).optional(),
  values: z.array(z.string()).optional(),
});

/**
 * DataAdapter content type schema
 */
export const DataAdapterSchema = z.object({
  sys: SysFieldsSchema,
  name: z.string(),
});

/**
 * MenuItem content type schema
 * Using z.lazy() for recursive schema (menu items can contain other menu items)
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    sys: SysFieldsSchema,
    name: z.string(),
    label: z.string(),
    href: z.string().optional(),
    active: z.boolean().optional(),
    isButton: z.boolean().optional(),
    isTopLevel: z.boolean(),
    index: z.number(),
    childrenCollection: z
      .object({
        items: z.array(MenuItemSchema),
      })
      .optional(),
  })
);

/**
 * Collection response schemas (for GraphQL collection queries)
 */
export const ProgramCollectionSchema = z.object({
  items: z.array(ProgramSchema),
});

export const EventCollectionSchema = z.object({
  items: z.array(EventSchema),
});

export const PostCollectionSchema = z.object({
  items: z.array(PostSchema),
});

export const PageCollectionSchema = z.object({
  items: z.array(PageSchema),
});

export const ExhibitCollectionSchema = z.object({
  items: z.array(ExhibitSchema),
});

export const MemberCollectionSchema = z.object({
  items: z.array(MemberSchema),
});

export const PressCollectionSchema = z.object({
  items: z.array(PressSchema),
});

export const MenuItemCollectionSchema = z.object({
  items: z.array(MenuItemSchema),
});

// Type exports (inferred from schemas)
export type Program = z.infer<typeof ProgramSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Exhibit = z.infer<typeof ExhibitSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type Press = z.infer<typeof PressSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type ImpactReport = z.infer<typeof ImpactReportSchema>;
export type ContentView = z.infer<typeof ContentViewSchema>;
export type DataAdapter = z.infer<typeof DataAdapterSchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
