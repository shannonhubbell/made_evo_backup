# Square Payment Links for Static Builds

## The Challenge

Square's Payment Links API requires your access token to create payment links. This means:
- ✅ **Server Mode**: Works perfectly - endpoint creates payment link on-demand
- ❌ **Static Mode**: Cannot create payment links dynamically (no server-side code)

## Solutions for Static Builds

### Option 1: Use Serverless Functions (Recommended)

Deploy to a platform that supports serverless functions:
- **Vercel**: API routes automatically become serverless functions
- **Netlify**: Use Netlify Functions
- **Cloudflare**: Use Cloudflare Workers

The `/api/square/checkout` endpoint will work as a serverless function.

### Option 2: Pre-generate Payment Links

For static sites, you can pre-generate payment links for common scenarios:

1. **Create payment links at build time** for fixed amounts
2. **Store them in a static JSON file**
3. **Use the appropriate link** based on cart total

**Limitation**: Only works for predefined amounts, not dynamic carts.

### Option 3: Hybrid Approach

1. **Static site** for catalog and cart
2. **Serverless function** for checkout link creation
3. **Redirect to Square** for payment

### Option 4: Client-Side Payment Form

Use Square's Web Payments SDK (client-side):
- No server endpoint needed
- Payment form embedded in your page
- Still requires server-side payment processing endpoint

## Current Implementation

The current setup uses **Square's Payment Links API** which requires:
- Server-side endpoint to create the payment link
- Square access token (must be kept secret)

**For Static Builds**: The checkout endpoint (`/api/square/checkout`) will not work unless:
1. You deploy to a platform with serverless functions, OR
2. You enable server-side rendering for this specific endpoint

## Recommendation

For static builds, use **Option 1 (Serverless Functions)**:
1. Deploy to Vercel/Netlify/Cloudflare
2. The `/api/square/checkout` endpoint becomes a serverless function
3. No code changes needed - it just works!

## Alternative: Static Payment Links

If you must have a fully static site, you can:

1. Create payment links manually in Square Dashboard
2. Store them in a static JSON file
3. Match cart total to closest pre-generated link
4. Redirect to that link

This works but limits flexibility for dynamic pricing.

