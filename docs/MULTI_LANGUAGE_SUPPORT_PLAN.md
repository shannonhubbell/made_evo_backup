# Multi-Language Support Plan

## Overview
This document outlines the plan to support all languages available in Contentful, dynamically detecting available locales and serving content in the appropriate language based on user preferences and URL structure.

## Current State Analysis

### What We Have
- ✅ Contentful space with multiple locales (at least `en-US` and `es-US`)
- ✅ Translation script that can populate Contentful with translated content
- ✅ Contentful GraphQL API integration
- ✅ Hardcoded `lang="en-US"` in Layout.astro
- ✅ No locale-aware routing or content fetching

### What's Missing
- ❌ Dynamic locale detection from Contentful
- ❌ Locale-aware GraphQL queries
- ❌ URL-based locale routing (e.g., `/es/page-slug` or `/page-slug?locale=es-US`)
- ❌ Language switcher component
- ❌ Locale fallback mechanism
- ❌ Dynamic HTML lang attribute
- ❌ Locale-aware content fetching functions

## Contentful Locale System

### How Contentful Handles Locales
1. **Locale Codes**: Contentful uses ISO locale codes (e.g., `en-US`, `es-US`, `es-ES`)
2. **Default Locale**: One locale is marked as default (usually `en-US`)
3. **Fallback Locale**: Each locale can have a fallback (usually to default)
4. **Localized Fields**: Fields marked as "localized" in content types have separate values per locale
5. **GraphQL API**: Supports `locale` parameter on queries and individual fields

### GraphQL Locale Querying
```graphql
# Query with specific locale
{
  pageCollection(locale: "es-US") {
    items {
      title
      slug
    }
  }
}

# Query multiple locales on same field
{
  pageCollection {
    items {
      title
      title(locale: "es-US")
    }
  }
}
```

## Implementation Plan

### Phase 1: Locale Detection & Utilities (Foundation)

#### 1.1 Create Locale Utility Module
**File**: `src/lib/contentful/locales.ts`

**Functions to implement**:
- `getAvailableLocales()`: Fetch all locales from Contentful Management API
- `getDefaultLocale()`: Get the default locale code
- `getLocaleFallback(locale: string)`: Get fallback locale for a given locale
- `isValidLocale(locale: string)`: Validate if locale exists in Contentful
- `getLocaleFromRequest(request: Request)`: Extract locale from URL/headers/cookies

**Implementation**:
```typescript
export interface ContentfulLocale {
  code: string;
  name: string;
  default: boolean;
  fallbackCode?: string;
}

export async function getAvailableLocales(): Promise<ContentfulLocale[]>
export async function getDefaultLocale(): Promise<string>
export function getLocaleFromRequest(request: Request): string
```

#### 1.2 Cache Locale Information
- Cache locale list at build time (for static builds)
- Refresh cache periodically or on-demand
- Store in Astro.locals for request-time access

### Phase 2: Update GraphQL Queries (Content Fetching)

#### 2.1 Update Query Builder
**File**: `src/lib/contentful/query-builder.ts`

**Changes**:
- Add `locale` parameter to all query functions
- Support querying multiple locales when needed
- Add locale-aware field queries

**Example**:
```typescript
export function queryPageBySlug(slug: string, locale?: string): string {
  const localeArg = locale ? `locale: "${locale}"` : '';
  return `
    query PageBySlug($slug: String!) {
      pageCollection(where: { slug: $slug }, limit: 1${localeArg ? `, ${localeArg}` : ''}) {
        items {
          ${PageFields}
        }
      }
    }
  `;
}
```

#### 2.2 Update Content Fetching Functions
**File**: `src/lib/contentful.ts`

**Functions to update**:
- `getPageBySlug(slug: string, locale?: string)`
- `getPostBySlug(slug: string, locale?: string)`
- `getEventBySlug(slug: string, locale?: string)`
- All other content fetching functions

**Implementation pattern**:
```typescript
export async function getPageBySlug(
  slug: string, 
  locale?: string
): Promise<Page | null> {
  const query = queryPageBySlug(slug, locale);
  // ... rest of implementation
}
```

#### 2.3 Add Locale Fallback Logic
- If content doesn't exist in requested locale, fall back to default locale
- Log when fallback occurs for monitoring

### Phase 3: URL Routing & Locale Detection

#### 3.1 URL Structure Options

**Option A: Path-based (Recommended)**
- `/en/page-slug` - English
- `/es/page-slug` - Spanish
- `/page-slug` - Default locale (redirects to `/en/page-slug`)

**Option B: Query parameter**
- `/page-slug?locale=es-US`
- `/page-slug` - Default locale

**Option C: Subdomain**
- `en.example.com/page-slug`
- `es.example.com/page-slug`

**Recommendation**: Use **Option A (Path-based)** for better SEO and user experience.

#### 3.2 Create Locale-Aware Routes
**File**: `src/pages/[locale]/[slug].astro` (new structure)

**Alternative**: Keep current structure and use middleware to handle locale

#### 3.3 Middleware for Locale Detection
**File**: `src/middleware.ts` (create if doesn't exist)

**Responsibilities**:
- Extract locale from URL path
- Validate locale against Contentful available locales
- Set `Astro.locals.locale` for use in pages
- Redirect invalid locales to default
- Handle locale cookies/preferences

**Implementation**:
```typescript
export async function onRequest(context, next) {
  const url = new URL(context.request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Check if first segment is a locale
  const potentialLocale = pathSegments[0];
  const availableLocales = await getAvailableLocales();
  const localeCodes = availableLocales.map(l => l.code.split('-')[0]); // en, es
  
  if (localeCodes.includes(potentialLocale)) {
    context.locals.locale = potentialLocale;
    // Remove locale from path for routing
    url.pathname = '/' + pathSegments.slice(1).join('/');
  } else {
    context.locals.locale = await getDefaultLocale();
  }
  
  return next();
}
```

### Phase 4: Update Components & Layout

#### 4.1 Update Layout.astro
**File**: `src/layouts/Layout.astro`

**Changes**:
- Dynamic `lang` attribute based on current locale
- Pass locale to child components

```astro
---
const locale = Astro.locals.locale || 'en-US';
const langCode = locale.split('-')[0]; // en, es, etc.
---
<html lang={langCode}>
```

#### 4.2 Create Language Switcher Component
**File**: `src/components/LanguageSwitcher.astro`

**Features**:
- Display all available locales
- Show current locale
- Link to same page in different locale
- Preserve URL structure when switching

#### 4.3 Update Navigation Components
- Ensure NavBar and Footer respect locale
- Translate menu items if they're localized in Contentful

### Phase 5: API Routes Updates

#### 5.1 Update API Routes
**Files**: 
- `src/pages/api/pages/[slug].json.ts`
- `src/pages/api/posts/[slug].json.ts`
- `src/pages/api/events/[slug].json.ts`

**Changes**:
- Accept `locale` query parameter
- Pass locale to content fetching functions
- Return locale in response metadata

**Example**:
```typescript
export const GET: APIRoute = async ({ params, url }) => {
  const slug = params?.slug;
  const locale = new URL(url).searchParams.get('locale') || 'en-US';
  
  const page = await getPageBySlug(slug, locale);
  // ...
};
```

### Phase 6: Static Generation & Build Time

#### 6.1 Generate Static Paths for All Locales
**File**: `src/pages/[slug].astro` or `src/pages/[locale]/[slug].astro`

**Implementation**:
```typescript
export async function getStaticPaths() {
  const locales = await getAvailableLocales();
  const pages = await getAllPages(); // Get all page slugs
  
  return locales.flatMap(locale => 
    pages.map(page => ({
      params: { 
        locale: locale.code.split('-')[0], // en, es
        slug: page.slug 
      },
      props: { locale: locale.code }
    }))
  );
}
```

#### 6.2 Locale-Aware Sitemap
- Generate sitemap with all locale variants
- Include `hreflang` tags for SEO

### Phase 7: Testing & Validation

#### 7.1 Test Cases
- [ ] Content loads in correct locale
- [ ] Fallback to default locale works
- [ ] URL routing preserves locale
- [ ] Language switcher works correctly
- [ ] API routes return correct locale
- [ ] Static generation includes all locales
- [ ] Invalid locales redirect properly

#### 7.2 Monitoring
- Log locale usage statistics
- Monitor fallback frequency
- Track missing translations

## Implementation Order

### Week 1: Foundation
1. ✅ Create locale utility module
2. ✅ Implement locale fetching from Contentful
3. ✅ Update query builder with locale support
4. ✅ Update content fetching functions

### Week 2: Routing & Detection
1. ✅ Create/update middleware for locale detection
2. ✅ Implement URL-based locale routing
3. ✅ Update Layout.astro with dynamic lang
4. ✅ Test locale detection and routing

### Week 3: Components & UI
1. ✅ Create LanguageSwitcher component
2. ✅ Update navigation components
3. ✅ Update API routes
4. ✅ Test end-to-end user flow

### Week 4: Static Generation & Polish
1. ✅ Update getStaticPaths for all locales
2. ✅ Generate locale-aware sitemap
3. ✅ Add hreflang tags
4. ✅ Final testing and documentation

## Configuration

### Environment Variables
No new environment variables needed - uses existing Contentful credentials.

### Contentful Setup
- Ensure all desired locales are created in Contentful
- Mark default locale appropriately
- Set fallback locales as needed
- Ensure content is translated/populated for each locale

## Migration Strategy

### Backward Compatibility
- Default locale (`en-US`) should work without URL prefix
- Existing URLs should redirect to locale-prefixed versions
- API routes should default to `en-US` if no locale specified

### Rollout Plan
1. Deploy locale utilities (non-breaking)
2. Deploy locale-aware queries (non-breaking, defaults to en-US)
3. Deploy routing changes (may require redirects)
4. Deploy UI components
5. Monitor and iterate

## Future Enhancements

1. **Browser Language Detection**: Auto-detect user's preferred language from browser
2. **Locale Cookies**: Remember user's language preference
3. **Translation Status**: Show which pages are fully translated
4. **Admin Tools**: UI to manage translations and see missing translations
5. **RTL Support**: Handle right-to-left languages if needed

## Resources

- [Contentful Localization Docs](https://www.contentful.com/developers/docs/tutorials/general/setting-locales/)
- [Contentful GraphQL API](https://www.contentful.com/developers/docs/references/graphql/)
- [Astro i18n Guide](https://docs.astro.build/en/guides/internationalization/)

## Notes

- The translation script (`scripts/translate-contentful-pages.ts`) already has locale utilities that can be reused
- Consider using Astro's built-in i18n features if they become available
- Keep locale codes consistent between Contentful and URL structure
- Consider SEO implications of URL structure choice
