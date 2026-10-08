import type { APIRoute } from 'astro';
import { getPostBySlug, getBlogPostsPaginated, getBlogPostsCount } from '../../../lib/contentful';

/**
 * API endpoint to fetch a blog post by slug with prev/next navigation
 * GET /api/posts/[slug].json
 * 
 * Returns post data with previous and next post slugs for navigation
 */
export const prerender = false; // Always server-rendered

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
    // Fetch the requested post
    const post = await getPostBySlug(slug);
    
    if (!post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch all posts to determine prev/next
    const totalPosts = await getBlogPostsCount();
    const allPosts = await getBlogPostsPaginated(1, totalPosts);
    
    // Find current post index
    const currentIndex = allPosts.findIndex((p: { slug: string }) => p.slug === slug);
    
    // Get previous and next posts
    const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
    const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

    return new Response(
      JSON.stringify({
        post,
        navigation: {
          prevSlug: prevPost?.slug || null,
          nextSlug: nextPost?.slug || null,
          prevTitle: prevPost?.title || null,
          nextTitle: nextPost?.title || null,
        }
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
    console.error(`[api/posts] Error fetching post "${slug}":`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
