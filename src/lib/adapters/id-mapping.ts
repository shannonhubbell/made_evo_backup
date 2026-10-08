/**
 * Adapter ID Mapping
 *
 * Maps Contentful DataAdapter entry **names** to stable adapter IDs.
 * We assume Contentful adapter names are unique and use them as the key
 * for lookup (easier to debug than UUIDs). Code continues to use stableId.
 */

import { getAllAdapters } from './registry';

/**
 * Map of Contentful adapter name → stable adapter ID
 * Built from the adapter registry (single source of truth).
 * Use this to resolve adapter data from Contentful (by name) to our adapters.
 */
export const nameToStableId: Record<string, string> = Object.fromEntries(
  getAllAdapters().map((a) => [a.contentfulName, a.id])
);

/**
 * Get stable adapter ID from Contentful adapter name
 */
export function getStableAdapterIdFromName(contentfulName: string): string | undefined {
  return nameToStableId[contentfulName];
}
