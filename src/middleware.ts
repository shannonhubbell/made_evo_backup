/**
 * Astro Middleware
 *
 * Handles locale detection from URL paths, cookies, and sets locale in Astro.locals
 * Supports path-based locale routing: /en/page-slug, /es/page-slug
 */

import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, url } = context;

  const localesModule = await import('./lib/contentful/locales');
  const {
    getLocaleFromRequest,
    getDefaultLocale,
    extractLocaleFromPath,
    normalizeLocaleCode,
    isValidLocale,
  } = localesModule;

  const { locale: pathLocale, pathWithoutLocale } = await extractLocaleFromPath(url.pathname);

  let locale: string;

  const queryLocale = url.searchParams.get('locale');
  if (queryLocale) {
    const normalized = await normalizeLocaleCode(queryLocale);
    if (await isValidLocale(normalized)) {
      locale = normalized;
    } else {
      locale = await getDefaultLocale();
    }
  } else if (pathLocale) {
    if (await isValidLocale(pathLocale)) {
      locale = pathLocale;
    } else {
      locale = await getDefaultLocale();
    }
  } else {
    const cookieLocale = context.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale) {
      const normalized = await normalizeLocaleCode(cookieLocale);
      if (await isValidLocale(normalized)) {
        locale = normalized;
      } else {
        locale = await getLocaleFromRequest(request);
      }
    } else {
      locale = await getLocaleFromRequest(request);
    }
  }

  let finalLocale = locale;
  if (!locale.includes('-')) {
    finalLocale = await normalizeLocaleCode(locale);
  }

  context.locals.locale = finalLocale;
  context.locals.pathWithoutLocale = pathWithoutLocale || url.pathname;

  context.cookies.set('NEXT_LOCALE', finalLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  if (import.meta.env.DEV) {
    console.log(`[middleware] Detected locale: ${finalLocale} (original: ${locale}) for path: ${url.pathname}`);
  }

  return next();
};

declare global {
  namespace App {
    interface Locals {
      locale: string;
      pathWithoutLocale?: string;
    }
  }
}
