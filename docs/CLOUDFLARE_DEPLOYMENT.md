# Cloudflare Deployment Setup

## Configuration Files

### ✅ astro.config.ts
- Configured with Cloudflare adapter
- Output mode: `static` for `npm run build` / `npm run build:static`, or `server` for `npm run build:server`
- Adapter: `cloudflare()`

### ✅ wrangler.toml
- Configured for server mode deployment
- Main entry point: `dist/_worker.js/index.js`
- Assets directory: `./dist`
- Compatibility flags: `nodejs_compat` (for Node.js API compatibility)

### ✅ public/.assetsignore
- Excludes `_worker.js` and `_routes.json` from static assets
- Prevents these files from being uploaded as static assets

## Build Process

1. Run `npm run build:server` for Cloudflare SSR deployments or `npm run build` for static output
2. Build output:
   - `dist/_worker.js/index.js` - Worker code
   - `dist/` - Static assets

## Deployment Options

### Cloudflare Pages (Recommended)
- Automatically detects Astro + Cloudflare adapter
- No manual wrangler.toml needed (but it's fine to have one)
- Build command: `npm run build:server` for Cloudflare SSR deployments
- Build output directory: `dist`
- Root directory: `/` (project root)

### Cloudflare Workers (Manual)
- Use `wrangler deploy` command
- Requires wrangler.toml configuration (already set up)

## ✅ Fixed Issues

### Node.js API Incompatibilities - RESOLVED

All Node.js API incompatibilities have been fixed:

1. **src/components/Store.astro** ✅
   - **Fixed**: Now uses `fetch()` for both SSR and client-side
   - **Status**: Cloudflare compatible

2. **src/pages/api/backup.json.ts** ✅
   - **Fixed**: Refactored to use Contentful Management API directly
   - **Fixed**: Removed all filesystem operations (`fs`, `path`, `process.cwd()`)
   - **Fixed**: Removed `exec` command execution
   - **Fixed**: Uses in-memory operations and `TextEncoder` for buffer creation
   - **Status**: Cloudflare compatible (uses `contentful-management` SDK)

3. **src/integrations/square-catalog.ts** ✅
   - **Fixed**: Changed `process.env` to `import.meta.env`
   - **Status**: Cloudflare compatible

## ⚠️ Potential Issues

### contentful-management SDK Compatibility

The `contentful-management` SDK may have Node.js dependencies. If you encounter issues:
- Use Contentful Management REST API directly via `fetch()`
- Or use the `contentful-export` package if it's compatible with Workers runtime

## Environment Variables

Make sure these are set in Cloudflare Pages/Workers:
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_DELIVERY_TOKEN`
- `CONTENTFUL_PREVIEW_TOKEN`
- `SQUARE_APPLICATION_ID`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_ENVIRONMENT`

## Testing Locally

To test the Cloudflare build locally:
```bash
npm run build:server
npm run preview
```

This will build the project and start a local Wrangler dev server.

**Note:** The Cloudflare adapter does not support `astro preview`. Use `npm run preview` (which uses Wrangler) or `npm run preview:local` (if you've already built).

## Next Steps

1. ✅ Configuration files are set up correctly
2. ⚠️ Fix `src/pages/api/backup.json.ts` to use Cloudflare storage APIs
3. ⚠️ Verify `src/components/Store.astro` works correctly in server mode
4. ⚠️ Update `src/integrations/square-catalog.ts` to use `import.meta.env`
