import type { APIRoute } from "astro";
import { getAllEvents } from "../../../lib/contentful";
import type { Event } from "../../../generated/contentful-types";
import { prependBase } from "../../../lib/helpers";

// Prerender this API endpoint at build time
export const prerender = true;

// Page size for pagination
const EVENTS_PER_PAGE = 20;

interface PaginationMetadata {
  category: string;
  page: number;
  totalPages: number;
  firstEventDate: string | null;
  lastEventDate: string | null;
  path: string;
}

interface IndexData {
  categories: {
    [category: string]: {
      totalPages: number;
      pages: PaginationMetadata[];
    };
  };
}

export async function getStaticPaths() {
  try {
    const paths: Array<{ params: { category: string } }> = [];
    
    // Get current build time
    const now = new Date();
    
    // Fetch all events from Contentful
    const allEvents = await getAllEvents();
    
    // Define categories
    const categories = ["upcoming", "running", "past"];
    
    // Process each category to generate paginated paths
    for (const category of categories) {
      // Filter events for this category
      const filteredEvents = filterEventsByCategory(allEvents, category, now);
      
      // Sort by distance from current date (closest first)
      const sortedEvents = sortEventsByDateDistance(filteredEvents, now);
      
      // Calculate number of pages
      const totalPages = Math.max(1, Math.ceil(sortedEvents.length / EVENTS_PER_PAGE));
      
      // Generate paths for each page
      for (let page = 1; page <= totalPages; page++) {
        paths.push({
          params: { category: `${category}-${page}` }
        });
      }
    }
    
    // Add index path
    paths.push({ params: { category: "index" } });
    
    return paths;
  } catch (error) {
    console.error("Error generating static paths:", error);
    return [];
  }
}

function filterEventsByCategory(events: Event[], category: string, now: Date): Event[] {
  return events.filter((event: Event) => {
    const startDate = event.startDate ? new Date(event.startDate) : null;
    const endDate = event.endDate ? new Date(event.endDate) : null;

    // Skip events without valid startDate
    if (!startDate || isNaN(startDate.getTime())) {
      return false;
    }

    switch (category) {
      case "upcoming":
        if (!endDate || isNaN(endDate.getTime())) {
          return startDate > now;
        }
        return startDate > now && endDate > now;

      case "running":
        if (!endDate || isNaN(endDate.getTime())) {
          return false;
        }
        return startDate <= now && endDate > now;

      case "past":
        if (!endDate || isNaN(endDate.getTime())) {
          return startDate < now;
        }
        return startDate < now && endDate < now;

      default:
        return false;
    }
  });
}

function sortEventsByDateDistance(events: Event[], now: Date): Event[] {
  return [...events].sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate) : null;
    const dateB = b.startDate ? new Date(b.startDate) : null;
    
    if (!dateA || isNaN(dateA.getTime())) return 1;
    if (!dateB || isNaN(dateB.getTime())) return -1;
    
    // Calculate distance from now (absolute value)
    const distanceA = Math.abs(dateA.getTime() - now.getTime());
    const distanceB = Math.abs(dateB.getTime() - now.getTime());
    
    return distanceA - distanceB;
  });
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const categoryParam = params?.category;
    
    if (!categoryParam) {
      return new Response(
        JSON.stringify({ error: "Category parameter is required" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Handle index request
    if (categoryParam === "index") {
      return handleIndexRequest();
    }

    // Parse category and page from param (e.g., "upcoming-1", "running-2")
    const match = categoryParam.match(/^(upcoming|running|past)-(\d+)$/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Invalid category format. Expected 'category-page' (e.g., 'upcoming-1')" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const category = match[1];
    const page = parseInt(match[2], 10);

    if (!["upcoming", "running", "past"].includes(category)) {
      return new Response(
        JSON.stringify({ error: "Invalid category. Must be 'upcoming', 'running', or 'past'" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get current build time
    const now = new Date();

    // Fetch all events from Contentful
    const allEvents = await getAllEvents();

    // Filter and sort events
    const filteredEvents = filterEventsByCategory(allEvents, category, now);
    const sortedEvents = sortEventsByDateDistance(filteredEvents, now);

    // Calculate pagination
    const totalPages = Math.max(1, Math.ceil(sortedEvents.length / EVENTS_PER_PAGE));
    
    if (page < 1 || page > totalPages) {
      return new Response(
        JSON.stringify({ error: `Page ${page} is out of range. Total pages: ${totalPages}` }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get events for this page
    const startIndex = (page - 1) * EVENTS_PER_PAGE;
    const endIndex = startIndex + EVENTS_PER_PAGE;
    const pageEvents = sortedEvents.slice(startIndex, endIndex);

    // Return the paginated events
    return new Response(
      JSON.stringify({
        items: pageEvents,
        total: sortedEvents.length,
        page,
        totalPages,
        category
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

async function handleIndexRequest(): Promise<Response> {
  try {
    const now = new Date();
    const allEvents = await getAllEvents();
    
    const categories = ["upcoming", "running", "past"];
    const indexData: IndexData = {
      categories: {}
    };

    for (const category of categories) {
      const filteredEvents = filterEventsByCategory(allEvents, category, now);
      const sortedEvents = sortEventsByDateDistance(filteredEvents, now);
      const totalPages = Math.max(1, Math.ceil(sortedEvents.length / EVENTS_PER_PAGE));

      const pages: PaginationMetadata[] = [];

      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * EVENTS_PER_PAGE;
        const endIndex = startIndex + EVENTS_PER_PAGE;
        const pageEvents = sortedEvents.slice(startIndex, endIndex);

        // Get first and last event dates for this page
        const firstEvent = pageEvents[0];
        const lastEvent = pageEvents[pageEvents.length - 1];
        
        const firstEventDate = firstEvent?.startDate || null;
        const lastEventDate = lastEvent?.startDate || null;

        // Generate path with basepath
        const path = prependBase(`/api/events/${category}-${page}.json`);

        pages.push({
          category,
          page,
          totalPages,
          firstEventDate,
          lastEventDate,
          path
        });
      }

      indexData.categories[category] = {
        totalPages,
        pages
      };
    }

    return new Response(
      JSON.stringify(indexData),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error generating index:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

