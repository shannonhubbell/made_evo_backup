/**
 * Google Form API – returns form schema with field types for custom form rendering
 *
 * GET /api/google/forms/[slug].json
 * Fetches GoogleForm from Contentful + form structure from Google Forms API.
 * Returns: { id, name, slug, formId, embedUrl, fields: [{ id, title, type, required, options? }] }
 */

import type { APIRoute } from 'astro';
import { getGoogleFormBySlug } from '../../../../lib/contentful';
import { adaptGoogleForm } from '../../../../lib/adapters/google-form';
import { fetchFormStructure } from '../../../../lib/google-forms';

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
    const entry = await getGoogleFormBySlug(slug);
    const data = adaptGoogleForm(entry);

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'GoogleForm not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let fields: { id: string; title: string; type: string; required?: boolean; options?: { value: string; label: string }[]; min?: number; max?: number; lowLabel?: string; highLabel?: string }[] = [];
    let requiresEmail = false;
    if (data.formId) {
      const structure = await fetchFormStructure(context, data.formId);
      if (structure?.fields?.length) {
        fields = structure.fields;
        requiresEmail = structure.requiresEmail ?? false;
      }
    }

    const payload = { ...data, fields, requiresEmail };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[api/google/forms] Error fetching GoogleForm "${slug}":`, err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: import.meta.env.DEV ? err.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
