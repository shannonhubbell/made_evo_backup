import { getByQuery } from "../lib/contentful";
import { prependBase, getBaseUrl } from "../lib/helpers";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { Page, Event, Post } from "../generated/contentful-types";

// Example RSS format for reference:
/*
let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Blog</title>
    <link>http://www.example.com/</link>
    <description>This is an example blog RSS feed 2.</description>
    <language>en-us</language>
    <lastBuildDate>Mon, 01 Jul 2024 12:00:00 GMT</lastBuildDate>
    <pubDate>Mon, 01 Jul 2024 12:00:00 GMT</pubDate>
    <generator>Custom RSS Generator</generator>
    <item>
      <title>Foo</title>
      <link>http://localhost:4321/blog/5</link>
      <guid isPermaLink="true">http://localhost:4321/blog/5</guid>
      <pubDate>Mon, 09 Jul 2024 12:00:00 GMT</pubDate>
      <description><![CDATA[
        <p>We just modified a page</p>
      ]]></description>
      <author>editor@example.com (Editor Name)</author>
      <category>General</category>
    </item>
  </channel>
</rss>
`
*/

/**
 * Format a date string to RFC 822 format for RSS feeds
 */
function formatRSSDate(dateString: string | undefined): string {
  if (!dateString) return new Date().toUTCString();
  const date = new Date(dateString);
  return date.toUTCString();
}

/**
 * Format a date string to RFC 822 format (e.g., "Mon, 01 Jul 2024 12:00:00 GMT")
 */
function formatRFC822(dateString: string | undefined): string {
  if (!dateString) {
    const now = new Date();
    return now.toUTCString().replace(/GMT$/, "GMT");
  }
  const date = new Date(dateString);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = days[date.getUTCDay()];
  const month = months[date.getUTCMonth()];
  const dayNum = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate RSS feed from Contentful content
 */
export async function GET(context: any) {
  // Prefer the canonical domain configured via `site` in astro.config.ts, falling
  // back to the request's own origin (e.g. localhost during dev) if that isn't set.
  // Computed outside the try block so the error-fallback feed below can use it too.
  const siteOrigin: string =
    (context.site ?? context.url)?.origin ?? "https://www.themade.org";

  const toAbsoluteUrl = (path: string): string =>
    new URL(path, siteOrigin).toString();

  try {
    const siteUrl = toAbsoluteUrl(getBaseUrl());

    // Query Pages
    const pagesQuery = `
      {
        pageCollection(limit: 20, order: sys_publishedAt_DESC) {
          items {
            sys {
              id
              publishedAt
            }
            title
            slug
            description
          }
        }
      }
    `;

    // Query Events
    const eventsQuery = `
      {
        eventCollection(limit: 20, order: sys_publishedAt_DESC) {
          items {
            sys {
              id
              publishedAt
            }
            title
            slug
            description
            startDate
          }
        }
      }
    `;

    // Query Posts with blog tag
    const blogPostsQuery = `
      {
        postCollection(
          where: { contentfulMetadata: { tags: { id_contains_some: ["blog"] } } },
          limit: 20,
          order: sys_publishedAt_DESC
        ) {
          items {
            sys {
              id
              publishedAt
            }
            title
            slug
            description
            content {
              json
            }
          }
        }
      }
    `;

    // Fetch all content
    const [pagesData, eventsData, postsData] = await Promise.all([
      getByQuery(pagesQuery),
      getByQuery(eventsQuery),
      getByQuery(blogPostsQuery),
    ]);

    // Combine and format items
    interface RSSItem {
      title: string;
      link: string;
      guid: string;
      pubDate: string;
      description: string;
      category: string;
      publishedAt: string | undefined;
    }

    const items: RSSItem[] = [];
    const locale = (context as any).locals?.locale ?? "en-US";

    // Add Pages
    if (pagesData?.pageCollection?.items) {
      pagesData.pageCollection.items.forEach((page: Page) => {
        items.push({
          title: page.title || page.name || "Untitled Page",
          link: toAbsoluteUrl(prependBase(`/${page.slug || ""}`, locale)),
          guid: toAbsoluteUrl(prependBase(`/${page.slug || ""}`, locale)),
          pubDate: formatRFC822(page.sys?.publishedAt),
          description: page.title || page.name || "Page update",
          category: "Page",
          publishedAt: page.sys?.publishedAt,
        });
      });
    }

    // Add Events
    if (eventsData?.eventCollection?.items) {
      eventsData.eventCollection.items.forEach((event: Event) => {
        items.push({
          title: event.title || event.name || "Untitled Event",
          link: toAbsoluteUrl(
            prependBase(`/event/${event.slug || ""}`, locale)
          ),
          guid: toAbsoluteUrl(
            prependBase(`/event/${event.slug || ""}`, locale)
          ),
          pubDate: formatRFC822(event.sys?.publishedAt),
          description: event.description || "",
          category: "Event",
          publishedAt: event.sys?.publishedAt,
        });
      });
    }

    // Add Blog Posts
    if (postsData?.postCollection?.items) {
      postsData.postCollection.items.forEach((post: Post) => {
        const contentHtml = post.content?.json
          ? documentToHtmlString(post.content.json)
          : "";
        const description =
          post.description || contentHtml.substring(0, 200) + "...";

        items.push({
          title: post.title || "Untitled Post",
          link: toAbsoluteUrl(
            prependBase(`/blog/posts/${post.slug || ""}`, locale)
          ),
          guid: toAbsoluteUrl(
            prependBase(`/blog/posts/${post.slug || ""}`, locale)
          ),
          pubDate: formatRFC822(post.sys?.publishedAt),
          description: description,
          category: "Blog Post",
          publishedAt: post.sys?.publishedAt,
        });
      });
    }

    // Sort by publishedAt (most recent first) and take top 10
    items.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    const latestItems = items.slice(0, 10);

    // Get the most recent publishedAt for lastBuildDate
    const lastBuildDate =
      latestItems.length > 0 && latestItems[0].publishedAt
        ? formatRFC822(latestItems[0].publishedAt)
        : formatRFC822(undefined);

    // Generate RSS XML
    const rssItems = latestItems
      .map((item) => {
        return `    <item>
      <title>${escapeXML(item.title)}</title>
      <link>${escapeXML(item.link)}</link>
      <guid isPermaLink="true">${escapeXML(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[
        ${item.description}
      ]]></description>
      <category>${escapeXML(item.category)}</category>
    </item>`;
      })
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MADE Updates</title>
    <link>${escapeXML(siteUrl)}</link>
    <description>Latest updates from the Museum of Art and Digital Entertainment</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${lastBuildDate}</pubDate>
    <generator>MADE RSS Generator</generator>
${rssItems}
  </channel>
</rss>`;

    const response = new Response(rss);
    response.headers.set("Content-Type", "application/rss+xml");
    return response;
  } catch (error) {
    console.error("Error generating RSS feed:", error);
    // Return empty RSS feed on error
    const errorRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MADE Updates</title>
    <link>${escapeXML(siteOrigin)}</link>
    <description>Latest updates from the Museum of Art and Digital Entertainment</description>
    <language>en-us</language>
    <lastBuildDate>${formatRFC822(undefined)}</lastBuildDate>
  </channel>
</rss>`;
    const response = new Response(errorRSS);
    response.headers.set("Content-Type", "application/rss+xml");
    return response;
  }
}
