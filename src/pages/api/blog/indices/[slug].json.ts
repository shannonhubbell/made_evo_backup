import type { APIRoute } from 'astro';
import { getBlogPostsCount } from '../../../../lib/contentful';

/**
 * API endpoint to fetch blog index page data
 * GET /api/blog/indices/[slug].json
 * 
 * Returns pagination data for blog index pages
 */
export const prerender = false; // Always server-rendered

const POSTS_PER_PAGE = 10;

export const GET: APIRoute = async ({ params }) => {
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

  try {
    const pageNumber = parseInt(slug, 10);
    
    if (isNaN(pageNumber) || pageNumber < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid page number' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const totalPosts = await getBlogPostsCount();
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    
    if (pageNumber > totalPages) {
      return new Response(
        JSON.stringify({ error: 'Page not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        page: pageNumber,
        postsPerPage: POSTS_PER_PAGE,
        totalPosts,
        totalPages,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300' // Cache for 1 min, CDN for 5 min
        }
      }
    );
  } catch (error) {
    console.error(`[api/blog/indices] Error fetching index page "${slug}":`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
