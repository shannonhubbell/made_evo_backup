# Cloudflare Environment Variables Setup

## Issue

Environment variables are not accessible in Cloudflare Workers runtime via `import.meta.env`. They need to be configured in Cloudflare and accessed through the runtime context.

## Solution

### For Cloudflare Pages

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for **Production** and **Preview** environments:

```
CONTENTFUL_SPACE_ID=<your-space-id>
CONTENTFUL_DELIVERY_TOKEN=<your-delivery-token>
CONTENTFUL_MANAGEMENT_TOKEN=<your-management-token>  # Required for multi-language support (locale fetching)
CONTENTFUL_PREVIEW_TOKEN=<your-preview-token>  # Optional, for preview mode
CONTENTFUL_PREVIEW_SECRET=<your-secret>  # Optional, for preview mode
CONTENTFUL_ENVIRONMENT=master  # Optional, defaults to 'master'
```

### For Local Development with Wrangler

Create a `.dev.vars` file in your project root (this file should be in `.gitignore`):

```bash
CONTENTFUL_SPACE_ID=<your-space-id>
CONTENTFUL_DELIVERY_TOKEN=<your-delivery-token>
CONTENTFUL_MANAGEMENT_TOKEN=<your-management-token>  # Required for multi-language support (locale fetching)
CONTENTFUL_PREVIEW_TOKEN=<your-preview-token>
CONTENTFUL_PREVIEW_SECRET=<your-secret>
CONTENTFUL_ENVIRONMENT=master
```

Wrangler will automatically load these variables when running `wrangler pages dev` or `wrangler dev`.

### Alternative: Using wrangler.jsonc

You can also add variables to `wrangler.jsonc` (but this is less secure for secrets):

```jsonc
{
  "vars": {
    "CONTENTFUL_SPACE_ID": "<your-space-id>",
    "CONTENTFUL_ENVIRONMENT": "master"
  }
}
```

**Note:** Do NOT put secrets (tokens) in `wrangler.jsonc`. Use `.dev.vars` for local development and Cloudflare Pages environment variables for production.

## How It Works

The code uses `getSecret()` from `astro:env/server` which:
- Works in Cloudflare Workers runtime
- Automatically accesses environment variables from Cloudflare's runtime context
- Falls back to `import.meta.env` for build-time and local dev

## Verification

After setting environment variables:
1. Deploy to Cloudflare Pages
2. Check the Worker logs for any "Missing required configuration" errors
3. The Contentful API calls should now include the Authorization header

## Troubleshooting

If you see errors like `"Missing required configuration: space=false, token=false"`:

1. **Verify variables are set in Cloudflare Pages:**
   - Go to your Cloudflare Pages project
   - Settings → Environment Variables
   - Ensure variables are set for the correct environment (Production/Preview)
   - Variable names must match exactly (case-sensitive)

2. **Check variable names:**
   - `CONTENTFUL_SPACE_ID` (not `CONTENTFUL_SPACE`)
   - `CONTENTFUL_DELIVERY_TOKEN` (not `CONTENTFUL_TOKEN`)
   - `CONTENTFUL_MANAGEMENT_TOKEN` (required for multi-language support)
   - `CONTENTFUL_PREVIEW_TOKEN` (optional)
   - `CONTENTFUL_PREVIEW_SECRET` (optional)

3. **Redeploy after adding variables:**
   - Environment variables are only available after a new deployment
   - Changes to env vars require a new build

4. **Check Worker logs:**
   - The error logs will show debug info about what env vars are available
   - Look for `[contentful] Debug info:` in the logs to see what's accessible
   - Look for `[locales]` messages to see locale fetching status
   - If you see "Falling back to default locale", check that `CONTENTFUL_MANAGEMENT_TOKEN` is set

## How the Code Works

The code uses a multi-layered approach to access environment variables:

1. **Primary (Cloudflare Workers):** Accesses `Astro.locals.runtimeEnv` set by middleware
2. **Fallback 1:** Uses `getSecret()` from `astro:env/server` API
3. **Fallback 2:** Uses `import.meta.env` for build-time and local dev

The middleware (`src/middleware.ts`) exposes the Cloudflare runtime environment to `Astro.locals.runtimeEnv` so it's accessible in nested functions like `contentful.ts`.
