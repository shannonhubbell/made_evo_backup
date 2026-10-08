# Multi-Language Support Implementation

## ✅ Completed Implementation

### Phase 1: Locale Detection & Utilities ✅

**Created**: `src/lib/contentful/locales.ts`

**Features**:
- `getAvailableLocales()`: Fetches all locales from Contentful (uses Management API if available, falls back to defaults)
- `getDefaultLocale()`: Returns the default locale code
- `getLocaleFallback(locale)`: Gets fallback locale for a given locale
- `isValidLocale(locale)`: Validates if locale exists in Contentful
- `getLocaleFromRequest(request)`: Extracts locale from URL, query params, or Accept-Language header
- `extractLocaleFromPath(pathname)`: Extracts locale from URL path (e.g., `/en/page-slug`)
- Locale caching to avoid repeated API calls

### Phase 2: Update GraphQL Queries ✅

**Updated**: `src/lib/contentful/query-builder.ts`

**Changes**:
- `queryPageBySlug(slug, locale?)`: Added optional locale parameter
- `queryPostBySlug(slug, locale?)`: Added optional locale parameter
- `queryEventBySlug(slug, locale?)`: Added optional locale parameter
- `queryPages(options, locale?)`: Added optional locale parameter

All queries now support Contentful's `locale` GraphQL parameter.

### Phase 3: Update Content Fetching Functions ✅

**Updated**: `src/lib/contentful.ts`

**Changes**:
- `getPageBySlug(slug, locale?)`: Now accepts locale and implements fallback logic
- `getPostBySlug(slug, locale?)`: Now accepts locale and implements fallback logic
- `getEventBySlug(slug, locale?)`: Now accepts locale and implements fallback logic

**Fallback Logic**: If content doesn't exist in requested locale, automatically falls back to the locale's fallback locale (usually default locale).

### Phase 4: Middleware for Locale Detection ✅

**Created**: `src/middleware.ts`

**Features**:
- Detects locale from URL path (e.g., `/en/page-slug`)
- Falls back to query parameters, Accept-Language header, or default locale
- Validates locale against Contentful available locales
- Sets `Astro.locals.locale` for use in pages
- Stores `pathWithoutLocale` for potential URL rewriting

### Phase 5: Update Layout & Components ✅

**Updated**: `src/layouts/Layout.astro`

**Changes**:
- Dynamic `lang` attribute based on current locale
- Extracts language code from locale (e.g., `en-US` → `en`)
- Uses `Astro.locals.locale` set by middleware

### Phase 6: Update Page Routes ✅

**Updated**:
- `src/pages/[slug].astro`: Uses locale-aware `getPageBySlug()`
- `src/pages/events/[slug].astro`: Uses locale-aware `getEventBySlug()`
- `src/pages/blog/posts/[slug].astro`: Uses locale-aware `getPostBySlug()`
- `src/pages/api/pages/[slug].json.ts`: API route supports locale query parameter

All pages now fetch content in the detected locale.

## 🚀 How It Works

### Locale Detection Priority

1. **URL Path** (e.g., `/en/page-slug` or `/es/page-slug`)
2. **Query Parameter** (e.g., `?locale=es-US`)
3. **Accept-Language Header** (browser language preference)
4. **Default Locale** (from Contentful, usually `en-US`)

### Current URL Structure

The current implementation supports:

- **Query Parameter**: `/page-slug?locale=es-US`
- **Headers**: Automatically detects from `Accept-Language`
- **Default**: Falls back to default locale

### Path-Based Routing (Future Enhancement)

For full path-based routing like `/en/page-slug` or `/es/page-slug`, you would need to create:

```
src/pages/[locale]/[slug].astro
```

This is not yet implemented but can be added as a future enhancement.

## 📝 Usage Examples

### In Astro Pages

```astro
---
// Locale is automatically set by middleware
const locale = Astro.locals.locale || 'en-US';
const page = await getPageBySlug(slug, locale);
---
```

### In API Routes

```typescript
export const GET: APIRoute = async ({ params, url, locals }) => {
  const locale = url.searchParams.get('locale') || locals.locale || 'en-US';
  const page = await getPageBySlug(slug, locale);
  // ...
};
```

### Testing Locales

1. **Check available locales**:
   ```bash
   npm run list:contentful-locales
   ```

2. **Test with query parameter**:
   ```
   http://localhost:4321/page-slug?locale=es-US
   ```

3. **Test with Accept-Language header**:
   ```bash
   curl -H "Accept-Language: es" http://localhost:4321/page-slug
   ```

## 🔧 Configuration

### Environment Variables

No new environment variables required. Uses existing:
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_DELIVERY_TOKEN`
- `CONTENTFUL_MANAGEMENT_TOKEN` (optional, for locale fetching)

### Contentful Setup

1. Ensure locales are created in Contentful (Settings → Locales)
2. Mark one locale as default
3. Set fallback locales as needed
4. Ensure content is translated/populated for each locale

## 🐛 Known Limitations

1. **Path-Based Routing**: Full `/en/page-slug` routing requires additional route structure (see Future Enhancements)

2. **Static Generation**: `getStaticPaths()` not yet updated for multi-locale static generation

3. **Language Switcher**: Component not yet created (see Future Enhancements)

4. **Menu/Navigation**: Menu items not yet locale-aware (if they're localized in Contentful)

## 🎯 Future Enhancements

1. **Path-Based Routes**: Create `[locale]/[slug].astro` for `/en/page-slug` URLs
2. **Language Switcher Component**: UI to switch between languages
3. **Static Generation**: Update `getStaticPaths()` to generate pages for all locales
4. **Sitemap**: Generate locale-aware sitemap with `hreflang` tags
5. **Menu Localization**: Make navigation menu items locale-aware
6. **Cookie Support**: Remember user's language preference

## 📚 Related Documentation

- [Multi-Language Support Plan](./MULTI_LANGUAGE_SUPPORT_PLAN.md) - Full implementation plan
- [Contentful Localization Docs](https://www.contentful.com/developers/docs/tutorials/general/setting-locales/)
- [Contentful GraphQL API](https://www.contentful.com/developers/docs/references/graphql/)

## ✅ Testing Checklist

- [x] Locale utility module created
- [x] Query builder supports locale
- [x] Content fetching functions accept locale
- [x] Middleware detects locale
- [x] Layout uses dynamic lang attribute
- [x] Pages use locale-aware content fetching
- [x] API routes support locale
- [ ] Path-based routing (`/en/page-slug`)
- [ ] Language switcher component
- [ ] Static generation for all locales
- [ ] End-to-end testing
