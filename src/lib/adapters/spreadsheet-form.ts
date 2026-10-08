/**
 * SpreadsheetForm adapter – transforms Contentful SpreadsheetForm into a JSON blob
 * for API consumption.
 */

import type { SpreadsheetForm } from '../../generated/contentful-types';

export interface SpreadsheetFormData {
  id: string;
  name?: string;
  slug?: string;
  spreadsheetId?: string;
  tableName?: string;
  publishedAt?: string;
}

/**
 * Adapts a Contentful SpreadsheetForm entry to a clean JSON structure.
 */
export function adaptSpreadsheetForm(entry: SpreadsheetForm | null): SpreadsheetFormData | null {
  if (!entry) return null;

  return {
    id: entry.sys.id,
    name: entry.name,
    slug: entry.slug,
    spreadsheetId: entry.spreadsheetId,
    tableName: entry.tableName,
    publishedAt: entry.sys.publishedAt,
  };
}
