# Contentful Preview Setup Guide

## Overview

Your Astro site now supports **hybrid mode** with on-demand rendering, enabling live preview of draft/unpublished content from Contentful. This allows content creators to see their changes immediately without waiting for a rebuild.

## How It Works

1. **Static/server builds**:
   - `npm run build` (or `npm run build:static`) uses static output and prerenders eligible pages.
   - `npm run build:server` uses server output for on-demand rendering.

2. **Preview Detection**: Middleware detects preview mode via:
   - Cookie: `preview-mode=true` (set by `/api/preview` endpoint)
   - Header: `x-contentful-preview=true`
   - Query param: `?preview=true`
   - Environment variable: `CONTENTFUL_PREVIEW=true`

3. **API Switching**: Automatically uses:
   - **Preview API** when preview mode is active (shows drafts)
   - **Delivery API** in normal mode (shows published content only)

## Setup Instructions

### 1. Environment Variables

Add these to your Cloudflare Pages environment variables:

**For Preview/Development:**
```
CONTENTFUL_PREVIEW_TOKEN=<your-preview-token>
CONTENTFUL_PREVIEW_SECRET=<random-secret-string>
```

**For Production:**
```
CONTENTFUL_DELIVERY_TOKEN=<your-delivery-token>
```

**Both environments need:**
```
CONTENTFUL_SPACE_ID=<your-space-id>
CONTENTFUL_ENVIRONMENT=master  # optional, defaults to 'master'
```

### 2. Contentful Preview Configuration

1. Go to **Contentful** → **Settings** → **Content preview**
2. Add a new preview configuration
3. Set the preview URL for each content type:

**For Pages:**
```
https://yourdomain.com/api/preview?secret=<YOUR_SECRET>&slug={entry.fields.slug}
```

**For Events:**
```
https://yourdomain.com/api/preview?secret=<YOUR_SECRET>&slug={entry.fields.slug}
```

**For Posts:**
```
https://yourdomain.com/api/preview?secret=<YOUR_SECRET>&slug={entry.fields.slug}
```

Replace `<YOUR_SECRET>` with the value of `CONTENTFUL_PREVIEW_SECRET`.

### 3. Cloudflare Pages Deployment

#### Static Deployment
- **Build Command**: `npm run build`
- **Output**: Static output for eligible pages; routes explicitly marked `prerender = false` still require server rendering.

#### Preview Deployment (On-Demand)
- **Build Command**: `npm run build:server`
- **Environment Variables**: 
  - `CONTENTFUL_PREVIEW_TOKEN` (required)
  - `CONTENTFUL_PREVIEW_SECRET` (required)
- **Output**: Server mode, pages render on-demand

## Usage

### For Content Creators

1. **Edit content in Contentful** (keep as draft)
2. **Click "Open preview"** button in Contentful UI
3. **Preview opens** with your draft changes visibleg
4. **Share preview link** with team for feedback
5. **Publish when ready** → triggers production build

### For Developers

#### Local Development (Preview Mode)
```bash
npm run dev:preview
```
This enables preview mode locally, showing draft content.

#### Local Development (Normal Mode)
```bash
npm run dev
```
Shows only published content.

#### Static Build
```bash
npm run build
```
Creates static output and prerenders eligible pages.

#### Server Build
```bash
npm run build:server
```
Creates a server-rendered build that supports on-demand rendering.

#### Local Preview with Wrangler
```bash
npm run build
npm run preview:local
```
Uses Wrangler to preview the built site with Cloudflare bindings.

## Preview Mode Indicators

When preview mode is active:
- **Yellow banner** appears at top of page
- Shows "PREVIEW MODE - Showing draft/unpublished content"
- "Exit Preview" link to disable preview mode

## API Endpoints

### Enable Preview
```
GET /api/preview?secret=<SECRET>&slug=/your-page-slug
```
- Verifies secret
- Sets preview cookie
- Redirects to requested page

### Disable Preview
```
GET /api/preview/disable
```
- Removes preview cookie
- Redirects to home page

## How Pages Work

Dynamic pages (`[slug].astro`, `events/[slug].astro`, etc.) are configured to:
- **Prerender** when `STATIC_BUILD=true` (production)
- **Render on-demand** when in hybrid mode (preview)

This means:
- Production: All pages are static HTML files (fast, cached)
- Preview: Pages render on-demand using Preview API (shows drafts)

## Security Considerations

1. **Preview Secret**: Use a strong, random string. Never commit to git.
2. **Preview Token**: Store securely in Cloudflare environment variables.
3. **Preview URL**: Consider IP whitelisting for preview deployment.
4. **Cookie Security**: Preview cookie uses `HttpOnly` and `SameSite=Lax`.

## Troubleshooting

### Preview not showing draft content?
- Check `CONTENTFUL_PREVIEW_TOKEN` is set correctly
- Verify preview secret matches in Contentful preview URL
- Check browser console for API errors
- Ensure preview cookie is set (check DevTools → Application → Cookies)

### Production showing old content?
- Trigger manual rebuild
- Verify content is published in Contentful
- Check `STATIC_BUILD=true` is set in production environment

### Preview link not working?
- Verify preview secret matches
- Check Contentful preview URL configuration
- Ensure preview deployment is running (not static build)
- Check Cloudflare Pages logs for errors

### Pages not rendering on-demand?
- Verify `STATIC_BUILD` is NOT set in preview environment
- Check `astro.config.ts` has `output: 'hybrid'`
- Ensure pages have `export const prerender = import.meta.env.STATIC_BUILD === 'true'`

## Architecture

```
┌─────────────────┐
│   Contentful    │
│      CMS        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Preview │ │ Delivery │
│  API   │ │   API    │
└───┬────┘ └────┬─────┘
    │           │
    │           │
    ▼           ▼
┌─────────────────────┐
│  Astro Hybrid Mode  │
│  - Static (prod)    │
│  - On-demand (prev) │
└─────────────────────┘
```

## Next Steps

1. ✅ Set up environment variables in Cloudflare
2. ✅ Configure Contentful preview URLs
3. ✅ Test preview mode locally
4. ✅ Deploy preview environment
5. ✅ Test Contentful preview links
6. ✅ Verify production build still works

## References

- [Astro Cloudflare Adapter Docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Contentful Preview API](https://www.contentful.com/developers/docs/references/content-preview-api/)
- [Astro Hybrid Rendering](https://docs.astro.build/en/guides/server-side-rendering/)
