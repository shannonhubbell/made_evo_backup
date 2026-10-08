import type { APIRoute } from 'astro';
import { getEventBySlug, getAllEvents } from '../../../lib/contentful';

/**
 * API endpoint to fetch an event by slug with prev/next navigation
 * GET /api/events/[slug].json
 * 
 * Returns event data with previous and next event slugs for navigation
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
    // Fetch the requested event
    const event = await getEventBySlug(slug);
    
    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch all events to determine prev/next
    const allEvents = await getAllEvents();
    
    // Find current event index
    const currentIndex = allEvents.findIndex((e: { slug: string }) => e.slug === slug);
    
    // Get previous and next events
    const prevEvent = currentIndex < allEvents.length - 1 ? allEvents[currentIndex + 1] : null;
    const nextEvent = currentIndex > 0 ? allEvents[currentIndex - 1] : null;

    return new Response(
      JSON.stringify({
        event,
        navigation: {
          prevSlug: prevEvent?.slug || null,
          nextSlug: nextEvent?.slug || null,
          prevTitle: prevEvent?.title || null,
          nextTitle: nextEvent?.title || null,
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
    console.error(`[api/events] Error fetching event "${slug}":`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
