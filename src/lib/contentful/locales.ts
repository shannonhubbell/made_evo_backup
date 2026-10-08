/**
 * Contentful Locale Utilities
 * 
 * Provides functions to work with Contentful locales, including fetching
 * available locales and determining the current locale from requests.
 */

import { getSecret } from "astro:env/server";
import { apiCall } from "../contentful";

export interface ContentfulLocale {
  code: string;
  name: string;
  default: boolean;
  fallbackCode?: string;
}

// Cache for locales (populated at build time or first request)
let cachedLocales: ContentfulLocale[] | null = null;
let localeCachePromise: Promise<ContentfulLocale[]> | null = null;

/**
 * Get environment variables (same pattern as contentful.ts)
 */
function getEnvVar(key: string): string | undefined {
  try {
    const astroGlobal = (globalThis as any).Astro;
    if (astroGlobal?.locals) {
      const locals = astroGlobal.locals;
      if (locals?.runtimeEnv?.[key]) {
        return locals.runtimeEnv[key];
      }
      if (locals?.runtime?.env?.[key]) {
        return locals.runtime.env[key];
      }
    }
  } catch (e) {
    // Astro not available - continue
  }
  
  try {
    const secretValue = getSecret(key);
    if (secretValue) {
      return secretValue;
    }
  } catch (e) {
    // getSecret might not be available
  }
  
  const metaEnvValue = import.meta.env[key];
  if (metaEnvValue) {
    return metaEnvValue;
  }
  
  return undefined;
}

/**
 * Fetch all available locales from Contentful using GraphQL
 * Uses Delivery API (works in both build-time and runtime)
 */
async function fetchLocalesFromContentful(): Promise<ContentfulLocale[]> {
  const space = getEnvVar('CONTENTFUL_SPACE_ID');
  const deliveryToken = getEnvVar('CONTENTFUL_DELIVERY_TOKEN');
  const environment = getEnvVar('CONTENTFUL_ENVIRONMENT') || 'master';
  
  if (!space || !deliveryToken) {
    console.warn('[locales] Missing Contentful credentials, returning default locale');
    return [{ code: 'en-US', name: 'English (United States)', default: true }];
  }

  // Use GraphQL to query locales metadata
  // Note: Contentful GraphQL doesn't directly expose locales, so we'll use a workaround
  // by querying the space metadata or using the Management API approach
  
  // For now, we'll use a simpler approach: try to fetch via Management API if available
  // Otherwise, we'll use a hardcoded list or query via Delivery API
  
  // Try Management API first (for build-time and runtime)
  const managementToken = getEnvVar('CONTENTFUL_MANAGEMENT_TOKEN');
  if (managementToken) {
    try {
      const url = `https://api.contentful.com/spaces/${space}/environments/${environment}/locales`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const locales = (data.items || []).map((item: any) => ({
          code: item.code,
          name: item.name,
          default: item.default || false,
          fallbackCode: item.fallbackCode || undefined,
        }));
        
        if (locales.length > 0) {
          if (import.meta.env.DEV) {
            console.log(`[locales] Successfully fetched ${locales.length} locales from Contentful:`, locales.map(l => l.code).join(', '));
          }
          return locales;
        } else {
          console.warn('[locales] Management API returned empty locales array');
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[locales] Management API error (${response.status}):`, errorText);
      }
    } catch (error) {
      console.error('[locales] Failed to fetch via Management API:', error);
    }
  } else {
    console.warn('[locales] CONTENTFUL_MANAGEMENT_TOKEN not available, cannot fetch locales from Management API');
  }

  // Fallback: return default locale
  console.warn('[locales] Falling back to default locale (en-US). Make sure CONTENTFUL_MANAGEMENT_TOKEN is set in Cloudflare environment variables.');
  return [{ code: 'en-US', name: 'English (United States)', default: true }];
}

/**
 * Get all available locales from Contentful
 * Caches the result to avoid repeated API calls
 */
export async function getAvailableLocales(): Promise<ContentfulLocale[]> {
  // Return cached value if available
  if (cachedLocales) {
    return cachedLocales;
  }

  // If a fetch is already in progress, wait for it
  if (localeCachePromise) {
    return localeCachePromise;
  }

  // Start fetching
  localeCachePromise = fetchLocalesFromContentful().then(locales => {
    cachedLocales = locales;
    return locales;
  }).catch(error => {
    console.error('[locales] Error fetching locales:', error);
    // Return default on error
    const defaults = [{ code: 'en-US', name: 'English (United States)', default: true }];
    cachedLocales = defaults;
    return defaults;
  });

  return localeCachePromise;
}

/**
 * Get the default locale code
 */
export async function getDefaultLocale(): Promise<string> {
  const locales = await getAvailableLocales();
  const defaultLocale = locales.find(l => l.default);
  return defaultLocale?.code || 'en-US';
}

/**
 * Get fallback locale for a given locale
 */
export async function getLocaleFallback(locale: string): Promise<string> {
  const locales = await getAvailableLocales();
  const localeInfo = locales.find(l => l.code === locale);
  
  if (localeInfo?.fallbackCode) {
    return localeInfo.fallbackCode;
  }
  
  // Default fallback to default locale
  return await getDefaultLocale();
}

/**
 * Check if a locale code is valid (exists in Contentful)
 */
export async function isValidLocale(locale: string): Promise<boolean> {
  const locales = await getAvailableLocales();
  return locales.some(l => l.code === locale);
}

/**
 * Extract locale from URL path
 * Supports patterns like: /en/page-slug, /es/page-slug
 * Returns the locale code if found, null otherwise
 * Note: This is now async because it needs to check Contentful for locale codes
 */
export async function extractLocaleFromPath(pathname: string): Promise<{ locale: string | null; pathWithoutLocale: string }> {
  const segments = pathname.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return { locale: null, pathWithoutLocale: '/' };
  }

  const firstSegment = segments[0];
  
  // Check if first segment looks like a locale code (2-5 characters, lowercase)
  // Common patterns: en, es, en-US, es-ES, zh-CN
  const localePattern = /^[a-z]{2}(-[a-z]{2,3})?$/i;
  
  if (localePattern.test(firstSegment)) {
    // Convert to proper locale format based on Contentful locales
    const locale = await normalizeLocaleCode(firstSegment);
    const pathWithoutLocale = '/' + segments.slice(1).join('/');
    return { locale, pathWithoutLocale: pathWithoutLocale || '/' };
  }
  
  return { locale: null, pathWithoutLocale: pathname };
}

/**
 * Normalize locale code to full format
 * Converts short codes (e.g., 'en', 'es') to full codes based on actual Contentful locales
 * This is async because we need to check Contentful for available locales
 */
export async function normalizeLocaleCode(code: string): Promise<string> {
  // If already in full format, check if it exists in Contentful
  if (code.includes('-')) {
    const isValid = await isValidLocale(code);
    if (isValid) {
      return code;
    }
    // If the full code doesn't exist, try to find a matching locale
    const locales = await getAvailableLocales();
    const matchingLocale = locales.find(l => l.code.toLowerCase() === code.toLowerCase());
    if (matchingLocale) {
      return matchingLocale.code;
    }
    return code; // Return as-is if no match found
  }
  
  // Short code - find matching locale in Contentful
  const locales = await getAvailableLocales();
  const shortCode = code.toLowerCase();
  
  // Try exact match first (e.g., 'en' matches 'en-US')
  const matchingLocale = locales.find(l => {
    const localeShort = l.code.split('-')[0].toLowerCase();
    return localeShort === shortCode;
  });
  
  if (matchingLocale) {
    return matchingLocale.code;
  }
  
  // No match found, return as-is (will be validated later)
  return code;
}

/**
 * Get locale from request (URL, headers, cookies)
 * Priority: URL path > Accept-Language header > Cookie > Default
 */
export async function getLocaleFromRequest(request: Request): Promise<string> {
  const url = new URL(request.url);
  
  // 1. Check query parameter first (most explicit)
  const queryLocale = url.searchParams.get('locale');
  if (queryLocale) {
    // Normalize and validate query locale
    const normalized = await normalizeLocaleCode(queryLocale);
    const isValid = await isValidLocale(normalized);
    if (isValid) {
      return normalized;
    }
  }
  
  // 2. Check URL path
  const { locale: pathLocale } = await extractLocaleFromPath(url.pathname);
  if (pathLocale) {
    const isValid = await isValidLocale(pathLocale);
    if (isValid) {
      return pathLocale;
    }
  }
  
  // 3. Check Accept-Language header
  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage) {
    const browserLocale = parseAcceptLanguage(acceptLanguage);
    if (browserLocale) {
      const normalized = await normalizeLocaleCode(browserLocale);
      const isValid = await isValidLocale(normalized);
      if (isValid) {
        return normalized;
      }
    }
  }
  
  // 4. Check cookie (if implemented)
  // const cookieLocale = getCookie(request, 'locale');
  // if (cookieLocale) {
  //   const normalized = await normalizeLocaleCode(cookieLocale);
  //   if (await isValidLocale(normalized)) {
  //     return normalized;
  //   }
  // }
  
  // 5. Default locale
  return await getDefaultLocale();
}

/**
 * Parse Accept-Language header to extract preferred locale
 * Note: Returns the raw locale string, normalization happens in getLocaleFromRequest
 */
function parseAcceptLanguage(acceptLanguage: string): string | null {
  // Accept-Language format: "en-US,en;q=0.9,es;q=0.8"
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, q = '1'] = lang.trim().split(';');
      const quality = parseFloat(q.replace('q=', '') || '1');
      return { locale: locale.trim(), quality };
    })
    .sort((a, b) => b.quality - a.quality);
  
  if (languages.length > 0) {
    return languages[0].locale;
  }
  
  return null;
}

/**
 * Clear locale cache (useful for testing or when locales change)
 */
export function clearLocaleCache(): void {
  cachedLocales = null;
  localeCachePromise = null;
}
