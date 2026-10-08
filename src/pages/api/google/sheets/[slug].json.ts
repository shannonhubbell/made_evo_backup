/**
 * SpreadsheetForm API – returns form schema for GoogleSheetForm.vue
 *
 * GET /api/google/sheets/[slug].json
 * Fetches SpreadsheetForm from Contentful, then the first row from the Google Sheet
 * to use as field labels. Returns a structure suitable for GoogleSheetForm.vue.
 */

import type { APIRoute } from 'astro';
import { getSpreadsheetForms } from '../../../../lib/contentful';
import { adaptSpreadsheetForm } from '../../../../lib/adapters/spreadsheet-form';
import { fetchFirstRow } from '../../../../lib/google-sheets';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const slug = context.params?.slug;

  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Slug parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const entries = await getSpreadsheetForms();

    // "index" returns all (for /api/google/sheets/index.json when routed here)
    if (slug.toLowerCase() === 'index') {
      const items = entries
        .map((e) => adaptSpreadsheetForm(e))
        .filter((x): x is NonNullable<typeof x> => x != null);
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    const entry = entries.find((e) => (e.slug ?? '').toLowerCase() === slug.toLowerCase()) ?? null;
    const formData = adaptSpreadsheetForm(entry);

    if (!formData) {
      return new Response(
        JSON.stringify({ error: 'SpreadsheetForm not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const fields: { key: string; label: string }[] = [];
    if (formData.spreadsheetId) {
      const labels = await fetchFirstRow(
        context,
        formData.spreadsheetId,
        formData.tableName ?? undefined
      );
      fields.push(
        ...labels.map((label, i) => ({
          key: `col${i}`,
          label: label || `Field ${i + 1}`,
        }))
      );
    }

    const payload = {
      id: formData.id,
      name: formData.name,
      slug: formData.slug,
      spreadsheetId: formData.spreadsheetId,
      tableName: formData.tableName,
      fields,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[api/google/sheets] Error fetching SpreadsheetForm "${slug}":`, err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: import.meta.env.DEV ? err.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
