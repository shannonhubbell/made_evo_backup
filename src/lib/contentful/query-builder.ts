/**
 * Type-Safe Query Builder for Contentful GraphQL API
 *
 * This module provides type-safe functions for building Contentful GraphQL queries
 * using the generated types and fragments.
 *
 * Usage:
 *   import { queryPrograms, queryEvents } from './query-builder';
 *   const data = await getByQuery(queryPrograms());
 */

import type {
  Program,
  Event,
  Post,
  Page,
  MenuItem,
  Exhibit,
  VideoGame,
  Member,
  ImpactReport,
  Metric,
  MetricPeriod,
  Press,
  ContentView,
  SocialMediaHandle,
  SpreadsheetForm,
  GoogleForm,
  Alert,
  Redirect,
} from "../../generated/contentful-types";
import {
  ProgramFields,
  ProgramFieldsSimple,
  GoogleFormFields,
  SpreadsheetFormFields,
  EventFields,
  EventFieldsSimple,
  PostFields,
  PostFieldsSimple,
  PostFieldsMinimal,
  PageFields,
  RedirectFields,
  MenuItemFields,
  ExhibitFields,
  ExhibitFieldsWithEmbeddedAssetLinks,
  VideoGameFields,
  VideoGameFieldsWithEmbeddedAssetLinks,
  MemberFields,
  ImpactReportFields,
  MetricFields,
  MetricPeriodFields,
  PressFields,
  ContentViewFields,
  SocialMediaHandleFields,
  OrganizationFields,
  IdOnlyFields,
  TitleOnlyFields,
  SitemapFields,
  AlertFields,
} from "./fragments";

/**
 * Query options for collection queries
 */
export interface QueryOptions {
  where?: string;
  limit?: number;
  skip?: number;
  order?: string;
}

/**
 * Build a where clause string from an object
 */
function buildWhereClause(where: Record<string, any>): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "string") {
        conditions.push(`${key}: "${value}"`);
      } else if (typeof value === "number" || typeof value === "boolean") {
        conditions.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        conditions.push(`${key}: ${JSON.stringify(value)}`);
      } else if (typeof value === "object") {
        // Nested where clause
        const nested = buildWhereClause(value);
        conditions.push(`${key}: { ${nested} }`);
      }
    }
  }

  return conditions.join(", ");
}

/**
 * Build query arguments string from options
 * @internal - Exported for testing purposes
 */
export function buildQueryArgs(options: QueryOptions = {}): string {
  const args: string[] = [];

  if (options.where) {
    // Support both string (raw GraphQL where clause) and object (structured where clause)
    if (typeof options.where === "string") {
      args.push(`where: { ${options.where} }`);
    } else if (typeof options.where === "object") {
      args.push(`where: { ${buildWhereClause(options.where)} }`);
    }
  }

  if (options.limit !== undefined) {
    args.push(`limit: ${options.limit}`);
  }

  if (options.skip !== undefined) {
    args.push(`skip: ${options.skip}`);
  }

  if (options.order) {
    args.push(`order: ${options.order}`);
  }

  return args.length > 0 ? `(${args.join(", ")})` : "";
}

/**
 * Query Program collection
 * Uses simplified fields to reduce query complexity for collection queries
 */
export function queryPrograms(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      programCollection${args} {
        items {
          ${ProgramFieldsSimple}
        }
      }
    }
  `;
}

/**
 * Query Event collection
 * Uses simplified fields to reduce query complexity
 */
export function queryEvents(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      eventCollection${args} {
        items {
          ${EventFieldsSimple}
        }
      }
    }
  `;
}

/**
 * Query Organization collection
 * Used for e.g. the Image Marquee widget's logo wall
 */
export function queryOrganizations(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      organizationCollection${args} {
        items {
          ${OrganizationFields}
        }
      }
    }
  `;
}

/**
 * Query Post collection
 * Uses simplified fields to reduce query complexity for collection queries
 * For single post queries, use queryPostBySlug which uses full PostFields
 */
export function queryPosts(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  // Use simplified fields for collection queries to reduce complexity
  // Rich text content is still included as it's needed for rendering
  return `
    {
      postCollection${args} {
        items {
          ${PostFieldsSimple}
        }
      }
    }
  `;
}

/**
 * Query Page collection
 */
export function queryPages(
  options: QueryOptions = {},
  locale?: string
): string {
  const args = buildQueryArgs(options);
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    {
      pageCollection${args}${localeArg} {
        items {
          ${PageFields}
        }
      }
    }
  `;
}

/**
 * Query single Page by slug
 */
export function queryPageBySlug(slug: string, locale?: string): string {
  // Contentful GraphQL: locale parameter goes directly on the collection
  // If locale is specified, use it; otherwise Contentful uses default locale
  const localeArg = locale ? `, locale: "${locale}"` : "";

  // Debug logging
  if (import.meta.env.DEV) {
    console.log(
      `[queryPageBySlug] Building query for slug "${slug}"${
        locale ? ` with locale "${locale}"` : " (default locale)"
      }`
    );
  }

  const query = `
    query PageBySlug($slug: String!) {
      pageCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${PageFields}
        }
      }
    }
  `;

  // Debug: Log the actual query
  if (import.meta.env.DEV && locale) {
    console.log(`[queryPageBySlug] Generated query:`, query);
  }

  return query;
}

/**
 * Query single Redirect by sourceUrl
 */
export function queryRedirectBySourceUrl(
  sourceUrl: string,
  locale?: string
): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query RedirectBySourceUrl($sourceUrl: String!) {
      redirectCollection(where: { sourceUrl: $sourceUrl }, limit: 1${localeArg}) {
        items {
          ${RedirectFields}
        }
      }
    }
  `;
}

/**
 * Query single Post by slug
 */
export function queryPostBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query PostBySlug($slug: String!) {
      postCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${PostFields}
        }
      }
    }
  `;
}

/**
 * Query single Event by slug
 */
export function queryEventBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query EventBySlug($slug: String!) {
      eventCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${EventFields}
        }
      }
    }
  `;
}

/**
 * Query MenuItem collection
 */
export function queryMenuItems(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      menuItemCollection${args} {
        items {
          ${MenuItemFields}
        }
      }
    }
  `;
}

/**
 * Query Alerts that are currently active (startDate <= nowIso <= endDate).
 * `nowIso` should be an ISO 8601 datetime string (with timezone offset).
 * `locale` is honored since Alert's `title` and `callToAction` fields are localized.
 */
export function queryActiveAlerts(nowIso: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    {
      alertCollection(
        where: { startDate_lte: "${nowIso}", endDate_gte: "${nowIso}" }
        order: sys_publishedAt_DESC
        limit: 10${localeArg}
      ) {
        items {
          ${AlertFields}
        }
      }
    }
  `;
}

/**
 * Query SocialMediaHandle collection
 */
export function querySocialMediaHandles(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      socialMediaHandleCollection${args} {
        items {
          ${SocialMediaHandleFields}
        }
      }
    }
  `;
}

/**
 * Query single GoogleForm by slug
 */
export function queryGoogleFormBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query GoogleFormBySlug($slug: String!) {
      googleFormCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${GoogleFormFields}
        }
      }
    }
  `;
}

/**
 * Query single GoogleForm by sys.id (for adapter target resolution)
 */
export function queryGoogleFormById(id: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query GoogleFormById($id: String!) {
      googleFormCollection(where: { sys: { id: $id } }, limit: 1${localeArg}) {
        items {
          ${GoogleFormFields}
        }
      }
    }
  `;
}

/**
 * Query single SpreadsheetForm by slug
 */
export function querySpreadsheetFormBySlug(
  slug: string,
  locale?: string
): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query SpreadsheetFormBySlug($slug: String!) {
      spreadsheetFormCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${SpreadsheetFormFields}
        }
      }
    }
  `;
}

/**
 * Query SpreadsheetForm collection (all)
 */
export function querySpreadsheetForms(): string {
  return `
    {
      spreadsheetFormCollection {
        items {
          ${SpreadsheetFormFields}
        }
      }
    }
  `;
}

/**
 * Query single Exhibit by slug
 */
export function queryExhibitBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query ExhibitBySlug($slug: String!) {
      exhibitCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${ExhibitFieldsWithEmbeddedAssetLinks}
        }
      }
    }
  `;
}

/**
 * Query Exhibit collection (paginated)
 */
export function queryExhibitsPaginated(skip: number, limit: number): string {
  return `
    query ExhibitsPaginated($skip: Int!, $limit: Int!) {
      exhibitCollection(skip: $skip, limit: $limit, order: startDate_DESC) {
        items {
          ${ExhibitFields}
        }
      }
    }
  `;
}

/**
 * Query Exhibits count
 */
export function queryExhibitsCount(): string {
  return `
    {
      exhibitCollection {
        total
      }
    }
  `;
}

/**
 * Query Exhibit collection
 */
export function queryExhibits(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      exhibitCollection${args} {
        items {
          ${ExhibitFields}
        }
      }
    }
  `;
}

/**
 * Query single VideoGame by slug
 */
export function queryVideoGameBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query VideoGameBySlug($slug: String!) {
      videoGameCollection(where: { slug: $slug }, limit: 1${localeArg}) {
        items {
          ${VideoGameFieldsWithEmbeddedAssetLinks}
        }
      }
    }
  `;
}

/**
 * Query VideoGame collection (paginated)
 */
export function queryVideoGamesPaginated(skip: number, limit: number): string {
  return `
    query VideoGamesPaginated($skip: Int!, $limit: Int!) {
      videoGameCollection(skip: $skip, limit: $limit, order: releaseDate_DESC) {
        items {
          ${VideoGameFields}
        }
      }
    }
  `;
}

/**
 * Query VideoGames count
 */
export function queryVideoGamesCount(): string {
  return `
    {
      videoGameCollection {
        total
      }
    }
  `;
}

/**
 * Query VideoGames that reference a given exhibit (by exhibit sys.id)
 */
export function queryVideoGamesByExhibitId(
  exhibitId: string,
  locale?: string
): string {
  const localeArg = locale ? `, locale: "${locale}"` : "";
  return `
    query VideoGamesByExhibit($exhibitId: String!) {
      videoGameCollection(where: { exhibit: { sys: { id: $exhibitId } } }, limit: 100${localeArg}) {
        items {
          ${VideoGameFields}
        }
      }
    }
  `;
}

/**
 * Query VideoGame collection
 */
export function queryVideoGames(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      videoGameCollection${args} {
        items {
          ${VideoGameFields}
        }
      }
    }
  `;
}

/**
 * Query Member collection
 */
export function queryMembers(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      memberCollection${args} {
        items {
          ${MemberFields}
        }
      }
    }
  `;
}

/**
 * Query ImpactReport by ID
 */
export function queryImpactReport(id: string): string {
  return `
    {
      impactReport(id: "${id}") {
        ${ImpactReportFields}
      }
    }
  `;
}

/**
 * Query Metric collection
 */
export function queryMetrics(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      metricCollection${args} {
        items {
          ${MetricFields}
        }
      }
    }
  `;
}

/**
 * Query MetricPeriod collection
 */
export function queryMetricPeriods(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      metricPeriodCollection${args} {
        items {
          ${MetricPeriodFields}
        }
      }
    }
  `;
}

/**
 * Query Press collection
 */
export function queryPress(options: QueryOptions = {}): string {
  const args = buildQueryArgs(options);
  return `
    {
      pressCollection${args} {
        items {
          ${PressFields}
        }
      }
    }
  `;
}

/**
 * Query Posts with blog tag (paginated)
 */
export function queryBlogPostsPaginated(skip: number, limit: number): string {
  return `
    query BlogPostsPaginated($skip: Int!, $limit: Int!) {
      postCollection(
        where: { contentfulMetadata: { tags: { id_contains_some: ["blog"] } } },
        skip: $skip,
        limit: $limit,
        order: sys_publishedAt_DESC
      ) {
        items {
          ${PostFields}
        }
      }
    }
  `;
}

/**
 * Query count of Posts with blog tag
 */
export function queryBlogPostsCount(): string {
  return `
    {
      postCollection(where: { contentfulMetadata: { tags: { id_contains_some: ["blog"] } } }) {
        total
      }
    }
  `;
}

/**
 * Query Events (paginated)
 */
export function queryEventsPaginated(skip: number, limit: number): string {
  return `
    query EventsPaginated($skip: Int!, $limit: Int!) {
      eventCollection(skip: $skip, limit: $limit, order: startDate_DESC) {
        items {
          ${EventFields}
        }
      }
    }
  `;
}

/**
 * Query Events count
 */
export function queryEventsCount(): string {
  return `
    {
      eventCollection {
        total
      }
    }
  `;
}

/**
 * Query Pages collection (slug only - for getStaticPaths)
 */
export function queryPagesSlugOnly(): string {
  return `
    {
      pageCollection {
        items {
          sys {
            id
          }
          slug
        }
      }
    }
  `;
}

/**
 * Sitemap queries - minimal (sys + slug) paginated queries for every content type
 * that has its own dedicated page route. Low complexity by design so large
 * collections can be fully paginated without hitting Contentful's GraphQL
 * complexity budget (unlike e.g. queryPages(), which pulls in Page's full
 * contentViewCollection).
 */
export function querySitemapPages(skip: number, limit: number): string {
  return `
    query SitemapPages($skip: Int!, $limit: Int!) {
      pageCollection(skip: $skip, limit: $limit) {
        total
        items {
          ${SitemapFields}
        }
      }
    }
  `;
}

export function querySitemapPosts(skip: number, limit: number): string {
  return `
    query SitemapPosts($skip: Int!, $limit: Int!) {
      postCollection(
        where: { contentfulMetadata: { tags: { id_contains_some: ["blog"] } } }
        skip: $skip
        limit: $limit
      ) {
        total
        items {
          ${SitemapFields}
        }
      }
    }
  `;
}

export function querySitemapEvents(skip: number, limit: number): string {
  return `
    query SitemapEvents($skip: Int!, $limit: Int!) {
      eventCollection(skip: $skip, limit: $limit) {
        total
        items {
          ${SitemapFields}
        }
      }
    }
  `;
}

export function querySitemapExhibits(skip: number, limit: number): string {
  return `
    query SitemapExhibits($skip: Int!, $limit: Int!) {
      exhibitCollection(skip: $skip, limit: $limit) {
        total
        items {
          ${SitemapFields}
        }
      }
    }
  `;
}

export function querySitemapVideoGames(skip: number, limit: number): string {
  return `
    query SitemapVideoGames($skip: Int!, $limit: Int!) {
      videoGameCollection(skip: $skip, limit: $limit) {
        total
        items {
          ${SitemapFields}
        }
      }
    }
  `;
}

/**
 * Query Posts collection (title and slug only - for blog listing)
 */
export function queryPostsTitleSlug(): string {
  return `
    {
      postCollection(where: { contentfulMetadata: { tags: { id_contains_some: ["blog"] } } }) {
        items {
          sys {
            id
          }
          title
          slug
        }
      }
    }
  `;
}

/**
 * Type-safe response types for queries
 */
export type ProgramCollectionResponse = {
  programCollection: {
    items: Program[];
  };
};

export type EventCollectionResponse = {
  eventCollection: {
    items: Event[];
  };
};

export type PostCollectionResponse = {
  postCollection: {
    items: Post[];
  };
};

export type PageCollectionResponse = {
  pageCollection: {
    items: Page[];
  };
};

export type RedirectCollectionResponse = {
  redirectCollection: {
    items: Redirect[];
  };
};

export type MenuItemCollectionResponse = {
  menuItemCollection: {
    items: MenuItem[];
  };
};

export type AlertCollectionResponse = {
  alertCollection: {
    items: Alert[];
  };
};

export type ExhibitCollectionResponse = {
  exhibitCollection: {
    items: Exhibit[];
  };
};

export type VideoGameCollectionResponse = {
  videoGameCollection: {
    items: VideoGame[];
  };
};

export type MemberCollectionResponse = {
  memberCollection: {
    items: Member[];
  };
};

export type ImpactReportResponse = {
  impactReport: ImpactReport;
};

export type MetricCollectionResponse = {
  metricCollection: {
    items: Metric[];
  };
};

export type MetricPeriodCollectionResponse = {
  metricPeriodCollection: {
    items: MetricPeriod[];
  };
};

export type PressCollectionResponse = {
  pressCollection: {
    items: Press[];
  };
};

export type GoogleFormCollectionResponse = {
  googleFormCollection: {
    items: GoogleForm[];
  };
};

export type SpreadsheetFormCollectionResponse = {
  spreadsheetFormCollection: {
    items: SpreadsheetForm[];
  };
};
