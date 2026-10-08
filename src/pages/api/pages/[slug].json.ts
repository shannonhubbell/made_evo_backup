import type { APIRoute } from 'astro';
import { getPageBySlug } from '../../../lib/contentful';

/**
 * API endpoint to fetch a page by slug
 * GET /api/pages/[slug].json
 * 
 * Returns page data for on-demand rendering
 */
export const prerender = false; // Always server-rendered

export const GET: APIRoute = async ({ params, url, locals }) => {
  const slug = params?.slug;
  
  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Slug parameter is required' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Get locale from query parameter or locals (set by middleware)
  const urlObj = new URL(url);
  const locale = urlObj.searchParams.get('locale') || locals.locale || 'en-US';

  try {
    const page = await getPageBySlug(slug, locale);
    
    if (!page) {
      return new Response(
        JSON.stringify({ error: 'Page not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify(page),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300' // Cache for 1 min, CDN for 5 min
        }
      }
    );
  } catch (error) {
    console.error(`[api/pages] Error fetching page "${slug}":`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
