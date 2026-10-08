/**
 * Robots.txt generator for Astro
 * Provides indexing instructions for search engine crawlers
 */

import type { APIRoute } from "astro";

export const GET: APIRoute = (context) => {
  // Prefer the canonical domain configured via `site` in astro.config.ts, falling
  // back to the request's own origin (e.g. localhost during dev) if that isn't set.
  const siteOrigin = (context.site ?? context.url).origin;
  const sitemapUrl = new URL("/sitemap.xml", siteOrigin).href;

  const robotsTxt = `# https://www.robotstxt.org/
User-agent: *
Allow: /

# Disallow admin and private paths
Disallow: /admin/
Disallow: /.well-known/

# Sitemap reference
Sitemap: ${sitemapUrl}
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "max-age=86400", // Cache for 24 hours
    },
  });
};
