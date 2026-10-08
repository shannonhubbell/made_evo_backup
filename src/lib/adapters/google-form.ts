/**
 * GoogleForm adapter – transforms Contentful GoogleForm into a JSON blob
 * for API consumption. Used for native Google Forms embedding.
 */

import type { GoogleForm } from '../../generated/contentful-types';

export interface GoogleFormData {
  id: string;
  name?: string;
  slug?: string;
  formId?: string;
  publishedAt?: string;
  /** Embed URL for iframe: docs.google.com/forms/d/e/{formId}/viewform?embedded=true */
  embedUrl?: string;
}

/**
 * Adapts a Contentful GoogleForm entry to a clean JSON structure.
 */
export function adaptGoogleForm(entry: GoogleForm | null): GoogleFormData | null {
  if (!entry) return null;

  const formId = entry.formId?.trim();
  const embedUrl =
    formId && !formId.startsWith('http')
      ? `https://docs.google.com/forms/d/e/${formId}/viewform?embedded=true`
      : formId || undefined;

  return {
    id: entry.sys.id,
    name: entry.name,
    slug: entry.slug,
    formId: formId || undefined,
    publishedAt: entry.sys.publishedAt,
    embedUrl,
  };
}
