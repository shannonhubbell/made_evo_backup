# Square Payment Deployment Options

## Overview

Square payment processing **requires server-side API calls** because:
- Your Square access token must be kept secret (can't expose it client-side)
- Payment processing needs to happen server-side for security
- Square's API requires server-to-server communication

## Option 1: Serverless Functions (Recommended)

### Vercel
1. Deploy your Astro site to Vercel
2. API routes automatically become serverless functions
3. Set environment variables in Vercel dashboard:
   - `SQUARE_ACCESS_TOKEN`
   - `SQUARE_LOCATION_ID`
   - `SQUARE_APPLICATION_ID`
   - `SQUARE_ENVIRONMENT`

**Pros:**
- No server management
- Automatic scaling
- Free tier available
- Easy deployment

**Cons:**
- Requires Vercel account
- Cold start latency possible

### Netlify
1. Deploy to Netlify
2. Use Netlify Functions for API routes
3. Configure environment variables

**Pros:**
- Similar to Vercel
- Good free tier

**Cons:**
- May need to configure functions separately

### Cloudflare Workers
1. Deploy to Cloudflare Pages
2. Use Cloudflare Workers for API routes
3. Configure environment variables

**Pros:**
- Fast global distribution
- Good free tier

**Cons:**
- May need different deployment setup

## Option 2: Square Hosted Checkout

Square offers a hosted checkout page that redirects users to Square's payment page.

**Pros:**
- No server-side code needed
- PCI compliance handled by Square
- Simple implementation

**Cons:**
- Users leave your site (worse UX)
- Less control over checkout flow
- Can't customize as much

**Implementation:**
- Use Square's Checkout API to create a checkout session
- Redirect user to Square's hosted page
- Handle return callback

## Option 3: Current Setup (Astro + Node)

Your current setup with `@astrojs/node` adapter works, but:

1. **For Development:**
   - Run `npm run dev` (uses server mode)
   - API routes work automatically

2. **For Production:**
   - Need a Node.js server (VPS, Heroku, Railway, etc.)
   - Deploy with `npm run build`
   - Run with `node dist/server/entry.mjs`

**Pros:**
- Full control
- Works with your current setup

**Cons:**
- Need to manage a server
- Scaling requires more setup

## Current Fixes Applied

1. ✅ Added `export const prerender = false;` to API routes
2. ✅ Improved error handling for empty request bodies
3. ✅ Better JSON parsing error messages

## Testing Locally

Make sure you're running in server mode (not static):

```bash
# This uses server mode (API routes work)
npm run dev

# This builds statically (API routes won't work)
npm run build
```

## Deployment Checklist

- [ ] Ensure API routes have `export const prerender = false;`
- [ ] Set environment variables on your hosting platform
- [ ] Test payment flow in sandbox mode first
- [ ] Verify Square credentials are correct
- [ ] Check that your hosting platform supports server-side rendering

## Recommended Approach

For most use cases, **Option 1 (Serverless Functions)** is recommended:
- Use Vercel for easiest deployment
- API routes work automatically
- No server management needed
- Scales automatically

