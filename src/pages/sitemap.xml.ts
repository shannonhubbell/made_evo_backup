/**
 * Astro Sitemap Generator
 *
 * Generates a sitemap for Google search indexing by walking the same content
 * graph the site actually renders pages for - i.e. every content type that has
 * its own dedicated route (see src/pages/[locale]/**):
 *   - Page            -> /{locale}/{slug}          (src/pages/[slug].astro renders "home" at /{locale})
 *   - Post (blog)      -> /{locale}/blog/posts/{slug}
 *   - Event           -> /{locale}/event/{slug}
 *   - Exhibit         -> /{locale}/exhibit/{slug}
 *   - VideoGame       -> /{locale}/video_game/{slug}
 *   - MenuItem.href   -> whatever page it points to (top-level + children)
 *
 * All entries are emitted as absolute URLs (using the canonical domain configured
 * via `site` in astro.config.ts, e.g. https://www.themade.org) with locale-prefixed
 * paths (rather than bare slugs that would 301-redirect), so crawlers land directly
 * on the correct localized page - one set of URLs per locale available in Contentful.
 *
 * Content is fetched with minimal (sys + slug only) queries and paginated in full,
 * since the default queryPages()-style queries pull in heavy nested fields
 * (e.g. Page.contentViewCollection) that can exceed Contentful's GraphQL
 * complexity budget and silently return no results on larger collections.
 */

import type { APIRoute } from "astro";
import { apiCall } from "../lib/contentful";
import {
  querySitemapPages,
  querySitemapPosts,
  querySitemapEvents,
  querySitemapExhibits,
  querySitemapVideoGames,
  queryMenuItems,
} from "../lib/contentful/query-builder";
import { getAvailableLocales } from "../lib/contentful/locales";
import { prependBase } from "../lib/helpers";
import type { MenuItem } from "../generated/contentful-types";

interface SlimEntry {
  sys: { id: string; publishedAt?: string };
  slug: string;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

// Batch size for paginated content fetches. Kept modest even though these queries
// are low-complexity (sys + slug only), matching the "safe batch size" pattern
// used elsewhere in the codebase (see EVENTS_SAFE_BATCH_SIZE in lib/contentful.ts).
const BATCH_SIZE = 100;

/**
 * Generic paginated fetch for the minimal sitemap queries above.
 * Loops on `total` returned by Contentful until every entry has been collected.
 */
async function fetchAllSlim(
  collectionKey: string,
  buildQuery: (skip: number, limit: number) => string
): Promise<SlimEntry[]> {
  const items: SlimEntry[] = [];
  let skip = 0;
  let total = Infinity;

  while (skip < total) {
    try {
      const query = buildQuery(skip, BATCH_SIZE);
      const response = await apiCall(query, { skip, limit: BATCH_SIZE });
      const json = await response.json();

      if (json.errors) {
        console.error(
          `[sitemap] GraphQL errors fetching "${collectionKey}" (skip=${skip}):`,
          json.errors
        );
        break;
      }

      const collection = json.data?.[collectionKey];
      if (!collection) break;

      total = typeof collection.total === "number" ? collection.total : 0;
      const batch = (collection.items ?? []) as SlimEntry[];
      items.push(...batch.filter((item) => !!item?.slug));

      if (batch.length === 0) break;
      skip += BATCH_SIZE;
    } catch (error) {
      console.error(
        `[sitemap] Error fetching "${collectionKey}" (skip=${skip}):`,
        error
      );
      break;
    }
  }

  return items;
}

/**
 * Fetch all top-level and nested MenuItems (menus are only nested one level deep).
 */
async function getAllMenuItems(): Promise<MenuItem[]> {
  try {
    const query = queryMenuItems({ limit: 100 });
    const response = await apiCall(query);
    const json = await response.json();

    if (json.errors) {
      console.error(
        "[sitemap] GraphQL errors fetching menu items:",
        json.errors
      );
      return [];
    }

    return json.data?.menuItemCollection?.items || [];
  } catch (error) {
    console.error("[sitemap] Error fetching menu items:", error);
    return [];
  }
}

function formatDate(date: string | null | undefined): string | undefined {
  if (!date) return undefined;
  try {
    return new Date(date).toISOString().split("T")[0];
  } catch {
    return undefined;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSitemapXML(entries: SitemapEntry[]): string {
  const urlEntries = entries
    .map(
      (entry) => `
  <url>
    <loc>${escapeXml(entry.loc)}</loc>${
        entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ""
      }${
        entry.changefreq
          ? `\n    <changefreq>${entry.changefreq}</changefreq>`
          : ""
      }${
        entry.priority !== undefined
          ? `\n    <priority>${entry.priority}</priority>`
          : ""
      }
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Build every localized sitemap entry for a single locale from the already-fetched
 * (locale-agnostic) content graph. Slugs are treated as stable identifiers shared
 * across locales (as the routing layer already assumes - see getPageBySlug etc.),
 * so the same slug list is reused for every locale's URL set.
 */
function buildEntriesForLocale(
  localeShort: string,
  content: {
    pages: SlimEntry[];
    posts: SlimEntry[];
    events: SlimEntry[];
    exhibits: SlimEntry[];
    videoGames: SlimEntry[];
  }
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Locale home page (src/pages/[slug].astro renders Page slug="home" here)
  entries.push({
    loc: `/${localeShort}`,
    changefreq: "daily",
    priority: 1.0,
  });

  // Generic content pages (skip "home" - already represented by the locale root above)
  for (const page of content.pages) {
    if (page.slug === "home") continue;
    entries.push({
      loc: `/${localeShort}/${page.slug}`,
      lastmod: formatDate(page.sys.publishedAt),
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  // Blog index + individual posts
  if (content.posts.length > 0) {
    entries.push({
      loc: `/${localeShort}/blog`,
      changefreq: "daily",
      priority: 0.7,
    });
  }
  for (const post of content.posts) {
    entries.push({
      loc: `/${localeShort}/blog/posts/${post.slug}`,
      lastmod: formatDate(post.sys.publishedAt),
      changefreq: "monthly",
      priority: 0.6,
    });
  }

  // Events
  for (const event of content.events) {
    entries.push({
      loc: `/${localeShort}/event/${event.slug}`,
      lastmod: formatDate(event.sys.publishedAt),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  // Exhibits
  for (const exhibit of content.exhibits) {
    entries.push({
      loc: `/${localeShort}/exhibit/${exhibit.slug}`,
      lastmod: formatDate(exhibit.sys.publishedAt),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  // Video games
  for (const game of content.videoGames) {
    entries.push({
      loc: `/${localeShort}/video_game/${game.slug}`,
      lastmod: formatDate(game.sys.publishedAt),
      changefreq: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}

/**
 * Convert MenuItem hrefs (top-level + one level of children) into locale-prefixed
 * sitemap entries, using the same normalization Navbar.astro uses at render time
 * (prependBase strips any existing locale segment before re-adding the target one).
 */
function buildMenuItemEntries(
  menuItems: MenuItem[],
  localeCode: string
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  const isSkippable = (href: string | undefined): href is undefined =>
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//");

  const addEntry = (href: string | undefined) => {
    if (isSkippable(href)) return;
    entries.push({
      loc: prependBase(href, localeCode),
      changefreq: "monthly",
      priority: 0.5,
    });
  };

  for (const item of menuItems) {
    addEntry(item.href);
    for (const child of item.childrenCollection?.items ?? []) {
      addEntry(child.href);
    }
  }

  return entries;
}

function deduplicateEntries(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    if (!seen.has(entry.loc)) {
      seen.set(entry.loc, entry);
    }
  }
  return Array.from(seen.values());
}

export const GET: APIRoute = async (context) => {
  try {
    // Absolute URL base for every <loc> entry. `context.site` comes from the
    // `site` option in astro.config.ts (the canonical, deployed domain); we fall
    // back to the request's own origin (e.g. localhost during dev) only if that
    // isn't set, so the sitemap always emits full URLs rather than bare paths.
    const siteOrigin = (context.site ?? context.url).origin;

    const locales = await getAvailableLocales();
    if (locales.length === 0) {
      console.error("[sitemap] No locales available");
      return new Response("Error generating sitemap", { status: 500 });
    }

    // Fetch the full content graph once (locale-agnostic; slugs are stable across locales)
    const [pages, posts, events, exhibits, videoGames, menuItems] =
      await Promise.all([
        fetchAllSlim("pageCollection", querySitemapPages),
        fetchAllSlim("postCollection", querySitemapPosts),
        fetchAllSlim("eventCollection", querySitemapEvents),
        fetchAllSlim("exhibitCollection", querySitemapExhibits),
        fetchAllSlim("videoGameCollection", querySitemapVideoGames),
        getAllMenuItems(),
      ]);

    if (import.meta.env.DEV) {
      console.log("[sitemap] Fetched content graph:", {
        pages: pages.length,
        posts: posts.length,
        events: events.length,
        exhibits: exhibits.length,
        videoGames: videoGames.length,
        menuItems: menuItems.length,
      });
    }

    let entries: SitemapEntry[] = [];

    for (const locale of locales) {
      const localeShort = locale.code.split("-")[0];
      entries.push(
        ...buildEntriesForLocale(localeShort, {
          pages,
          posts,
          events,
          exhibits,
          videoGames,
        })
      );
      entries.push(...buildMenuItemEntries(menuItems, locale.code));
    }

    // Convert every internally-built relative path into an absolute URL
    entries = entries.map((entry) => ({
      ...entry,
      loc: new URL(entry.loc, siteOrigin).toString(),
    }));

    entries = deduplicateEntries(entries);
    entries.sort((a, b) => a.loc.localeCompare(b.loc));

    const xml = generateSitemapXML(entries);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "max-age=3600",
      },
    });
  } catch (error) {
    console.error("[sitemap] Error generating sitemap:", error);
    return new Response("Error generating sitemap", { status: 500 });
  }
};
