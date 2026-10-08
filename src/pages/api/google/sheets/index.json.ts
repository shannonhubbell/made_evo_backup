/**
 * SpreadsheetForm index – lists all SpreadsheetForm entries from Contentful
 *
 * GET /api/google/sheets/index.json
 * Returns all SpreadsheetForms with id, name, slug for discovery.
 */

import type { APIRoute } from 'astro';
import { getSpreadsheetForms } from '../../../../lib/contentful';
import { adaptSpreadsheetForm } from '../../../../lib/adapters/spreadsheet-form';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const entries = await getSpreadsheetForms();
    const items = entries
      .map((e) => adaptSpreadsheetForm(e))
      .filter((x): x is NonNullable<typeof x> => x != null);

    return new Response(
      JSON.stringify({ items }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[api/google/sheets/index] Error:', err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: import.meta.env.DEV ? err.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
