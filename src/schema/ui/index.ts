import { z } from "zod";

// MetricSchema - used for GraphDataSchema (UI-related, not Contentful validation)
// This represents metric data structure for UI charts/graphs
export const MetricSchema = z.object({
  name: z.string().min(1, "Name is necessary"),
  description: z.string().min(1, "Description is necessary"),
  value: z.number().min(1, "Value is necessary"),
  unit: z.string().min(1, "Unit is necessary"),
});

// Define the recursive MenuItem type first
export type MenuItem = {
  index?: number;
  label: string;
  href?: string;
  active?: boolean;
  children?: MenuItem[];
  isButton?: boolean;
  isTopLevel?: boolean;
};

// Main menu item schema - matches the menuItems array structure in Navbar
// Using z.lazy() for recursive schema (menu items can contain other menu items)
export const MenuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    index: z.number().optional(),
    label: z.string().min(1, "Menu item label is required"),
    href: z.string().optional(), // href is optional for items with dropdowns
    active: z.boolean().optional().default(false),
    children: z.array(MenuItemSchema).optional(),
    isButton: z.boolean().optional().default(false), // New button property for square button styling
    isTopLevel: z.boolean().default(false),
  })
);

export const PageSchema = z.object({
  name: z.string().min(1, "Page name is required"),
});

export const CalendarEventSchema = z.object({
  date: z.date(),
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  url: z.string().min(1, "URL is required"),
});

export const CalendarPropsSchema = z.object({
  events: z
    .array(CalendarEventSchema)
    .min(1, "At least one calendar event is required"),
  initialDate: z.date().optional(),
  showNavigation: z.boolean().default(true),
});

// Array of menu items schema - matches the menuItems prop type
export const MenuItemsSchema = z.array(MenuItemSchema);

// Navbar props schema - matches the Props interface in Navbar.astro
export const NavbarPropsSchema = z.object({
  brand: z.string().optional().default("Brand"),
  brandLogo: z.string().optional(),
  menuItems: MenuItemsSchema.optional().default([]),
});

// Footer link item schema - matches the items array structure in Footer
export const FooterLinkItemSchema = z.object({
  label: z.string().min(1, "Footer link label is required"),
  url: z.string().min(1, "Footer link URL is required"),
});

// Footer link section schema - matches the links array structure in Footer
export const FooterLinkSectionSchema = z.object({
  title: z.string().min(1, "Footer section title is required"),
  items: z
    .array(FooterLinkItemSchema)
    .min(1, "At least one footer link item is required"),
});

// Social link schema - matches the socialLinks array structure in Footer
export const SocialLinkSchema = z.object({
  name: z.string().min(1, "Social link name is required"),
  url: z.string().min(1, "Social link URL is required"),
  icon: z.string().min(1, "Social link icon SVG path is required"),
});

// Footer props schema - matches the Props interface in Footer.astro
export const FooterPropsSchema = z.object({
  brand: z.string().optional().default("Brand"),
  brandLogo: z.string().optional(),
  description: z.string().optional().default(""),
  socialLinks: z.array(SocialLinkSchema).optional().default([]),
  links: z.array(FooterLinkSectionSchema).optional().default([]),
  copyright: z.string().optional().default(""),
});

export const CallToActionSchema = z.object({
  title: z.string().min(1, "Call to action title is required"),
  url: z.string().min(1, "Call to action URL is required"),
});

export const DoubleColumnItemSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  image: z.string().optional(), // Optional image URL for the item
  callToAction: CallToActionSchema.optional(),
});

export const DoubleColumnPropsSchema = z.object({
  items: z
    .array(DoubleColumnItemSchema)
    .min(1, "At least one double column item is required"),
  isTitleVisible: z.boolean().default(false),
  title: z.string().optional(),
});

export const SplashContentSchema = z.object({
  videoSrc: z.string().optional(),
  videoPoster: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  /** Optional hex color for the solid half (e.g. #7FCC37) */
  accentColor: z.string().optional(),
  /** Per-slide call to action (e.g. "Learn More" linking to a Program's page). */
  callToAction: CallToActionSchema.optional(),
});

export const SplashPropsSchema = z.object({
  contents: z
    .array(SplashContentSchema)
    .min(1, "At least one splash content is required"),
  padding: z.enum(["sm", "md", "lg"]).optional().default("md"),
  overlay: z.boolean().optional().default(true),
  overlayOpacity: z
    .enum(["light", "medium", "dark"])
    .optional()
    .default("dark"),
  autoPlay: z.boolean().optional().default(false),
});

export type SplashProps = z.infer<typeof SplashPropsSchema>;

export const ImageMarqueeItemSchema = z.object({
  title: z.string().optional(),
  image: z.string().min(1, "Image URL is required"),
  /** Optional link (e.g. the organization's website) to open when the logo is clicked. */
  url: z.string().optional(),
});

export const ImageMarqueePropsSchema = z.object({
  items: z
    .array(ImageMarqueeItemSchema)
    .min(1, "At least one image marquee item is required"),
  title: z.string().optional(),
  isTitleVisible: z.boolean().optional().default(false),
  /**
   * When true, logos are recolored to match the site's current text color and
   * automatically adapt to dark/light mode (like the Navbar/Footer brand icons).
   * When false (default), logos render in their original colors regardless of theme.
   */
  respectColorScheme: z.boolean().optional().default(false),
  /** Seconds for one full loop of the marquee. Lower is faster. */
  speed: z.number().positive().optional().default(30),
  /**
   * When true, renders a static, non-scrolling row of logos instead of the
   * animated infinite-scroll marquee - the item list is not duplicated in this
   * mode (duplication is only needed so the scroll animation can loop seamlessly).
   */
  isStatic: z.boolean().optional().default(false),
});

export type ImageMarqueeItem = z.infer<typeof ImageMarqueeItemSchema>;
export type ImageMarqueeProps = z.infer<typeof ImageMarqueePropsSchema>;

export const GraphDataSchema = z.object({
  categories: z.array(z.string()).min(1, "At least one category is required"),
  series: z
    .array(
      z.object({
        name: z.string().min(1, "Name is required"),
        data: z.array(z.number()).min(1, "At least one data point is required"),
      })
    )
    .min(1, "At least one series is required"),
});

export const GraphPropsSchema = z.object({
  data: GraphDataSchema,
  title: z.string().min(1, "Title is required"),
  type: z.enum(["bar", "trend"]).optional().default("bar"),
  height: z.string().optional(),
  colors: z.array(z.string()).optional(),
});

// Export TypeScript types
export type FooterLinkItem = z.infer<typeof FooterLinkItemSchema>;
export type FooterLinkSection = z.infer<typeof FooterLinkSectionSchema>;
export type SocialLink = z.infer<typeof SocialLinkSchema>;
export type FooterProps = z.infer<typeof FooterPropsSchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CalendarProps = z.infer<typeof CalendarPropsSchema>;

// Validation functions
export const validateFooterLinkItem = (data: unknown): FooterLinkItem => {
  return FooterLinkItemSchema.parse(data);
};

export const validateFooterLinkSection = (data: unknown): FooterLinkSection => {
  return FooterLinkSectionSchema.parse(data);
};

export const validateSocialLink = (data: unknown): SocialLink => {
  return SocialLinkSchema.parse(data);
};

export const validateFooterProps = (data: unknown): FooterProps => {
  return FooterPropsSchema.parse(data);
};

// Helper functions for creating footer items
export const createFooterLinkItem = (data: {
  label: string;
  url: string;
}): FooterLinkItem => {
  return FooterLinkItemSchema.parse(data);
};

export const createFooterLinkSection = (data: {
  title: string;
  items: FooterLinkItem[];
}): FooterLinkSection => {
  return FooterLinkSectionSchema.parse(data);
};

export const createSocialLink = (data: {
  name: string;
  url: string;
  icon: string;
}): SocialLink => {
  return SocialLinkSchema.parse(data);
};

export const GridItemSchema = z.object({
  image: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  url: z.string().min(1, "URL is required").optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  target: z
    .enum(["_blank", "_self", "_parent", "_top"])
    .optional()
    .default("_blank"),
  /** Optional call-to-action button rendered on top of the item (e.g. "Sign Up Here" linking to an external ticketing page) */
  callToAction: z
    .object({
      title: z.string().min(1, "Call to action title is required"),
      url: z.string().min(1, "Call to action URL is required"),
    })
    .optional(),
});

/** Category of grid items for display (e.g. by program name) */
export const GridCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  /** Optional hex or CSS color for the category header block */
  accentColor: z.string().optional(),
  /** Optional URL for the category/program page */
  url: z.string().optional(),
  items: z.array(GridItemSchema).min(0),
});

export const RichTextBlockSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  content: z.string(),
});

// Timeline item schema - matches the TimelineItem interface in VerticalTimeline.astro
export const TimelineItemSchema = z.object({
  date: z.union([z.string(), z.date()]).refine(
    (val) => {
      const date = val instanceof Date ? val : new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Date must be a valid date string or Date object" }
  ),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  image: z.string().url("Image must be a valid URL").optional(),
  content: z.string().optional(), // HTML content from Contentful rich text
  url: z.string().url("URL must be a valid URL").optional(), // URL from Posts or Press types
});

// Timeline props schema - matches the Props interface in VerticalTimeline.astro
export const TimelinePropsSchema = z.object({
  items: z
    .array(TimelineItemSchema)
    .min(1, "At least one timeline item is required"),
});

// MenuItem is already defined above as a recursive type
export type MenuItems = z.infer<typeof MenuItemsSchema>;
export type NavbarProps = z.infer<typeof NavbarPropsSchema>;
export type GridItem = z.infer<typeof GridItemSchema>;
export type GridCategory = z.infer<typeof GridCategorySchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type TimelineProps = z.infer<typeof TimelinePropsSchema>;
export type DoubleColumnItem = z.infer<typeof DoubleColumnItemSchema>;
export type DoubleColumnProps = z.infer<typeof DoubleColumnPropsSchema>;
export type RichTextBlock = z.infer<typeof RichTextBlockSchema>;

// Validation functions
export const validateMenuItem = (data: unknown): MenuItem => {
  return MenuItemSchema.parse(data);
};

export const validateMenuItems = (data: unknown): MenuItems => {
  return MenuItemsSchema.parse(data);
};

export const validateNavbarProps = (data: unknown): NavbarProps => {
  return NavbarPropsSchema.parse(data);
};

export const validateGridItems = (data: unknown): GridItem[] => {
  return z.array(GridItemSchema).parse(data);
};

export const validateGridCategories = (data: unknown): GridCategory[] => {
  return z.array(GridCategorySchema).parse(data);
};

export const validateTimelineItem = (data: unknown): TimelineItem => {
  return TimelineItemSchema.parse(data);
};

export const validateTimelineItems = (data: unknown): TimelineItem[] => {
  return z.array(TimelineItemSchema).parse(data);
};

export const validateTimelineProps = (data: unknown): TimelineProps => {
  return TimelinePropsSchema.parse(data);
};

// Helper function for creating timeline items
export const createTimelineItem = (data: {
  date: string | Date;
  title: string;
  description: string;
}): TimelineItem => {
  return TimelineItemSchema.parse(data);
};

export type ContentView = {
  type: string;
  name: string;
  title: string;
  isTitleVisible: boolean;
  keys: string[];
  values: string[];
  dataAdapter: {
    name: string;
  };
  targetCollection: {
    items: { sys: { id: string } }[];
  };
};
