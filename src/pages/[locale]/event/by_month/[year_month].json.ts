import type { APIRoute } from "astro";
import type { Event } from "../../../../generated/contentful-types";
import { getAllEvents, bucketEventsByMonth } from "../../../../lib/contentful";
import { getAvailableLocales } from "../../../../lib/contentful/locales";

// Pre-generated at build time, one file per locale/month that currently has events -
// rebuilds are triggered by a Contentful/Eventbrite webhook whenever event data changes,
// so these blobs only need to be as fresh as the last build.
export const prerender = true;

export async function getStaticPaths() {
  const [allEvents, locales] = await Promise.all([
    getAllEvents(),
    getAvailableLocales(),
  ]);

  const eventsByMonth = bucketEventsByMonth(allEvents);

  // Site routes use the short locale segment (e.g. "en", "es"), matching prependBase()
  const localeCodes = [...new Set(locales.map((locale) => locale.code.split("-")[0]))];

  // Only generate a blob for locale/month combinations that currently have events
  return localeCodes.flatMap((locale) =>
    Array.from(eventsByMonth.entries()).map(([yearMonth, items]) => ({
      params: { locale, year_month: yearMonth },
      props: { items },
    }))
  );
}

export const GET: APIRoute = async ({ params, props }) => {
  const [year, month] = params.year_month!.split("-").map(Number);
  const items = props.items as Event[];

  return new Response(JSON.stringify({ year, month, items }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
