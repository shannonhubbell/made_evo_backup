import type { DoubleColumnItem, RichTextBlock } from "../schema/ui";
import type { z } from "zod";
import { SplashPropsSchema } from "../schema/ui";
type SplashProps = z.infer<typeof SplashPropsSchema>;
import {
  apiCall,
  getByQuery,
  getPageBySlug,
  getGoogleFormById,
} from "./contentful";
import {
  queryPrograms,
  queryEvents,
  queryPosts,
  queryPages,
  queryExhibits,
  queryMembers,
  queryPress,
  queryOrganizations,
  queryImpactReport,
  queryMetrics,
  queryMetricPeriods,
  type QueryOptions,
} from "./contentful/query-builder";
import {
  CalendarEventSchema,
  DoubleColumnItemSchema,
  GraphDataSchema,
  GridItemSchema,
  GridCategorySchema,
  RichTextBlockSchema,
  TimelineItemSchema,
  ImageMarqueeItemSchema,
  type GridItem,
  type GridCategory,
  type TimelineItem,
} from "../schema/ui";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import { renderContentfulRichTextWithEmbeddedAssets } from "./contentful/rich-text";
import { BLOCKS } from "@contentful/rich-text-types";
import { marked } from "marked";
import {
  CountDataSchema,
  ReportItemSchema,
  ReportSchema,
  type Report,
  type CountData,
  type ReportCategory,
  type CountDataPoint,
  type ReportArea,
  ReportCategorySchema,
  ReportAreaSchema,
} from "../schema/ui/report";
import { prependBase, EVENT_TIME_ZONE } from "./helpers";
import {
  validateContentfulData,
  validateContentfulCollection,
  validateUIData,
  validateUICollection,
  safeValidateContentfulData,
  type AdapterValidationError,
} from "./adapters/validation";
import {
  ProgramSchema,
  EventSchema,
  PostSchema,
  PageSchema,
  ExhibitSchema,
  MemberSchema,
  PressSchema,
  OrganizationSchema,
  ImpactReportSchema,
  ProgramCollectionSchema,
  EventCollectionSchema,
  PostCollectionSchema,
  PageCollectionSchema,
  ExhibitCollectionSchema,
  MemberCollectionSchema,
  PressCollectionSchema,
  OrganizationCollectionSchema,
} from "../schema/contentful";
import type {
  SplashWidgetData,
  GridWidgetData,
  CategorizedGridWidgetData,
  CalendarWidgetData,
  DoubleColumnWidgetData,
  SingleColumnWidgetData,
  VerticalTimelineWidgetData,
  ReportWidgetData,
  WidgetData,
  MiniSplashWidgetData,
  GoogleFormWidgetData,
  ImageMarqueeWidgetData,
} from "../schema/ui/widget-data";
// Generated Contentful types
import type {
  Program,
  Event,
  Post,
  Page,
  Exhibit,
  Member,
  Press,
  ImpactReport,
  Metric,
  MetricPeriod,
} from "../generated/contentful-types";

/**
 * Resolves a Contentful GraphQL `order` clause (e.g. "date_DESC") from a
 * ContentView's keys/values pairs, so editors can control which field a
 * collection is sorted by, and in which direction, without code changes.
 *
 * Recognized keys (case-insensitive):
 *   - "orderBy": the field name to sort by. Must be one of `allowedFields`,
 *     otherwise it's ignored and `defaultField` is used instead.
 *   - "orderDirection": "asc" or "desc" (case-insensitive). Anything else
 *     falls back to `defaultDirection`.
 */
function resolveOrderClause(
  keys: string[] | undefined,
  values: string[] | undefined,
  allowedFields: string[],
  defaultField: string,
  defaultDirection: "ASC" | "DESC" = "ASC"
): string {
  const orderByIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "orderby") ?? -1;
  const requestedField =
    orderByIndex >= 0 ? values?.[orderByIndex]?.trim() : undefined;
  const field =
    requestedField && allowedFields.includes(requestedField)
      ? requestedField
      : defaultField;

  const directionIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "orderdirection") ?? -1;
  const requestedDirection =
    directionIndex >= 0
      ? values?.[directionIndex]?.trim().toLowerCase()
      : undefined;
  const direction =
    requestedDirection === "desc"
      ? "DESC"
      : requestedDirection === "asc"
      ? "ASC"
      : defaultDirection;

  return `${field}_${direction}`;
}

export async function splashFromPage(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<SplashWidgetData> {
  const targetID = targetIDs[0];
  const query = queryPages({
    where: `sys: { id: "${targetID}" }`,
    limit: 1,
  });

  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.pageCollection,
    PageCollectionSchema,
    "splashFromPage: pageCollection"
  );

  if (collection.items.length === 0) {
    throw new Error(`Page not found for ID: ${targetID}`);
  }

  const page = validateContentfulData(
    collection.items[0],
    PageSchema,
    "splashFromPage: page"
  );

  // Transform to UI format
  // Create a content item for each image in the collection
  const images = page.imageCollection?.items || [];
  const contents =
    images.length > 0
      ? images.map((image) => ({
          videoPoster: image?.url || undefined,
          title: page.title || page.name,
          subtitle: "", // Page type doesn't have subtitle field
        }))
      : [
          {
            title: page.title || page.name,
            subtitle: "", // Page type doesn't have subtitle field
          },
        ];

  const splashData = {
    contents: contents,
    padding: "lg" as const,
    overlay: true,
    overlayOpacity: "dark" as const,
  };

  // Validate UI output - parse returns the correct type
  const validated = SplashPropsSchema.parse(splashData);
  return validated as SplashWidgetData;
}

export async function splashFromPrograms(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<SplashWidgetData> {
  // Query all programs with the provided IDs
  const query = queryPrograms({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50, // Limit to reduce query complexity
  });

  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.programCollection,
    ProgramCollectionSchema,
    "splashFromPrograms: programCollection"
  );

  if (collection.items.length === 0) {
    throw new Error(`No programs found for IDs: ${targetIDs.join(", ")}`);
  }

  const locale = (globalThis as any).Astro?.locals?.locale as
    | string
    | undefined;

  // Transform to UI format
  // Create content items for all programs and their images
  const contents: Array<{
    videoPoster?: string;
    title?: string;
    subtitle?: string;
    callToAction?: { title: string; url: string };
  }> = [];

  for (const programItem of collection.items) {
    const program = validateContentfulData(
      programItem,
      ProgramSchema,
      "splashFromPrograms: program"
    );

    // Programs get an automatic "Learn More" call to action linking to their
    // own page, instead of relying on the widget's configured Call to Action
    // (which is used as a fallback for non-Program-sourced splashes instead).
    const callToAction = program.url
      ? {
          title: "Learn More",
          url: prependBase(program.url, locale || "en-US"),
        }
      : undefined;

    // Format recurring weekdays for subtitle
    // If single day: show full weekday name (e.g., "Monday")
    // If multiple days: use shortened abbreviations (M, T, W, TH, F, S, SA)
    // Tuesday = "T", Thursday = "TH" to differentiate
    // Saturday = "S", Sunday = "SA" to differentiate
    // Add "Repeating" prefix if recurring weekdays exist
    const recurringWeekdays = program.recurringWeekday || [];

    let subtitle: string;
    if (recurringWeekdays.length > 0) {
      if (recurringWeekdays.length === 1) {
        // Single day: use full weekday name
        subtitle = `Every ${recurringWeekdays[0]}`;
      } else {
        // Multiple days: use abbreviations
        const weekdayAbbrev: Record<string, string> = {
          Monday: "M",
          Tuesday: "T",
          Wednesday: "W",
          Thursday: "TH",
          Friday: "F",
          Saturday: "S",
          Sunday: "SA",
        };

        // Convert to abbreviations and join with commas
        const abbrevs = recurringWeekdays
          .map((day) => weekdayAbbrev[day] || day.substring(0, 2).toUpperCase())
          .join(", ");

        subtitle = `Every ${abbrevs}`;
      }
    } else {
      subtitle = "";
    }

    // Create a content item for each image in the program's collection
    const images = program.imageCollection?.items || [];
    if (images.length > 0) {
      // Add a content item for each image
      images.forEach((image) => {
        contents.push({
          videoPoster: image?.url || undefined,
          title: program.title,
          subtitle: subtitle,
          callToAction,
        });
      });
    } else {
      // If no images, add one content item without videoPoster
      contents.push({
        title: program.title,
        subtitle: subtitle,
        callToAction,
      });
    }
  }

  // Ensure at least one content item exists
  if (contents.length === 0) {
    contents.push({
      title: "Untitled",
      subtitle: "",
    });
  }

  const splashData = {
    contents: contents,
    padding: "lg" as const,
    overlay: true,
    overlayOpacity: "dark" as const,
    autoPlay: true
  };

  // Validate UI output - parse returns the correct type
  const validated = SplashPropsSchema.parse(splashData);
  return validated as SplashWidgetData;
}

/**
 * Resolves a Program's Contentful entry ID by matching its "name" or "title" field
 * against the given human-readable name. Programs have both a "name" field (internal)
 * and a "title" field (public); match against either since content editors may
 * reasonably type in either one. Used by adapters that accept a "program" key/value
 * pair on their ContentView so editors can filter to a single program without needing
 * to know its Contentful entry ID (matching how scripts/push-people-to-contentful.ts
 * resolves Member entries by name rather than a hardcoded entry ID).
 */
async function resolveProgramIdByName(programName: string): Promise<string | null> {
  const escapedProgramName = programName
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  const programQuery = queryPrograms({
    where: `OR: [{ name: "${escapedProgramName}" }, { title: "${escapedProgramName}" }]`,
    limit: 1,
  });
  const programData = await getByQuery(programQuery);

  if (!programData?.programCollection) return null;

  const programCollection = validateContentfulData(
    programData.programCollection,
    ProgramCollectionSchema,
    "resolveProgramIdByName: programCollection"
  );
  return programCollection.items[0]?.sys.id ?? null;
}

export async function gridFromExhibits(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // Look for a "program" key/value pair so editors can restrict this grid to exhibits
  // linked to a single Program, following the same keys/values convention used by
  // other adapters (see e.g. categorizedGridFromUpcomingEvents).
  const programKeyIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "program") ?? -1;
  const programName =
    programKeyIndex >= 0 ? values?.[programKeyIndex]?.trim() : undefined;

  let whereClause: string | undefined;
  if (programName) {
    const programId = await resolveProgramIdByName(programName);
    if (!programId) {
      console.warn(
        `gridFromExhibits: No program found with name "${programName}"`
      );
      return { items: [] };
    }
    whereClause = `program: { sys: { id: "${programId}" } }`;
  }

  // Add limit to reduce query complexity (Contentful max is 11000)
  const query = queryExhibits(
    whereClause ? { where: whereClause, limit: 100 } : { limit: 100 }
  );
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.exhibitCollection,
    ExhibitCollectionSchema,
    "gridFromExhibits: exhibitCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((exhibit, index) => {
    // Validate Contentful item
    const validatedExhibit = validateContentfulData(
      exhibit,
      ExhibitSchema,
      `gridFromExhibits: exhibit[${index}]`
    );

    // Transform to UI format
    const imageUrl = validatedExhibit.imageCollection?.items?.[0]?.url;

    // Format subtitle with creator and release date (date + month + year, no time).
    // When the date is only an estimate, show "Unknown" instead of a specific date
    // rather than implying more precision than we actually have.
    let subtitle = validatedExhibit.creator || "";
    if (validatedExhibit.isDateEstimated) {
      subtitle = subtitle ? `${subtitle} • Unknown` : "Unknown";
    } else if (validatedExhibit.releaseDate) {
      try {
        const date = new Date(validatedExhibit.releaseDate);
        // Format as "Month Day, Year" (e.g., "January 15, 2024")
        const formattedDate = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        subtitle = subtitle ? `${subtitle} • ${formattedDate}` : formattedDate;
      } catch (e) {
        // If date parsing fails, just use the creator
        console.warn(
          `gridFromExhibits: Failed to parse releaseDate for exhibit ${index}:`,
          validatedExhibit.releaseDate
        );
      }
    }

    // Build exhibit URL with current locale (e.g. /en/exhibit/my-slug)
    const locale = (globalThis as any).Astro?.locals?.locale as
      | string
      | undefined;
    const exhibitSlug = validatedExhibit.slug ?? validatedExhibit.sys?.id ?? "";
    const url = exhibitSlug
      ? prependBase(`/exhibit/${exhibitSlug}`, locale || "en-US")
      : "";

    const gridItem = {
      image: imageUrl || undefined,
      title: validatedExhibit.title || validatedExhibit.name,
      url,
      subtitle: subtitle || undefined,
      target: "_self" as const,
    };

    // Validate UI output - parse returns the correct type
    return GridItemSchema.parse(gridItem);
  });

  return { items: output };
}

export async function gridFromEvents(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // Build date string in ISO 8601 format with timezone for filtering
  const now = new Date();
  const tzOffset = -now.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(
    tzMinutes
  ).padStart(2, "0")}`;

  // Format date as ISO 8601 with timezone
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  const dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${tzString}`;

  // Look for a "keyword" key/value pair so editors can restrict results to
  // events tagged with a matching Contentful tag (e.g. keyword="featured"
  // only shows events tagged "featured"), following the same keys/values
  // convention used by other adapters (see e.g. the "program" key in
  // categorizedGridFromUpcomingEvents).
  const keywordIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "keyword") ?? -1;
  const keyword =
    keywordIndex >= 0 ? values?.[keywordIndex]?.trim() : undefined;

  let tagWhereClause = "";
  if (keyword) {
    const escapedKeyword = keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    tagWhereClause = `, contentfulMetadata: { tags: { id_contains_some: ["${escapedKeyword}"] } }`;
  }

  // Query events starting from current date going into the future
  // Sort ascending to get the 7 closest upcoming events
  const query = queryEvents({
    where: `startDate_gte: "${dateString}"${tagWhereClause}`,
    limit: 7,
    order: "startDate_ASC",
  });
  const data = await getByQuery(query);

  // Check if eventCollection exists
  if (!data || !data.eventCollection) {
    console.error("gridFromEvents: No eventCollection in response", data);
    return { items: [] };
  }

  // Validate Contentful response
  const collection = validateContentfulData(
    data.eventCollection,
    EventCollectionSchema,
    "gridFromEvents: eventCollection"
  );

  const locale = (globalThis as any).Astro?.locals?.locale as
    | string
    | undefined;

  // Transform and validate each item
  const output = collection.items.map((event, index) => {
    // Validate Contentful item (with program.title extension)
    const validatedEvent = validateContentfulData(
      event as Event & { program?: { title?: string } },
      EventSchema,
      `gridFromEvents: event[${index}]`
    );

    // Transform to UI format
    const cta = validatedEvent.callToAction;
    const gridItem = {
      image: validatedEvent.imageCollection?.items?.[0]?.url ?? undefined,
      title: validatedEvent.title,
      url: prependBase(`/event/${validatedEvent.slug}`, locale || "en-US"),
      subtitle:
        new Date(validatedEvent.startDate).toLocaleDateString("en-US", {
          timeZone: EVENT_TIME_ZONE,
        }) +
        " | " +
        ((validatedEvent.program as any)?.title || "").toUpperCase(),
      target: "_self" as const,
      callToAction:
        cta?.title && cta?.url ? { title: cta.title, url: cta.url } : undefined,
    };

    // Validate UI output - parse applies defaults and returns correct type
    return GridItemSchema.parse(gridItem);
  });

  // Add "More..." link to calendar
  const moreItem = GridItemSchema.parse({
    title: "More...",
    url: prependBase("/calendar", locale || "en-US"),
    target: "_self" as const,
  });

  return { items: [...output, moreItem] };
}

/**
 * Upcoming events grouped by program for use with CategorizedCatalog.
 * Queries events with startDate >= now, groups by program, returns categories of grid items.
 *
 * Optionally filters to a single program: set a `keys`/`values` pair with
 * key "program" (case-insensitive) and a value equal to that Program's Name
 * field. The matching Program is resolved to its entry ID and only its
 * events are returned. If no program matches the given name, no events are
 * returned (rather than silently falling back to all upcoming events).
 */
export async function categorizedGridFromUpcomingEvents(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<CategorizedGridWidgetData> {
  const now = new Date();
  const tzOffset = -now.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(
    tzMinutes
  ).padStart(2, "0")}`;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  const dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${tzString}`;

  // Look for a "program" key/value pair and resolve it to a Program entry by name
  // (see resolveProgramIdByName).
  const programKeyIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "program") ?? -1;
  const programName =
    programKeyIndex >= 0 ? values?.[programKeyIndex]?.trim() : undefined;

  let programWhereClause = "";
  if (programName) {
    const programId = await resolveProgramIdByName(programName);
    if (!programId) {
      console.warn(
        `[categorizedGridFromUpcomingEvents] No program found with name "${programName}"`
      );
      return { categories: [] };
    }
    programWhereClause = `, program: { sys: { id: "${programId}" } }`;
  }

  const query = queryEvents({
    where: `startDate_gte: "${dateString}"${programWhereClause}`,
    limit: 100,
    order: "startDate_ASC",
  });
  const data = await getByQuery(query);

  if (!data?.eventCollection) {
    return { categories: [] };
  }

  const collection = validateContentfulData(
    data.eventCollection,
    EventCollectionSchema,
    "categorizedGridFromUpcomingEvents: eventCollection"
  );

  const locale = (globalThis as any).Astro?.locals?.locale as
    | string
    | undefined;

  type EventWithProgram = Event & {
    program?: { sys?: { id?: string }; title?: string; url?: string };
    callToAction?: { sys?: { id?: string }; title?: string; url?: string };
  };
  const byProgramId = new Map<
    string,
    {
      name: string;
      description?: string;
      url?: string;
      events: EventWithProgram[];
    }
  >();

  for (const raw of collection.items) {
    const event = validateContentfulData(
      raw as EventWithProgram,
      EventSchema,
      "categorizedGridFromUpcomingEvents: event"
    ) as EventWithProgram;
    const programId = event.program?.sys?.id ?? "";
    const programTitle = (event.program?.title ?? "").trim() || "Other";
    const programUrl = (event.program as { url?: string })?.url;
    if (!byProgramId.has(programId)) {
      byProgramId.set(programId, {
        name: programTitle,
        description: undefined,
        url: programUrl,
        events: [],
      });
    }
    const group = byProgramId.get(programId)!;
    if (programUrl && !group.url) group.url = programUrl;
    group.events.push(event);
  }

  const sortedGroups = [...byProgramId.entries()].sort(([, a], [, b]) => {
    const aName = (a.name ?? "").trim().toLowerCase();
    const bName = (b.name ?? "").trim().toLowerCase();
    if (aName === "other") return 1;
    if (bName === "other") return -1;
    const aDate = a.events[0]?.startDate ?? "";
    const bDate = b.events[0]?.startDate ?? "";
    return aDate.localeCompare(bDate);
  });

  const categories: GridCategory[] = [];
  for (const [, group] of sortedGroups) {
    const items = group.events.map((ev) => {
      const validatedEvent = ev as EventWithProgram;
      const cta = validatedEvent.callToAction;
      const gridItem = {
        image: validatedEvent.imageCollection?.items?.[0]?.url ?? undefined,
        title: validatedEvent.title,
        url: prependBase(`/event/${validatedEvent.slug}`, locale || "en-US"),
        subtitle: new Date(validatedEvent.startDate).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: EVENT_TIME_ZONE,
          }
        ),
        target: "_self" as const,
        callToAction:
          cta?.title && cta?.url
            ? { title: cta.title, url: cta.url }
            : undefined,
      };
      return GridItemSchema.parse(gridItem);
    });
    const categoryUrl = group.url
      ? prependBase(group.url, locale || "en-US")
      : undefined;
    categories.push(
      GridCategorySchema.parse({
        name: group.name,
        description: group.description,
        url: categoryUrl,
        items,
      })
    );
  }

  return { categories };
}

export async function calendarFromEvents(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<CalendarWidgetData> {
  // Add limit to reduce query complexity (Contentful max is 11000)
  // Reduced to 50 to account for nested collections (imageCollection, program)
  const query = queryEvents({ limit: 50 });
  const data = await getByQuery(query);

  // Check if eventCollection exists
  if (!data || !data.eventCollection) {
    console.error("calendarFromEvents: No eventCollection in response", data);
    return { items: [] };
  }

  // Validate Contentful response
  const collection = validateContentfulData(
    data.eventCollection,
    EventCollectionSchema,
    "calendarFromEvents: eventCollection"
  );

  const locale = (globalThis as any).Astro?.locals?.locale as
    | string
    | undefined;

  // Transform and validate each item
  const output = collection.items.map((event, index) => {
    // Validate Contentful item
    const validatedEvent = validateContentfulData(
      event,
      EventSchema,
      `calendarFromEvents: event[${index}]`
    );

    // Transform to UI format
    const calendarEvent = {
      date: new Date(validatedEvent.startDate || validatedEvent.endDate || ""),
      title: validatedEvent.title || validatedEvent.name,
      description:
        validatedEvent.description ||
        (validatedEvent.content?.json?.content?.[0]?.value as string) ||
        "",
      url: validatedEvent.slug
        ? prependBase(`/events/${validatedEvent.slug}`, locale || "en-US")
        : "/foo",
      image: validatedEvent.imageCollection?.items?.[0]?.url,
    };

    // Validate UI output
    return CalendarEventSchema.parse(calendarEvent);
  });

  return { items: output };
}

export async function gridFromPrograms(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // Add limit to reduce query complexity (Contentful max is 11000)
  const query = queryPrograms({
    where: "url_exists: true",
    limit: 100,
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.programCollection,
    ProgramCollectionSchema,
    "gridFromPrograms: programCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((program, index) => {
    // Validate Contentful item
    const validatedProgram = validateContentfulData(
      program,
      ProgramSchema,
      `gridFromPrograms: program[${index}]`
    );

    // Transform to UI format
    // If single day: show full weekday name (e.g., "Monday")
    // If multiple days: use shortened abbreviations (M, T, W, TH, F, S, SA)
    // Tuesday = "T", Thursday = "TH" to differentiate
    // Saturday = "S", Sunday = "SA" to differentiate
    // Add "Repeating" prefix if recurring weekdays exist
    const recurringWeekdays = validatedProgram.recurringWeekday || [];

    let subtitle: string;
    if (recurringWeekdays.length > 0) {
      if (recurringWeekdays.length === 1) {
        // Single day: use full weekday name
        subtitle = `Every ${recurringWeekdays[0]}`;
      } else {
        // Multiple days: use abbreviations
        const weekdayAbbrev: Record<string, string> = {
          Monday: "M",
          Tuesday: "T",
          Wednesday: "W",
          Thursday: "TH",
          Friday: "F",
          Saturday: "S",
          Sunday: "SA",
        };

        // Convert to abbreviations and join with commas
        const abbrevs = recurringWeekdays
          .map((day) => weekdayAbbrev[day] || day.substring(0, 2).toUpperCase())
          .join(", ");

        subtitle = `Every ${abbrevs}`;
      }
    } else {
      subtitle = "";
    }

    const locale = (globalThis as any).Astro?.locals?.locale as
      | string
      | undefined;
    const gridItem = {
      image: validatedProgram.imageCollection?.items?.[0]?.url,
      title: validatedProgram.title,
      url: prependBase(validatedProgram.url ?? "/", locale || "en-US"),
      subtitle: subtitle,
      target: "_self" as const,
    };

    // Validate UI output
    return GridItemSchema.parse(gridItem);
  });

  return { items: output };
}

export async function gridFromMembers(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // "show" is a display-only option (e.g. show=Role, see showRole below), not a data
  // filter - find the first key/value pair that isn't "show" to use as the GraphQL
  // where-clause filter (e.g. category=Staff), the same generic single-field-filter
  // convention this adapter has always used.
  const filterIndex = keys.findIndex(
    (key, i) => key?.toLowerCase() !== "show" && values[i]
  );
  const whereClause =
    filterIndex >= 0 ? `${keys[filterIndex]}: "${values[filterIndex]}"` : undefined;

  // Look for a "show" key/value pair so editors can opt into showing a member's role
  // in this view (e.g. show=Role), following the same keys/values convention used by
  // other adapters (see e.g. the "keyword" key in gridFromEvents).
  const showIndex = keys.findIndex((key) => key?.toLowerCase() === "show");
  const showRole = showIndex >= 0 && values[showIndex]?.toLowerCase() === "role";

  // A hardcoded `limit: 100` here previously silently truncated the grid to the first
  // 100 members - with 700+ Members now (e.g. imported Kickstarter backers/donors),
  // most were never shown. Member has no nested/linked fields (see MemberFields), so
  // unlike gridFromEvents it's cheap enough to safely page through with a large batch
  // size while staying well under Contentful's per-query complexity budget.
  const MEMBERS_PAGE_SIZE = 500;
  const allMembers: z.infer<typeof MemberSchema>[] = [];
  let skip = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = queryMembers({
      ...(whereClause ? { where: whereClause } : {}),
      limit: MEMBERS_PAGE_SIZE,
      skip,
    });
    const data = await getByQuery(query);

    // Validate Contentful response
    const collection = validateContentfulData(
      data.memberCollection,
      MemberCollectionSchema,
      "gridFromMembers: memberCollection"
    );
    allMembers.push(...collection.items);

    if (collection.items.length < MEMBERS_PAGE_SIZE) break;
    skip += MEMBERS_PAGE_SIZE;
  }

  // Order by displayPriority ascending (lower shows first). Members without an explicit
  // displayPriority are moved to the back, in whatever order Contentful returned them
  // (Array.prototype.sort is stable, so ties - including "neither has one" - preserve
  // their relative order rather than being reshuffled).
  allMembers.sort((a, b) => {
    const aHasPriority = typeof a.displayPriority === "number";
    const bHasPriority = typeof b.displayPriority === "number";
    if (aHasPriority && bHasPriority) {
      return a.displayPriority! - b.displayPriority!;
    }
    if (aHasPriority) return -1;
    if (bHasPriority) return 1;
    return 0;
  });

  // Transform and validate each item
  const output = allMembers.map((member, index) => {
    // Validate Contentful item
    const validatedMember = validateContentfulData(
      member,
      MemberSchema,
      `gridFromMembers: member[${index}]`
    );

    // Transform to UI format
    const gridItem = {
      image: "/foo.png",
      title: validatedMember.lastName
        ? `${validatedMember.firstName} ${validatedMember.lastName}`
        : validatedMember.firstName,
      url: "/foo",
      subtitle: showRole ? validatedMember.role ?? undefined : undefined,
    };

    // Validate UI output
    return GridItemSchema.parse(gridItem);
  });

  return { items: output };
}

export async function doubleColumnFromPosts(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<DoubleColumnWidgetData> {
  // Add limit to reduce query complexity even when filtering by IDs
  // Contentful complexity is calculated per item, so many IDs = high complexity
  const query = queryPosts({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50, // Limit even when filtering by IDs to reduce complexity
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.postCollection,
    PostCollectionSchema,
    "doubleColumnFromPosts: postCollection"
  );

  // id_in does not preserve Contentful reference order; match targetIDs sequence
  const postsById = new Map(
    collection.items.map((post) => [post.sys.id, post] as const)
  );
  const orderedPosts = targetIDs
    .map((id) => postsById.get(id))
    .filter((post): post is (typeof collection.items)[number] => post != null);

  // Transform and validate each item
  const output = orderedPosts.map((post, index) => {
    try {
      // Validate Contentful item
      const validatedPost = validateContentfulData(
        post,
        PostSchema,
        `doubleColumnFromPosts: post[${index}]`
      );

      // Transform to UI format
      // Handle null/undefined content
      const htmlContent = validatedPost.content?.json
        ? renderContentfulRichTextWithEmbeddedAssets(validatedPost.content)
        : "";
      // Ensure content is not empty (required by schema)
      const content =
        htmlContent && htmlContent.trim().length > 0
          ? htmlContent
          : "<p>No content available</p>";
      // Extract image URL from imageCollection
      const imageUrl = validatedPost.imageCollection?.items?.[0]?.url;
      const doubleColumnItem = {
        title: validatedPost.title,
        content: content,
        image: imageUrl || undefined, // Use post image if available
        callToAction: validatedPost.callToAction
          ? {
              title: (validatedPost.callToAction as any).title || "",
              url: (validatedPost.callToAction as any).url || "",
            }
          : undefined,
      };

      // Validate UI output
      return DoubleColumnItemSchema.parse(doubleColumnItem);
    } catch (error) {
      console.error(
        `doubleColumnFromPosts: Error processing post at index ${index}:`,
        error
      );
      console.error(`doubleColumnFromPosts: Post data:`, {
        id: post?.sys?.id,
        title: post?.title,
        hasContent: !!post?.content,
        hasImageCollection: !!post?.imageCollection,
      });
      throw error; // Re-throw to fail fast and see the error
    }
  });

  console.log(
    `doubleColumnFromPosts: Successfully processed ${output.length} items`
  );
  return { items: output };
}

export async function doubleColumnFromPrograms(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<DoubleColumnWidgetData> {
  // Add limit to reduce query complexity even when filtering by IDs
  const query = queryPrograms({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50, // Limit even when filtering by IDs to reduce complexity
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.programCollection,
    ProgramCollectionSchema,
    "doubleColumnFromPrograms: programCollection"
  );

  const programsById = new Map(
    collection.items.map((p) => [p.sys.id, p] as const)
  );
  const orderedPrograms = targetIDs
    .map((id) => programsById.get(id))
    .filter(
      (program): program is (typeof collection.items)[number] => program != null
    );

  // Transform and validate each item
  const output = orderedPrograms.map((program, index) => {
    // Validate Contentful item
    const validatedProgram = validateContentfulData(
      program,
      ProgramSchema,
      `doubleColumnFromPrograms: program[${index}]`
    );

    // Transform to UI format
    // Ensure description is not empty (required by schema)
    const description =
      validatedProgram.description || "No description available";
    // breaks: true converts single newlines in the markdown source into <br/>
    // tags, so manually entered line breaks are preserved instead of being
    // collapsed into the same line by the browser.
    const parsedContent = marked.parse(description, { breaks: true });
    // Ensure parsed content is not empty (marked.parse returns string)
    const contentStr =
      typeof parsedContent === "string" ? parsedContent : String(parsedContent);
    const content =
      contentStr && contentStr.trim().length > 0
        ? contentStr
        : "<p>No description available</p>";

    // Extract image URL from imageCollection
    const imageUrl = validatedProgram.imageCollection?.items?.[0]?.url;

    const doubleColumnItem = {
      title: validatedProgram.title,
      content: content,
      image: imageUrl || undefined, // Include image if available
    };

    // Validate UI output
    return DoubleColumnItemSchema.parse(doubleColumnItem);
  });

  return { items: output };
}

export async function gridFromPosts(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // Add limit to reduce query complexity even when filtering by IDs
  // Contentful complexity is calculated per item, so many IDs = high complexity
  const query = queryPosts({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50, // Limit even when filtering by IDs to reduce complexity
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.postCollection,
    PostCollectionSchema,
    "gridFromPosts: postCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((post, index) => {
    // Validate Contentful item
    const validatedPost = validateContentfulData(
      post,
      PostSchema,
      `gridFromPosts: post[${index}]`
    );

    // Transform to UI format
    // Handle null/undefined content
    const htmlContent = validatedPost.content?.json
      ? documentToHtmlString(validatedPost.content.json)
      : "<p>No content available</p>";
    const cta = validatedPost.callToAction;
    const gridItem = {
      image: validatedPost.imageCollection?.items?.[0]?.url,
      title: validatedPost.title,
      url: cta ? (cta as any).url : undefined,
      content: htmlContent,
      callToAction:
        cta && (cta as any).title && (cta as any).url
          ? { title: (cta as any).title, url: (cta as any).url }
          : undefined,
    };

    // Validate UI output
    return GridItemSchema.parse(gridItem);
  });

  return { items: output };
}

export async function verticalTimelineFromPress(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<VerticalTimelineWidgetData> {
  // Sort field/direction can be overridden per ContentView via the "orderBy" /
  // "orderDirection" keys/values (e.g. orderBy="date", orderDirection="desc").
  const order = resolveOrderClause(keys, values, ["date"], "date", "ASC");

  // Add limit to reduce query complexity (Contentful max is 11000)
  const query = queryPress({ limit: 100, order });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.pressCollection,
    PressCollectionSchema,
    "verticalTimelineFromPress: pressCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((press, index) => {
    // Validate Contentful item
    const validatedPress = validateContentfulData(
      press,
      PressSchema,
      `verticalTimelineFromPress: press[${index}]`
    );

    // Transform to UI format
    // Convert content from Contentful rich text JSON to HTML
    const htmlContent = validatedPress.content?.json
      ? documentToHtmlString(validatedPress.content.json)
      : undefined;

    const timelineItem = {
      date: new Date(validatedPress.date || ""),
      title: validatedPress.title || validatedPress.name,
      description: validatedPress.description || "",
      content: htmlContent,
      url: validatedPress.url || undefined, // Include URL if available
      // image is optional, omit if not a valid URL
    };

    // Validate UI output
    return TimelineItemSchema.parse(timelineItem);
  });

  return { items: output };
}

export async function verticalTimelineFromHistory(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<VerticalTimelineWidgetData> {
  // Sort field/direction can be overridden per ContentView via the "orderBy" /
  // "orderDirection" keys/values (e.g. orderBy="date", orderDirection="desc").
  const order = resolveOrderClause(keys, values, ["date"], "date", "ASC");

  // Add limit to reduce query complexity (Contentful max is 11000)
  const query = queryPosts({
    where:
      'contentfulMetadata: { tags: { id_contains_some: ["topicHistory"] } }',
    limit: 100,
    order,
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.postCollection,
    PostCollectionSchema,
    "verticalTimelineFromHistory: postCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((post, index) => {
    // Validate Contentful item
    const validatedPost = validateContentfulData(
      post,
      PostSchema,
      `verticalTimelineFromHistory: post[${index}]`
    );

    // Transform to UI format
    // Convert content from Contentful rich text JSON to HTML
    const htmlContent = validatedPost.content?.json
      ? documentToHtmlString(validatedPost.content.json)
      : undefined;

    // Extract image URL from imageCollection
    const imageUrl = validatedPost.imageCollection?.items?.[0]?.url;

    // Extract URL from callToAction if available
    const url = validatedPost.callToAction?.url || undefined;

    const timelineItem = {
      date: new Date(validatedPost.date || ""),
      title: validatedPost.title,
      description: validatedPost.description || "",
      content: htmlContent,
      image: imageUrl || undefined, // Include image if available
      url: url, // Include URL from callToAction if available
    };

    // Validate UI output
    return TimelineItemSchema.parse(timelineItem);
  });

  return { items: output };
}

export async function impactReportFromImpactReport(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<ReportWidgetData> {
  const impactQuery = queryImpactReport(targetIDs[0]);
  const data = await getByQuery(impactQuery);

  // Handle null description (GraphQL can return null for optional fields)
  if (data.impactReport && data.impactReport.description === null) {
    data.impactReport.description = undefined;
  }

  // Validate Contentful response
  const validatedImpactReport = validateContentfulData(
    data.impactReport,
    ImpactReportSchema,
    "impactReportFromImpactReport: impactReport"
  );

  const programs = validatedImpactReport.programCollection?.items || [];
  const programIDs = programs.map((program: { sys: { id: string } }) => {
    return program.sys.id;
  });

  const metricQuery = queryMetrics({
    where: `program: { sys: { id_in: ${JSON.stringify(programIDs)} } }`,
  });
  const metricData = await getByQuery(metricQuery);

  const metricCategories = metricData.metricCollection.items.map(
    (metric: {
      name: string;
      title: string;
      description: string;
      countType?: string;
      inverted?: boolean;
      sys: { id: string };
    }) => {
      return {
        name: metric.name,
        title: metric.title,
        description: metric.description,
        countType: metric.countType,
        inverted: metric.inverted,
        id: metric.sys.id,
      };
    }
  );

  const metricPeriods = metricData.metricCollection.items.map(
    (metric: { name: string; sys: { id: string } }) => {
      return metric.sys.id;
    }
  );

  const metricPeriodQuery = queryMetricPeriods({
    where: `metric: { sys: { id_in: ${JSON.stringify(metricPeriods)} } }`,
  });
  const metricPeriodData = await getByQuery(metricPeriodQuery);
  // Create a map to track countType for each program/category
  // Priority: Program countType > Metric countType (first encountered)
  const categoryCountTypes = new Map<string, "Count" | "Percent">();

  // First, check if countType is on Program directly
  for (const program of programs) {
    const programCountType = (program as any).countType;
    if (programCountType) {
      const normalized =
        typeof programCountType === "string"
          ? programCountType.trim()
          : String(programCountType).trim();
      if (
        normalized.toLowerCase() === "percent" ||
        normalized.toLowerCase() === "count"
      ) {
        const countTypeValue = (normalized.charAt(0).toUpperCase() +
          normalized.slice(1).toLowerCase()) as "Count" | "Percent";
        categoryCountTypes.set(program.sys.id, countTypeValue);
      }
    }
  }

  // Fallback: collect countType from metrics for each program (if not already set)
  for (const metric of metricData.metricCollection.items) {
    const programId = metric.program?.sys?.id;
    if (!programId || categoryCountTypes.has(programId)) {
      continue; // Skip if already set from Program
    }
    const metricCountType = metric.countType;
    if (metricCountType) {
      // Normalize countType (handle case variations)
      const normalized =
        typeof metricCountType === "string"
          ? metricCountType.trim()
          : String(metricCountType).trim();
      if (
        normalized.toLowerCase() === "percent" ||
        normalized.toLowerCase() === "count"
      ) {
        const countTypeValue = (normalized.charAt(0).toUpperCase() +
          normalized.slice(1).toLowerCase()) as "Count" | "Percent";
        // Use the first countType we encounter for each program
        if (!categoryCountTypes.has(programId)) {
          categoryCountTypes.set(programId, countTypeValue);
        }
      }
    }
  }

  let categories: ReportCategory[] = programs.map(
    (program: { title: string; sys: { id: string } }) => {
      return {
        name: program.title,
        description: "",
        id: program.sys.id,
        items: [],
      };
    }
  );

  let areas = metricData.metricCollection.items.map(
    (metric: {
      name: string;
      title: string;
      description: string;
      sys: { id: string };
    }) => {
      return {
        title: metric.title,
        description: metric.description,
        id: metric.sys.id,
        items: [],
      };
    }
  );

  for (const item of metricPeriodData.metricPeriodCollection.items) {
    let metricCategory = metricCategories.find(
      (c: { name: string; title: string; id: string }) =>
        c.id === item.metric.sys.id
    );

    let area: ReportArea =
      categories
        .find((c) => c.id === item.metric.sys.id)
        ?.items.find((a: ReportArea) => a.id === item.metric.sys.id) ??
      ReportAreaSchema.parse({
        title: metricCategory?.title ?? item.title,
        description: item.description || "",
        id: item.metric.sys.id,
        countType: metricCategory?.countType,
        inverted: metricCategory?.inverted,
        items: [],
      });

    // Parse item.data - it may be a JSON string from Contentful
    // GraphQL returns JSON fields as objects, but we need to ensure it's the right shape
    let parsedData: any;
    if (typeof item.data === "string") {
      try {
        parsedData = JSON.parse(item.data);
      } catch (e) {
        console.error(`Failed to parse item.data as JSON:`, item.data, e);
        throw new Error(`Invalid JSON in metricPeriod data: ${item.data}`);
      }
    } else if (item.data && typeof item.data === "object") {
      // Already an object from GraphQL
      parsedData = item.data;
    } else {
      console.error(`Unexpected item.data type:`, typeof item.data, item.data);
      throw new Error(
        `Invalid data type in metricPeriod: expected object or JSON string, got ${typeof item.data}`
      );
    }

    // Validate the parsed data against GraphDataSchema
    // This ensures the data has the correct structure: { categories: string[], series: { name: string, data: number[] }[] }
    let data;
    try {
      data = GraphDataSchema.parse(parsedData);
    } catch (error: any) {
      console.error(`GraphDataSchema validation failed for item:`, {
        title: item.title,
        data: parsedData,
        error: error.message,
        errors: error.errors,
      });
      throw new Error(
        `Invalid graph data structure for "${item.title}": ${error.message}`
      );
    }
    const reportItem = ReportItemSchema.parse({
      title: item.title,
      data: data,
      type: item.graphType === "Trend" ? "trend" : "bar",
    });

    area.items.push(reportItem);

    categories
      .find((c) => c.id === item.metric.program.sys.id)
      ?.items.push(area);
  }

  // Create a custom renderer for embedded assets in goal
  const goalAssetMap = new Map();
  if (validatedImpactReport.goal?.links?.assets?.block) {
    for (const asset of validatedImpactReport.goal.links.assets.block) {
      if (asset?.sys?.id && asset?.url) {
        goalAssetMap.set(asset.sys.id, asset);
      }
    }
  }

  const goalHtml = validatedImpactReport.goal?.json
    ? documentToHtmlString(validatedImpactReport.goal.json, {
        renderNode: {
          [BLOCKS.EMBEDDED_ASSET]: (node: any) => {
            const assetId = node.data.target.sys.id;
            const asset = goalAssetMap.get(assetId);
            if (asset && asset.url) {
              const alt = asset.title || asset.description || "";
              return `<img src="${asset.url}" alt="${alt}" ${
                asset.width ? `width="${asset.width}"` : ""
              } ${asset.height ? `height="${asset.height}"` : ""} />`;
            }
            return "";
          },
        },
      })
    : "";

  const report: Report = ReportSchema.parse({
    name: validatedImpactReport.name,
    title: validatedImpactReport.title,
    date: validatedImpactReport.date,
    period: validatedImpactReport.period,
    goal: goalHtml,
    description: validatedImpactReport.description
      ? documentToHtmlString(validatedImpactReport.description.json)
      : undefined,
    categories: categories,
  });

  return { report: report };
}

export async function singleColumnFromPosts(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<SingleColumnWidgetData> {
  // Add limit to reduce query complexity (Contentful max is 11000)
  const query = queryPosts({
    where: 'contentfulMetadata: { tags: { id_contains_some: ["blog"] } }',
    limit: 100,
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.postCollection,
    PostCollectionSchema,
    "singleColumnFromPosts: postCollection"
  );

  // Transform and validate each item
  const output = collection.items.map((post, index) => {
    // Validate Contentful item
    const validatedPost = validateContentfulData(
      post,
      PostSchema,
      `singleColumnFromPosts: post[${index}]`
    );

    // Transform to UI format
    // Handle null/undefined content
    const htmlContent = validatedPost.content?.json
      ? renderContentfulRichTextWithEmbeddedAssets(validatedPost.content)
      : "";
    // Ensure content is not empty (required by schema)
    const content =
      htmlContent && htmlContent.trim().length > 0
        ? htmlContent
        : "<p>No content available</p>";
    const doubleColumnItem = {
      title: validatedPost.title,
      content: content,
      callToAction: {
        title: "Read More",
        url: "/en/blog",
      },
    };

    // Validate UI output
    return DoubleColumnItemSchema.parse(doubleColumnItem);
  });

  return { items: output };
}

export async function singleColumnFromUpcomingEvents(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<SingleColumnWidgetData> {
  // Filter events by program ID if provided in targetIDs
  // targetIDs[0] should be the program ID to filter by
  const programId = targetIDs[0];

  // Debug logging
  console.log("[singleColumnFromUpcomingEvents] Starting query:", {
    programId,
    targetIDs,
    keys,
    values,
  });

  // Validate programID first
  if (!programId) {
    console.warn(
      "[singleColumnFromUpcomingEvents] No programId provided in targetIDs"
    );
    // If no programId, return the "no events" message
    const noEventsItem = {
      title: undefined,
      content:
        '<p class="text-center text-gray-500">No upcoming events to display</p>',
    };
    return { items: [DoubleColumnItemSchema.parse(noEventsItem)] };
  }

  // Build date string in ISO 8601 format with timezone: "2022-09-05T00:00:00.000+02:00"
  const now = new Date();
  // Get timezone offset in hours and minutes
  const tzOffset = -now.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(
    tzMinutes
  ).padStart(2, "0")}`;

  // Format date as ISO 8601 with timezone: "2022-09-05T00:00:00.000+02:00"
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  const dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${tzString}`;

  // Build where clause with both program and date filters using GraphQL
  const whereClause = `startDate_gte: "${dateString}", program: { sys: { id: "${programId}" } }`;

  console.log("[singleColumnFromUpcomingEvents] Date filter:", {
    now: now.toISOString(),
    dateString,
    tzString,
    whereClause,
  });

  // Query upcoming events by program and date using GraphQL filter
  const query = queryEvents({
    where: whereClause,
    order: "startDate_ASC",
    limit: 10, // Limit to 10 upcoming events
  });

  console.log("[singleColumnFromUpcomingEvents] Query:", query);

  const data = await getByQuery(query);

  // Debug logging
  console.log("[singleColumnFromUpcomingEvents] Query result:", {
    hasEventCollection: !!data.eventCollection,
    itemsCount: data.eventCollection?.items?.length || 0,
    programId,
    whereClause,
  });

  // Validate Contentful response
  const collection = validateContentfulData(
    data.eventCollection,
    EventCollectionSchema,
    "singleColumnFromUpcomingEvents: eventCollection"
  );

  console.log("[singleColumnFromUpcomingEvents] Validated collection:", {
    itemsCount: collection.items.length,
    events: collection.items.map((event) => ({
      title: event.title,
      startDate: event.startDate,
      programId: event.program?.sys?.id,
    })),
  });

  // If no events found, return a single item with a message
  if (collection.items.length === 0) {
    const noEventsItem = {
      title: undefined,
      content:
        '<p class="text-center text-gray-500">No upcoming events to display</p>',
    };

    console.log(
      "[singleColumnFromUpcomingEvents] No events found, returning placeholder message"
    );
    return { items: [DoubleColumnItemSchema.parse(noEventsItem)] };
  }

  // Transform and validate each item
  const output = collection.items.map((event, index) => {
    // Validate Contentful item
    const validatedEvent = validateContentfulData(
      event as Event & { program?: { title?: string } },
      EventSchema,
      `singleColumnFromUpcomingEvents: event[${index}]`
    );

    // Format date/time information for parents
    const startDate = new Date(validatedEvent.startDate);
    const endDate = validatedEvent.endDate
      ? new Date(validatedEvent.endDate)
      : null;

    // Format date: "Monday, January 15, 2024"
    const formattedDate = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: EVENT_TIME_ZONE,
    });

    // Format time: "3:00 PM - 5:00 PM" or "3:00 PM" if no end time
    const formattedStartTime = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: EVENT_TIME_ZONE,
    });

    let timeInfo = formattedStartTime;
    if (endDate) {
      const formattedEndTime = endDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: EVENT_TIME_ZONE,
        hour12: true,
      });
      timeInfo = `${formattedStartTime} - ${formattedEndTime}`;
    }

    // Build content with event details
    // Date/time will be shown as subtitle, description as main content
    let contentParts: string[] = [];

    // Date and time as subtitle (prominent but not the main content)
    contentParts.push(
      `<h3 class="text-xl font-semibold mb-4">${formattedDate} at ${timeInfo}</h3>`
    );

    // Description as main content
    if (validatedEvent.description) {
      contentParts.push(
        `<div class="prose prose-lg dark:prose-invert max-w-none">${validatedEvent.description}</div>`
      );
    } else if (validatedEvent.content?.json) {
      // Fallback to rich text content if description is not available
      const htmlContent = documentToHtmlString(validatedEvent.content.json);
      if (htmlContent && htmlContent.trim().length > 0) {
        contentParts.push(
          `<div class="prose prose-lg dark:prose-invert max-w-none">${htmlContent}</div>`
        );
      }
    }

    // Ensure content is not empty (required by schema)
    const content =
      contentParts.length > 0
        ? contentParts.join("")
        : "<p>Event details coming soon.</p>";

    // Extract image URL from imageCollection
    const imageUrl = validatedEvent.imageCollection?.items?.[0]?.url;
    const locale = (globalThis as any).Astro?.locals?.locale as
      | string
      | undefined;
    const singleColumnItem = {
      title: validatedEvent.title, // Event title as the main bold title
      content: content, // Date/time as subtitle, description as content
      image: imageUrl || undefined, // Include image if available
      callToAction: {
        title: "View Event Details",
        url: prependBase(`/events/${validatedEvent.slug}`, locale || "en-US"),
      },
    };

    // Validate UI output
    return DoubleColumnItemSchema.parse(singleColumnItem);
  });

  console.log("[singleColumnFromUpcomingEvents] Final output:", {
    itemsCount: output.length,
    firstItem: output[0] || null,
  });

  return { items: output };
}

export async function miniSplashFromPosts(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<MiniSplashWidgetData> {
  // Add limit to reduce query complexity even when filtering by IDs
  // Contentful complexity is calculated per item, so many IDs = high complexity
  const query = queryPosts({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50, // Limit even when filtering by IDs to reduce complexity
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.postCollection,
    PostCollectionSchema,
    "miniSplashFromPosts: postCollection"
  );

  // Transform and validate each item
  const output = collection.items
    .map((post, index) => {
      try {
        // Validate Contentful item
        const validatedPost = validateContentfulData(
          post,
          PostSchema,
          `miniSplashFromPosts: post[${index}]`
        );

        // Transform to UI format
        // Handle null/undefined content
        const htmlContent = validatedPost.content?.json
          ? documentToHtmlString(validatedPost.content.json)
          : "";
        // Ensure content is not empty (required by schema)
        const content =
          htmlContent && htmlContent.trim().length > 0
            ? htmlContent
            : "<p>No content available</p>";
        // Extract image URL from imageCollection
        const imageUrl = validatedPost.imageCollection?.items?.[0]?.url;

        // MiniSplash requires an image, so skip items without images
        if (!imageUrl) {
          console.warn(
            `miniSplashFromPosts: Post "${validatedPost.title}" has no image, skipping`
          );
          return null;
        }

        const miniSplashItem = {
          title: validatedPost.title,
          content: content,
          image: imageUrl, // Required for MiniSplash
          callToAction: validatedPost.callToAction
            ? {
                title: (validatedPost.callToAction as any).title || "",
                url: (validatedPost.callToAction as any).url || "",
              }
            : undefined,
        };

        // Validate UI output
        return DoubleColumnItemSchema.parse(miniSplashItem);
      } catch (error) {
        console.error(
          `miniSplashFromPosts: Error processing post at index ${index}:`,
          error
        );
        console.error(`miniSplashFromPosts: Post data:`, {
          id: post?.sys?.id,
          title: post?.title,
          hasContent: !!post?.content,
          hasImageCollection: !!post?.imageCollection,
        });
        return null; // Return null instead of throwing to filter out invalid items
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null); // Filter out null items

  console.log(
    `miniSplashFromPosts: Successfully processed ${output.length} items`
  );
  return { items: output };
}

export async function imageMarqueeFromOrganizations(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<ImageMarqueeWidgetData> {
  const query = queryOrganizations({
    where: `sys: { id_in: ${JSON.stringify(targetIDs)} }`,
    limit: 50,
  });
  const data = await getByQuery(query);

  // Validate Contentful response
  const collection = validateContentfulData(
    data.organizationCollection,
    OrganizationCollectionSchema,
    "imageMarqueeFromOrganizations: organizationCollection"
  );

  // Transform and validate each item
  const output = collection.items
    .map((organization, index) => {
      try {
        // Validate Contentful item
        const validatedOrganization = validateContentfulData(
          organization,
          OrganizationSchema,
          `imageMarqueeFromOrganizations: organization[${index}]`
        );

        const imageUrl = validatedOrganization.logo?.url;

        // Image marquee requires a logo, so skip organizations without one
        if (!imageUrl) {
          console.warn(
            `imageMarqueeFromOrganizations: Organization "${
              validatedOrganization.title || validatedOrganization.name
            }" has no logo, skipping`
          );
          return null;
        }

        const imageMarqueeItem = {
          title: validatedOrganization.title || validatedOrganization.name,
          image: imageUrl,
          url: validatedOrganization.url || undefined,
        };

        // Validate UI output
        return ImageMarqueeItemSchema.parse(imageMarqueeItem);
      } catch (error) {
        console.error(
          `imageMarqueeFromOrganizations: Error processing organization at index ${index}:`,
          error
        );
        console.error(`imageMarqueeFromOrganizations: Organization data:`, {
          id: organization?.sys?.id,
          title: organization?.title,
          hasLogo: !!organization?.logo,
        });
        return null; // Return null instead of throwing to filter out invalid items
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null); // Filter out null items

  console.log(
    `imageMarqueeFromOrganizations: Successfully processed ${output.length} items`
  );
  return { items: output };
}

export async function miniSplashFromUpcomingEvents(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<MiniSplashWidgetData> {
  // Filter events by program ID if provided in targetIDs
  // targetIDs[0] should be the program ID to filter by
  const programId = targetIDs[0];

  // Debug logging
  console.log("[singleColumnFromUpcomingEvents] Starting query:", {
    programId,
    targetIDs,
    keys,
    values,
  });

  // Validate programID first
  if (!programId) {
    console.warn(
      "[singleColumnFromUpcomingEvents] No programId provided in targetIDs"
    );
    // If no programId, return the "no events" message
    const noEventsItem = {
      title: undefined,
      content:
        '<p class="text-center text-gray-500">No upcoming events to display</p>',
    };
    return { items: [DoubleColumnItemSchema.parse(noEventsItem)] };
  }

  // Build date string in ISO 8601 format with timezone: "2022-09-05T00:00:00.000+02:00"
  const now = new Date();
  // Get timezone offset in hours and minutes
  const tzOffset = -now.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(
    tzMinutes
  ).padStart(2, "0")}`;

  // Format date as ISO 8601 with timezone: "2022-09-05T00:00:00.000+02:00"
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  const dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${tzString}`;

  // Build where clause with both program and date filters using GraphQL
  const whereClause = `startDate_gte: "${dateString}", program: { sys: { id: "${programId}" } }`;

  console.log("[singleColumnFromUpcomingEvents] Date filter:", {
    now: now.toISOString(),
    dateString,
    tzString,
    whereClause,
  });

  // Query upcoming events by program and date using GraphQL filter
  const query = queryEvents({
    where: whereClause,
    order: "startDate_ASC",
    limit: 10, // Limit to 10 upcoming events
  });

  console.log("[singleColumnFromUpcomingEvents] Query:", query);

  const data = await getByQuery(query);

  // Debug logging
  console.log("[singleColumnFromUpcomingEvents] Query result:", {
    hasEventCollection: !!data.eventCollection,
    itemsCount: data.eventCollection?.items?.length || 0,
    programId,
    whereClause,
  });

  // Validate Contentful response
  const collection = validateContentfulData(
    data.eventCollection,
    EventCollectionSchema,
    "singleColumnFromUpcomingEvents: eventCollection"
  );

  console.log("[singleColumnFromUpcomingEvents] Validated collection:", {
    itemsCount: collection.items.length,
    events: collection.items.map((event) => ({
      title: event.title,
      startDate: event.startDate,
      programId: event.program?.sys?.id,
    })),
  });

  // If no events found, return a single item with a message
  if (collection.items.length === 0) {
    const noEventsItem = {
      title: undefined,
      content:
        '<p class="text-center text-gray-500">No upcoming events to display</p>',
    };

    console.log(
      "[singleColumnFromUpcomingEvents] No events found, returning placeholder message"
    );
    return { items: [DoubleColumnItemSchema.parse(noEventsItem)] };
  }

  // Transform and validate each item
  const output = collection.items.map((event, index) => {
    // Validate Contentful item
    const validatedEvent = validateContentfulData(
      event as Event & { program?: { title?: string } },
      EventSchema,
      `singleColumnFromUpcomingEvents: event[${index}]`
    );

    // Format date/time information for parents
    const startDate = new Date(validatedEvent.startDate);
    const endDate = validatedEvent.endDate
      ? new Date(validatedEvent.endDate)
      : null;

    // Format date: "Monday, January 15, 2024"
    const formattedDate = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: EVENT_TIME_ZONE,
    });

    // Format time: "3:00 PM - 5:00 PM" or "3:00 PM" if no end time
    const formattedStartTime = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: EVENT_TIME_ZONE,
    });

    let timeInfo = formattedStartTime;
    if (endDate) {
      const formattedEndTime = endDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: EVENT_TIME_ZONE,
        hour12: true,
      });
      timeInfo = `${formattedStartTime} - ${formattedEndTime}`;
    }

    // Build content with event details
    // Date/time will be shown as subtitle, description as main content
    let contentParts: string[] = [];

    // Date and time as subtitle (prominent but not the main content)
    contentParts.push(
      `<h3 class="text-xl font-semibold mb-4">${formattedDate} at ${timeInfo}</h3>`
    );

    // Description as main content
    if (validatedEvent.description) {
      contentParts.push(
        `<div class="prose prose-lg dark:prose-invert max-w-none">${validatedEvent.description}</div>`
      );
    } else if (validatedEvent.content?.json) {
      // Fallback to rich text content if description is not available
      const htmlContent = documentToHtmlString(validatedEvent.content.json);
      if (htmlContent && htmlContent.trim().length > 0) {
        contentParts.push(
          `<div class="prose prose-lg dark:prose-invert max-w-none">${htmlContent}</div>`
        );
      }
    }

    // Ensure content is not empty (required by schema)
    const content =
      contentParts.length > 0
        ? contentParts.join("")
        : "<p>Event details coming soon.</p>";

    // Extract image URL from imageCollection
    const imageUrl = validatedEvent.imageCollection?.items?.[0]?.url;
    const locale = (globalThis as any).Astro?.locals?.locale as
      | string
      | undefined;
    const singleColumnItem = {
      title: validatedEvent.title, // Event title as the main bold title
      content: content, // Date/time as subtitle, description as content
      image: imageUrl || undefined, // Include image if available
      callToAction: {
        title: "View Event Details",
        url: prependBase(`/events/${validatedEvent.slug}`, locale || "en-US"),
      },
    };

    // Validate UI output
    return DoubleColumnItemSchema.parse(singleColumnItem);
  });

  console.log("[singleColumnFromUpcomingEvents] Final output:", {
    itemsCount: output.length,
    firstItem: output[0] || null,
  });

  return { items: output };
}

/**
 * Google Form UI from Google Form – resolves a GoogleForm entry to widget data (slug)
 * for rendering via GoogleFormLoader/GoogleForm.vue.
 * Uses targetIDs (Google Form entry ID from targetCollection) when present;
 * otherwise falls back to keys/values (e.g. key "slug" -> value "google-form-proposal-form").
 */
export async function googleFormFromGoogleForm(
  keys: string[],
  values: string[],
  targetIDs: string[],
  _isAtomic: boolean
): Promise<GoogleFormWidgetData> {
  // 1) Resolve slug from target reference (Contentful Google Form entry ID)
  const targetID = targetIDs?.[0];
  if (targetID) {
    const form = await getGoogleFormById(targetID);
    const slug = form?.slug?.trim();
    if (slug) return { slug };
  }
  // 2) Fallback: slug from section keys/values (e.g. slug = "google-form-proposal-form")
  const slugKeyIndex =
    keys?.findIndex((k) => k?.toLowerCase() === "slug") ?? -1;
  if (slugKeyIndex >= 0 && values?.[slugKeyIndex]?.trim()) {
    return { slug: values[slugKeyIndex].trim() };
  }
  return { slug: "" };
}
