// Example: Using results from one GraphQL query to filter another query

import { getByQuery, getByQueryAndVariables } from "./src/lib/contentful";

// ============================================
// APPROACH 1: Sequential Queries
// ============================================
// First query gets IDs, then use those IDs in a second query

export async function exampleSequentialQueries() {
  // Step 1: Query to get program IDs that match certain criteria
  const firstQuery = `
    {
      programCollection(where: { isActive: true }, limit: 10) {
        items {
          sys {
            id
          }
          title
        }
      }
    }
  `;

  const firstResult = await getByQuery(firstQuery);
  const programIds = firstResult.programCollection.items.map(
    (item: { sys: { id: string } }) => item.sys.id
  );

  // Step 2: Use those IDs to filter events related to those programs
  // Using id_contains_some to filter by multiple IDs
  const secondQuery = `
    {
      eventCollection(
        where: { 
          program: { 
            sys: { 
              id_in: ${JSON.stringify(programIds)} 
            } 
          } 
        }
      ) {
        items {
          title
          startDate
          program {
            title
          }
        }
      }
    }
  `;

  const secondResult = await getByQuery(secondQuery);
  return secondResult.eventCollection.items;
}

// ============================================
// APPROACH 2: Using Variables (More Efficient)
// ============================================
// Pass IDs as variables to avoid string interpolation issues

export async function exampleWithVariables() {
  // Step 1: Get the IDs
  const firstQuery = `
    {
      programCollection(where: { isActive: true }, limit: 10) {
        items {
          sys {
            id
          }
        }
      }
    }
  `;

  const firstResult = await getByQuery(firstQuery);
  const programIds = firstResult.programCollection.items.map(
    (item: { sys: { id: string } }) => item.sys.id
  );

  // Step 2: Use variables in the second query
  const secondQuery = `
    query GetEventsByPrograms($programIds: [String!]!) {
      eventCollection(
        where: { 
          program: { 
            sys: { 
              id_in: $programIds 
            } 
          } 
        }
      ) {
        items {
          title
          startDate
          program {
            title
          }
        }
      }
    }
  `;

  const secondResult = await getByQueryAndVariables(
    secondQuery,
    ["programIds"],
    [JSON.stringify(programIds)]
  );

  return secondResult.eventCollection.items;
}

// ============================================
// APPROACH 3: Using Tags from First Query
// ============================================
// Get tags from posts, then find other posts with same tags

export async function exampleWithTags() {
  // Step 1: Get a post and its tags
  const firstQuery = `
    {
      postCollection(where: { sys: { id: "some-post-id" } }, limit: 1) {
        items {
          contentfulMetadata {
            tags {
              id
              name
            }
          }
        }
      }
    }
  `;

  const firstResult = await getByQuery(firstQuery);
  const tags = firstResult.postCollection.items[0].contentfulMetadata.tags;
  const tagIds = tags.map((tag: { id: string }) => tag.id);

  // Step 2: Find other posts with the same tags
  const secondQuery = `
    {
      postCollection(
        where: { 
          contentfulMetadata: { 
            tags: { 
              id_contains_some: ${JSON.stringify(tagIds)} 
            } 
          } 
        }
      ) {
        items {
          title
          contentfulMetadata {
            tags {
              id
              name
            }
          }
        }
      }
    }
  `;

  const secondResult = await getByQuery(secondQuery);
  return secondResult.postCollection.items;
}

// ============================================
// APPROACH 4: Nested Query (Single Request) - CONTENTFUL SPECIFIC
// ============================================
// Contentful supports linkedFrom for reverse references, but filtering is limited

export async function exampleNestedInOneQuery() {
  // Contentful supports linkedFrom to get reverse references
  // However, you CANNOT filter linkedFrom collections with where clauses
  // This will get ALL events linked to the programs, not filtered ones
  const query = `
    {
      programCollection(where: { isActive: true }, limit: 10) {
        items {
          sys {
            id
          }
          title
          # Get events that reference this program (reverse reference)
          # NOTE: Cannot use 'where' clause on linkedFrom collections
          linkedFrom {
            eventCollection {
              items {
                title
                startDate
                # You can filter the linkedFrom results in your code after fetching
              }
            }
          }
        }
      }
    }
  `;

  const result = await getByQuery(query);
  
  // You'd need to filter in code after fetching
  const programsWithFilteredEvents = result.programCollection.items.map((program: any) => {
    const events = program.linkedFrom?.eventCollection?.items || [];
    // Filter events in code (e.g., only future events)
    const filteredEvents = events.filter((event: any) => {
      return new Date(event.startDate) > new Date();
    });
    return {
      ...program,
      events: filteredEvents
    };
  });
  
  return programsWithFilteredEvents;
}

// ============================================
// APPROACH 5: Filtering Nested Collections (Contentful Limitation)
// ============================================
// Contentful DOES support where clauses on nested collections, but only for direct references
// You CAN filter nested collections that are direct references (not reverse references)

export async function exampleFilterNestedDirectReference() {
  // This WORKS: Filtering a direct reference collection
  const query = `
    {
      programCollection(where: { isActive: true }, limit: 10) {
        items {
          sys {
            id
          }
          title
          # If 'events' is a direct reference field on Program, you CAN filter it
          # eventsCollection(where: { startDate_gte: "2024-01-01" }) {
          #   items {
          #     title
          #     startDate
          #   }
          # }
        }
      }
    }
  `;

  // NOTE: The above pattern only works if:
  // 1. The relationship is a direct reference (not reverse via linkedFrom)
  // 2. Contentful schema supports filtering on that nested collection
  // 3. You need to check your Contentful schema to see what's available
}

// ============================================
// REAL-WORLD EXAMPLE: Get events for programs in a category
// ============================================
// This REQUIRES two queries because Contentful doesn't support filtering
// linkedFrom collections or using parent query results in nested where clauses

export async function getEventsForActivePrograms() {
  // Step 1: Find all active programs
  const programsQuery = `
    {
      programCollection(where: { isActive: true }) {
        items {
          sys {
            id
          }
          title
        }
      }
    }
  `;

  const programsData = await getByQuery(programsQuery);
  const programIds = programsData.programCollection.items.map(
    (item: { sys: { id: string } }) => item.sys.id
  );

  if (programIds.length === 0) {
    return [];
  }

  // Step 2: Get events for those programs
  // Note: Contentful's id_in filter expects an array
  const eventsQuery = `
    query GetEvents($programIds: [String!]!) {
      eventCollection(
        where: { 
          program: { 
            sys: { 
              id_in: $programIds 
            } 
          } 
        },
        order: startDate_ASC
      ) {
        items {
          title
          startDate
          endDate
          program {
            title
          }
        }
      }
    }
  `;

  const eventsData = await getByQueryAndVariables(
    eventsQuery,
    ["programIds"],
    [JSON.stringify(programIds)]
  );

  return eventsData.eventCollection.items;
}

// ============================================
// CONTENTFUL API LIMITATIONS SUMMARY
// ============================================
/*
 * Contentful GraphQL API Limitations:
 * 
 * 1. ✅ CAN filter direct reference collections with where clauses
 *    Example: program.eventsCollection(where: { ... })
 * 
 * 2. ❌ CANNOT filter linkedFrom (reverse reference) collections with where
 *    Example: program.linkedFrom.eventCollection(where: { ... }) - NOT SUPPORTED
 * 
 * 3. ❌ CANNOT use parent query results in nested where clauses dynamically
 *    You cannot do: programCollection { items { events(where: { programId: parent.id }) } }
 * 
 * 4. ✅ CAN use variables to pass arrays for id_in filters
 *    This is the recommended approach for filtering by multiple IDs
 * 
 * 5. ✅ CAN nest queries but filtering is limited to direct references
 * 
 * RECOMMENDATION: Use Approach 2 (Variables) for most cases where you need
 * to filter based on results from another query. It's the most reliable and
 * performant approach with Contentful's API.
 */

