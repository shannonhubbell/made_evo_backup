import type { APIRoute } from "astro";
import { getAllEvents, bucketEventsByMonth } from "../../../../lib/contentful";
import { getAvailableLocales } from "../../../../lib/contentful/locales";

// Pre-generated at build time alongside the by_month/[year_month].json blobs -
// rebuilds are triggered by a Contentful/Eventbrite webhook, so this list only needs to
// be as fresh as the last build. Lets the calendar check up front which months actually
// have a generated blob, so it never has to speculatively fetch a month and handle a 404.
export const prerender = true;

export async function getStaticPaths() {
  const locales = await getAvailableLocales();
  const localeCodes = [...new Set(locales.map((locale) => locale.code.split("-")[0]))];
  return localeCodes.map((locale) => ({ params: { locale } }));
}

export const GET: APIRoute = async () => {
  const allEvents = await getAllEvents();
  const months = Array.from(bucketEventsByMonth(allEvents).keys()).sort();

  return new Response(JSON.stringify({ months }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
