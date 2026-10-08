import * as contentful from "contentful";
import { getSecret } from "astro:env/server";
import { getEventMonthKey } from "./helpers";
import { getAdapter } from "./adapters/registry";
import { getStableAdapterIdFromName } from "./adapters/id-mapping";
import type { WidgetData } from "../schema/ui/widget-data";
import {
  queryPageBySlug,
  queryPostBySlug,
  queryEventBySlug,
  queryExhibitBySlug,
  queryGoogleFormBySlug,
  queryGoogleFormById,
  querySpreadsheetFormBySlug,
  querySpreadsheetForms,
  queryVideoGameBySlug,
  queryVideoGamesByExhibitId,
  queryBlogPostsPaginated,
  queryBlogPostsCount,
  queryEventsPaginated,
  queryEventsCount,
  queryVideoGamesPaginated,
  queryVideoGamesCount,
  queryPages,
  queryPagesSlugOnly,
  queryPostsTitleSlug,
  queryMenuItems,
  querySocialMediaHandles,
  queryPrograms,
  queryEvents,
  queryActiveAlerts,
  queryRedirectBySourceUrl,
  type PageCollectionResponse,
  type RedirectCollectionResponse,
  type PostCollectionResponse,
  type EventCollectionResponse,
  type ExhibitCollectionResponse,
  type GoogleFormCollectionResponse,
  type SpreadsheetFormCollectionResponse,
  type VideoGameCollectionResponse,
  type MenuItemCollectionResponse,
  type ProgramCollectionResponse,
  type AlertCollectionResponse,
} from "./contentful/query-builder";
import type {
  Page,
  Post,
  Event,
  Exhibit,
  VideoGame,
  SpreadsheetForm,
  GoogleForm,
  Alert,
  Redirect,
} from "../generated/contentful-types";

/**
 * Get environment variables from Cloudflare runtime or fall back to import.meta.env
 * In Cloudflare Workers, env vars are available via Astro.locals.runtime.env (set by middleware)
 * In build-time and local dev, they're available via import.meta.env
 */
function getEnvVar(key: string): string | undefined {
  // Method 1: Try to access from Astro.locals.runtimeEnv (set by middleware)
  // This is the primary method for Cloudflare Workers runtime
  try {
    // Access Astro through globalThis or try-catch to avoid TypeScript namespace issues
    const astroGlobal = (globalThis as any).Astro;
    if (astroGlobal?.locals) {
      const locals = astroGlobal.locals;
      if (locals?.runtimeEnv?.[key]) {
        return locals.runtimeEnv[key];
      }
      // Also try runtime.env directly (alternative path)
      if (locals?.runtime?.env?.[key]) {
        return locals.runtime.env[key];
      }
    }
  } catch (e) {
    // Astro not available in this context - continue to other methods
  }

  // Method 2: Try astro:env/server API (works in Cloudflare Workers)
  try {
    const secretValue = getSecret(key);
    if (secretValue) {
      return secretValue;
    }
  } catch (e) {
    // getSecret might not be available or might throw - continue to other methods
  }

  // Method 3: Fall back to import.meta.env (for build-time and local dev)
  // Note: In Cloudflare Workers runtime, this won't work unless vars are PUBLIC_*
  const metaEnvValue = import.meta.env[key];
  if (metaEnvValue) {
    return metaEnvValue;
  }

  return undefined;
}

/**
 * Get Contentful configuration from environment
 */
function getContentfulConfig() {
  const space = getEnvVar("CONTENTFUL_SPACE_ID");
  const deliveryToken = getEnvVar("CONTENTFUL_DELIVERY_TOKEN");
  const previewToken = getEnvVar("CONTENTFUL_PREVIEW_TOKEN");
  const environment = getEnvVar("CONTENTFUL_ENVIRONMENT") || "master";

  return {
    space: space || "",
    deliveryToken: deliveryToken || "",
    previewToken: previewToken || "",
    environment,
  };
}

/**
 * Determine if we should use Preview API
 * Checks for preview mode in multiple ways:
 * 1. Environment variable CONTENTFUL_PREVIEW=true
 * 2. Astro.locals.previewMode (set by middleware)
 */
function isPreviewMode(): boolean {
  // Check environment variable first (for build-time decisions)
  const previewEnv = getEnvVar("CONTENTFUL_PREVIEW");
  if (previewEnv === "true") {
    return true;
  }

  // Check Astro locals (for runtime decisions in server-rendered pages)
  // @ts-ignore - Astro.locals may not be typed in all contexts
  if (typeof Astro !== "undefined" && Astro.locals?.previewMode === true) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate Contentful API token
 * Uses Preview API token when in preview mode, otherwise Delivery API token
 */
function getContentfulToken(): string {
  const config = getContentfulConfig();

  if (isPreviewMode()) {
    if (!config.previewToken) {
      console.warn(
        "[contentful] Preview mode enabled but CONTENTFUL_PREVIEW_TOKEN not set"
      );
      return config.deliveryToken;
    }
    return config.previewToken;
  }
  return config.deliveryToken;
}

// Validate environment variables (only at module load time for build/dev)
// Runtime validation happens in apiCall function
const buildTimeConfig = getContentfulConfig();
if (!buildTimeConfig.space || !buildTimeConfig.deliveryToken) {
  console.warn("[contentful] Missing environment variables at build time:", {
    hasSpace: !!buildTimeConfig.space,
    hasDeliveryToken: !!buildTimeConfig.deliveryToken,
    hasPreviewToken: !!buildTimeConfig.previewToken,
    envKeys: Object.keys(import.meta.env).filter((k) =>
      k.includes("CONTENTFUL")
    ),
  });
}

// Legacy queries object - kept for backward compatibility with getByKey
// TODO: Migrate all usages to query builder and remove this
const queries = {
  page: queryPages(),
  eventCollection: queryEvents(),
  programCollection: queryPrograms(),
  menuItemCollection: queryMenuItems({ where: "isTopLevel: true" }),
  socialMediaHandleCollection: querySocialMediaHandles(),
  pageBySlug: queryPageBySlug(""), // Placeholder - actual slug passed via variables
  pageCollection: queryPagesSlugOnly(), // Only slug needed for getStaticPaths
  blogPostCollection: queryPostsTitleSlug(), // Title and slug for blog listing
  blogPostsPaginated: queryBlogPostsPaginated(0, 10), // Placeholder
  blogPostsCount: queryBlogPostsCount(),
  postBySlug: queryPostBySlug(""), // Placeholder
  eventBySlug: queryEventBySlug(""), // Placeholder
  eventsPaginated: queryEventsPaginated(0, 10), // Placeholder
  eventsCount: queryEventsCount(),
};

export async function getPageBySlug(
  slug: string,
  locale?: string
): Promise<Page | null> {
  try {
    // Debug logging
    if (import.meta.env.DEV) {
      console.log(
        `[getPageBySlug] Fetching page "${slug}"${
          locale ? ` with locale "${locale}"` : " (no locale specified)"
        }`
      );
    }

    const query = queryPageBySlug(slug, locale);
    const variables = { slug };

    // Debug: Log the actual query being sent
    if (import.meta.env.DEV && locale) {
      console.log(
        `[getPageBySlug] GraphQL Query:`,
        query.replace(/\s+/g, " ").trim()
      );
    }

    const response = await apiCall(query, variables);
    const json = await response.json();

    // Check for GraphQL errors
    if (json.errors) {
      console.error(
        `[getPageBySlug] GraphQL errors for slug "${slug}":`,
        json.errors
      );
      return null;
    }

    const data = json.data as PageCollectionResponse;
    let page = data?.pageCollection?.items?.[0] || null;

    // Debug: Log what we got back
    if (import.meta.env.DEV && page) {
      console.log(`[getPageBySlug] Received page data:`, {
        id: page.sys.id,
        title: page.title,
        slug: page.slug,
        requestedLocale: locale || "default",
      });
    }

    // If no page found with requested locale and locale was specified, try fallback
    if (!page && locale) {
      const { getLocaleFallback } = await import("./contentful/locales");
      const fallbackLocale = await getLocaleFallback(locale);
      if (fallbackLocale !== locale) {
        console.log(
          `[getPageBySlug] Page not found in locale "${locale}", trying fallback "${fallbackLocale}"`
        );
        return getPageBySlug(slug, fallbackLocale);
      }
    }

    if (!page) {
      console.warn(
        `[getPageBySlug] No page found for slug "${slug}"${
          locale ? ` in locale "${locale}"` : ""
        }`
      );
    } else {
      if (import.meta.env.DEV) {
        console.log(
          `[getPageBySlug] Found page "${slug}"${
            locale ? ` in locale "${locale}"` : ""
          }:`,
          {
            id: page.sys.id,
            title: page.title,
            hasContentViewCollection: !!page.contentViewCollection,
            contentViewCount: page.contentViewCollection?.items?.length || 0,
          }
        );
      }
    }

    return page;
  } catch (error) {
    console.error(
      `[getPageBySlug] Error fetching page with slug "${slug}":`,
      error
    );
    return null;
  }
}

export async function getPostBySlug(
  slug: string,
  locale?: string
): Promise<Post | null> {
  const query = queryPostBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getPostBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as PostCollectionResponse;
  let post = data?.postCollection?.items?.[0] || null;

  // If no post found with requested locale and locale was specified, try fallback
  if (!post && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getPostBySlug(slug, fallbackLocale);
    }
  }

  return post;
}

export async function getBlogPostsCount(): Promise<number> {
  const query = queryBlogPostsCount();
  const response = await apiCall(query);
  const json = await response.json();
  return json.data?.postCollection?.total || 0;
}

export async function getBlogPostsPaginated(
  page: number,
  limit: number = 10
): Promise<Post[]> {
  const skip = (page - 1) * limit;
  const query = queryBlogPostsPaginated(skip, limit);
  const variables = { skip, limit };

  const response = await apiCall(query, variables);
  const json = await response.json();
  const data = json.data as PostCollectionResponse;
  return data?.postCollection?.items || [];
}

export async function getEventBySlug(
  slug: string,
  locale?: string
): Promise<Event | null> {
  const query = queryEventBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getEventBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as EventCollectionResponse;
  let event = data?.eventCollection?.items?.[0] || null;

  // If no event found with requested locale and locale was specified, try fallback
  if (!event && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getEventBySlug(slug, fallbackLocale);
    }
  }

  return event;
}

export async function getEventsCount(): Promise<number> {
  const query = queryEventsCount();
  const response = await apiCall(query);
  const json = await response.json();
  return json.data?.eventCollection?.total || 0;
}

export async function getEventsPaginated(
  page: number,
  limit: number = 10
): Promise<Event[]> {
  const skip = (page - 1) * limit;
  const query = queryEventsPaginated(skip, limit);
  const variables = { skip, limit };

  const response = await apiCall(query, variables);
  const json = await response.json();
  if (json.errors) {
    console.error(
      "[contentful] getEventsPaginated GraphQL error(s):",
      JSON.stringify(json.errors)
    );
  }
  const data = json.data as EventCollectionResponse;
  return data?.eventCollection?.items || [];
}

/**
 * Contentful's GraphQL API rejects queries above a fixed complexity budget. Because each
 * Event has several nested collections (images, presenters, program, callToAction), fetching
 * more than ~90 events in a single `getEventsPaginated` call exceeds that budget and Contentful
 * returns an error - which was silently swallowed as an empty array, making the calendar/event
 * pages appear to have no events once the total event count grew past that threshold.
 *
 * This fetches every event by paging through in safe-sized batches and concatenating the results,
 * so callers that need the full event list (e.g. for prev/next navigation or calendar filtering)
 * don't have to worry about Contentful's per-query complexity limit.
 */
const EVENTS_SAFE_BATCH_SIZE = 50;

export async function getAllEvents(): Promise<Event[]> {
  const totalEvents = await getEventsCount();
  const events: Event[] = [];

  for (let skip = 0; skip < totalEvents; skip += EVENTS_SAFE_BATCH_SIZE) {
    const page = skip / EVENTS_SAFE_BATCH_SIZE + 1;
    const batch = await getEventsPaginated(page, EVENTS_SAFE_BATCH_SIZE);
    if (batch.length === 0) break;
    events.push(...batch);
  }

  return events;
}

/**
 * Groups Events by the Pacific calendar month their startDate falls on (see
 * getEventMonthKey in lib/helpers.ts), with each month's events sorted chronologically.
 * Events without a startDate are skipped. Shared by the by_month calendar JSON endpoints
 * (src/pages/[locale]/event/by_month/) so the index and per-month blobs always agree on
 * which months exist.
 */
export function bucketEventsByMonth(events: Event[]): Map<string, Event[]> {
  const eventsByMonth = new Map<string, Event[]>();

  for (const event of events) {
    if (!event.startDate) continue;
    const key = getEventMonthKey(event.startDate);
    const bucket = eventsByMonth.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      eventsByMonth.set(key, [event]);
    }
  }

  for (const bucket of eventsByMonth.values()) {
    bucket.sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }

  return eventsByMonth;
}

export async function getExhibitBySlug(
  slug: string,
  locale?: string
): Promise<Exhibit | null> {
  const query = queryExhibitBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getExhibitBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as ExhibitCollectionResponse;
  let exhibit = data?.exhibitCollection?.items?.[0] || null;

  if (!exhibit && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getExhibitBySlug(slug, fallbackLocale);
    }
  }

  return exhibit;
}

export async function getGoogleFormBySlug(
  slug: string,
  locale?: string
): Promise<GoogleForm | null> {
  const query = queryGoogleFormBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getGoogleFormBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as GoogleFormCollectionResponse;
  let form = data?.googleFormCollection?.items?.[0] || null;

  if (!form && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getGoogleFormBySlug(slug, fallbackLocale);
    }
  }

  return form;
}

export async function getGoogleFormById(
  id: string,
  locale?: string
): Promise<GoogleForm | null> {
  const query = queryGoogleFormById(id, locale);
  const variables = { id };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getGoogleFormById] GraphQL errors for id "${id}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as GoogleFormCollectionResponse;
  let form = data?.googleFormCollection?.items?.[0] || null;

  if (!form && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getGoogleFormById(id, fallbackLocale);
    }
  }

  return form;
}

export async function getSpreadsheetFormBySlug(
  slug: string,
  locale?: string
): Promise<SpreadsheetForm | null> {
  const query = querySpreadsheetFormBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getSpreadsheetFormBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as SpreadsheetFormCollectionResponse;
  let form = data?.spreadsheetFormCollection?.items?.[0] || null;

  if (!form && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getSpreadsheetFormBySlug(slug, fallbackLocale);
    }
  }

  return form;
}

export async function getSpreadsheetForms(): Promise<SpreadsheetForm[]> {
  const query = querySpreadsheetForms();
  const response = await apiCall(query);
  const json = await response.json();

  if (json.errors) {
    console.error("[getSpreadsheetForms] GraphQL errors:", json.errors);
    return [];
  }

  const data = json.data as SpreadsheetFormCollectionResponse;
  return data?.spreadsheetFormCollection?.items ?? [];
}

export async function getVideoGameBySlug(
  slug: string,
  locale?: string
): Promise<VideoGame | null> {
  const query = queryVideoGameBySlug(slug, locale);
  const variables = { slug };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getVideoGameBySlug] GraphQL errors for slug "${slug}":`,
      json.errors
    );
    return null;
  }

  const data = json.data as VideoGameCollectionResponse;
  let game = data?.videoGameCollection?.items?.[0] || null;

  if (!game && locale) {
    const { getLocaleFallback } = await import("./contentful/locales");
    const fallbackLocale = await getLocaleFallback(locale);
    if (fallbackLocale !== locale) {
      return getVideoGameBySlug(slug, fallbackLocale);
    }
  }

  return game;
}

export async function getVideoGamesCount(): Promise<number> {
  const query = queryVideoGamesCount();
  const response = await apiCall(query);
  const json = await response.json();
  return json.data?.videoGameCollection?.total || 0;
}

export async function getVideoGamesPaginated(
  page: number,
  limit: number = 10
): Promise<VideoGame[]> {
  const skip = (page - 1) * limit;
  const query = queryVideoGamesPaginated(skip, limit);
  const variables = { skip, limit };

  const response = await apiCall(query, variables);
  const json = await response.json();
  const data = json.data as VideoGameCollectionResponse;
  return data?.videoGameCollection?.items || [];
}

export async function getVideoGamesByExhibitId(
  exhibitId: string,
  locale?: string
): Promise<VideoGame[]> {
  const query = queryVideoGamesByExhibitId(exhibitId, locale);
  const variables = { exhibitId };

  const response = await apiCall(query, variables);
  const json = await response.json();

  if (json.errors) {
    console.error(
      `[getVideoGamesByExhibitId] GraphQL errors for exhibit "${exhibitId}":`,
      json.errors
    );
    return [];
  }

  const data = json.data as VideoGameCollectionResponse;
  return data?.videoGameCollection?.items || [];
}

export async function getByKey(key: string) {
  const query = queries[key as keyof typeof queries];
  if (!query) {
    console.warn(`Query key "${key}" not found in queries object`);
    return {};
  }
  const response = await apiCall(query);
  const json = await response.json();

  // Check for GraphQL errors
  if (json.errors) {
    console.error(`GraphQL errors for query "${key}":`, json.errors);
    return {};
  }

  return json.data || {};
}

export async function getByQuery(query: string) {
  const response = await apiCall(query);
  const json = await response.json();

  // Check for GraphQL errors
  if (json.errors) {
    console.error("GraphQL errors:", json.errors);
    throw new Error(`GraphQL query failed: ${JSON.stringify(json.errors)}`);
  }

  // Return data, or empty object if data is missing
  return json.data || {};
}

export async function getByQueryAndVariables(
  query: string,
  keys: string[],
  values: string[]
) {
  const vars: Record<string, string> = {};
  keys.forEach((key, index) => {
    vars[key] = values[index];
  });

  const response = await apiCall(query, vars);
  const json = await response.json();
  return json.data;
}

/**
 * Resolve adapter name from Contentful entry ID
 * Used when we only have the Contentful entry ID (e.g. sys.id); we fetch the entry and return its name.
 * Lookup is then done via nameToStableId (by name).
 */
async function resolveAdapterNameFromId(
  entryId: string
): Promise<string | null> {
  try {
    const query = `
      {
        dataAdapterCollection(where: { sys: { id: "${entryId}" } }, limit: 1) {
          items {
            name
          }
        }
      }
    `;
    const response = await apiCall(query);
    const json = await response.json();
    const name = json.data?.dataAdapterCollection?.items?.[0]?.name;
    return name ?? null;
  } catch (error) {
    console.warn(`Failed to resolve adapter name for ID "${entryId}":`, error);
    return null;
  }
}

/**
 * Get adapter data by type using the adapter registry
 *
 * @param dataAdapter - Adapter identifier (name or sys.id)
 * @param keys - Adapter configuration keys
 * @param values - Adapter configuration values
 * @param targetIDs - Target content entry IDs
 * @returns Adapter result data (WidgetData)
 * @throws Error if adapter not found
 */
export async function getAdapterDataByType(
  dataAdapter: { name?: string; sys?: { id: string } },
  keys: string[],
  values: string[],
  targetIDs: string[]
): Promise<WidgetData> {
  // Prefer Contentful name; resolve to stableId via nameToStableId for code use
  let identifier: string | undefined;
  if (dataAdapter.name) {
    identifier =
      getStableAdapterIdFromName(dataAdapter.name) ?? dataAdapter.name;
  } else if (dataAdapter.sys?.id) {
    const resolvedName = await resolveAdapterNameFromId(dataAdapter.sys.id);
    identifier = resolvedName
      ? getStableAdapterIdFromName(resolvedName) ?? resolvedName
      : dataAdapter.sys.id;
  }

  if (!identifier) {
    throw new Error("Adapter identifier (name or sys.id) is required");
  }

  let adapter;
  try {
    adapter = getAdapter(identifier);
  } catch (error) {
    // If adapter not found, log error and return empty collection as fallback
    // Note: This may cause type mismatches for atomic widgets, but it's a fallback
    console.error(`Adapter not found: "${identifier}":`, error);
    return { items: [] };
  }

  try {
    return await adapter.handler(keys, values, targetIDs, adapter.isAtomic);
  } catch (error) {
    // If adapter execution fails, log error and return appropriate empty structure
    console.error(`Adapter execution failed for "${identifier}":`, error);

    // Return appropriate empty structure based on adapter output type
    // This prevents type mismatches (e.g., returning { items: [] } for splash widgets)
    if (adapter.isAtomic) {
      if (adapter.outputType === "splash") {
        // Return minimal valid splash structure
        return {
          contents: [
            {
              title: "",
              subtitle: "",
            },
          ],
          padding: "lg" as const,
          overlay: true,
          overlayOpacity: "dark" as const,
          autoPlay: false,
        };
      } else if (adapter.outputType === "report") {
        // Return minimal valid report structure
        return {
          report: {
            name: "",
            title: "",
            date: "",
            period: "Year" as const,
            goal: "",
            categories: [],
          },
        };
      } else if (adapter.outputType === "googleForm") {
        return { slug: "" };
      }
    }

    // Default: return empty collection structure (for collection widgets)
    return { items: [] };
  }
}

/**
 * Priority order used to pick the single alert to display when multiple
 * Alerts are simultaneously active (see getActiveAlert below).
 */
const ALERT_TYPE_PRIORITY: Record<string, number> = {
  Danger: 0,
  Warning: 1,
  Message: 2,
};

/**
 * Fetch the single most relevant currently-active Alert (startDate <= now <= endDate),
 * if any. When multiple Alerts are active at once, the most severe `type` wins
 * (Danger > Warning > Message), with the most recently started Alert as a tiebreaker.
 */
export async function getActiveAlert(locale?: string): Promise<Alert | null> {
  try {
    // Build an ISO 8601 datetime string with timezone offset, matching the
    // date-filtering convention used elsewhere for Contentful date queries
    // (see e.g. gridFromEvents in lib/adapters.ts).
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset();
    const tzHours = Math.floor(Math.abs(tzOffset) / 60);
    const tzMinutes = Math.abs(tzOffset) % 60;
    const tzSign = tzOffset >= 0 ? "+" : "-";
    const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(
      tzMinutes
    ).padStart(2, "0")}`;
    const nowIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}T${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
      now.getSeconds()
    ).padStart(2, "0")}${tzString}`;

    const query = queryActiveAlerts(nowIso, locale);
    const response = await apiCall(query);
    const json = await response.json();

    if (json.errors) {
      console.error("[getActiveAlert] GraphQL errors:", json.errors);
      return null;
    }

    const data = json.data as AlertCollectionResponse;
    const alerts = data?.alertCollection?.items ?? [];
    if (alerts.length === 0) return null;

    const sorted = [...alerts].sort((a, b) => {
      const priorityA = ALERT_TYPE_PRIORITY[a.type] ?? 99;
      const priorityB = ALERT_TYPE_PRIORITY[b.type] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    return sorted[0];
  } catch (error) {
    console.error("[getActiveAlert] Error fetching active alert:", error);
    return null;
  }
}

/**
 * Look up a Redirect entry by its sourceUrl (a legacy/broken slug). Used as a
 * fallback when a Page can't be found for the requested slug, so editors can
 * point old URLs at a new destination without restoring the original page.
 */
export async function getRedirectBySourceUrl(
  sourceUrl: string,
  locale?: string
): Promise<Redirect | null> {
  try {
    const query = queryRedirectBySourceUrl(sourceUrl, locale);
    const variables = { sourceUrl };
    const response = await apiCall(query, variables);
    const json = await response.json();

    if (json.errors) {
      console.error(
        `[getRedirectBySourceUrl] GraphQL errors for sourceUrl "${sourceUrl}":`,
        json.errors
      );
      return null;
    }

    const data = json.data as RedirectCollectionResponse;
    return data?.redirectCollection?.items?.[0] || null;
  } catch (error) {
    console.error(
      `[getRedirectBySourceUrl] Error fetching redirect for sourceUrl "${sourceUrl}":`,
      error
    );
    return null;
  }
}

export async function apiCall(
  query: string,
  variables: Record<string, any> = {}
) {
  // Get config using astro:env API (works in Cloudflare Workers)
  // This is called at request time, so Astro context should be available
  const config = getContentfulConfig();
  const token = getContentfulToken();
  const isPreview = isPreviewMode();

  // Validate we have required config
  if (!config.space || !token) {
    const errorMsg = `[contentful] Missing required configuration: space=${!!config.space}, token=${!!token}`;
    console.error(errorMsg);

    // Enhanced debugging: try to see what's available
    try {
      const astroGlobal = (globalThis as any).Astro;
      const locals = astroGlobal?.locals || null;
      console.error("[contentful] Debug info:", {
        hasSpace: !!config.space,
        hasDeliveryToken: !!config.deliveryToken,
        hasPreviewToken: !!config.previewToken,
        tokenLength: token.length,
        hasAstro: !!astroGlobal,
        hasLocals: !!locals,
        hasRuntimeEnv: !!locals?.runtimeEnv,
        runtimeEnvKeys: locals?.runtimeEnv
          ? Object.keys(locals.runtimeEnv).filter((k) =>
              k.includes("CONTENTFUL")
            )
          : [],
        hasRuntime: !!locals?.runtime?.env,
        runtimeKeys: locals?.runtime?.env
          ? Object.keys(locals.runtime.env).filter((k) =>
              k.includes("CONTENTFUL")
            )
          : [],
        importMetaEnvKeys: Object.keys(import.meta.env).filter((k) =>
          k.includes("CONTENTFUL")
        ),
      });
    } catch (e) {
      console.error("[contentful] Could not access debug info:", e);
    }

    throw new Error(errorMsg);
  }

  const fetchUrl = `https://graphql.contentful.com/content/v1/spaces/${config.space}/environments/${config.environment}`;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // Add preview header for Contentful Preview API
      ...(isPreview && config.previewToken
        ? { "X-Contentful-Preview": "true" }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
  };

  if (import.meta.env.DEV) {
    console.log(
      `[contentful] API call (${isPreview ? "PREVIEW" : "DELIVERY"}):`,
      {
        url: fetchUrl,
        queryLength: query.length,
        variablesCount: Object.keys(variables).length,
        hasToken: !!token,
        tokenLength: token.length,
        space: config.space,
        environment: config.environment,
      }
    );

    // Log the actual query body for debugging locale issues
    if (query.includes("locale:")) {
      console.log(`[contentful] Query includes locale parameter`);
      // Extract locale from query for debugging
      const localeMatch = query.match(/locale:\s*"([^"]+)"/);
      if (localeMatch) {
        console.log(`[contentful] Locale in query: "${localeMatch[1]}"`);
      }
    }
  }

  return await fetch(fetchUrl, options);
}
