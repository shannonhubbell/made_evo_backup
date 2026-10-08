/**
 * Square Checkout API Endpoint
 * 
 * Creates a Square Checkout session and returns the checkout URL.
 * This uses Square's hosted checkout page instead of embedded payment form.
 */

import type { APIRoute } from 'astro';

// IMPORTANT: This endpoint requires server-side rendering and will NOT work in static builds.
// 
// For static builds (output: 'static'): 
//   - This file will be automatically excluded from the build by Astro
//   - No prerender export is needed - Astro handles exclusion automatically
//   - The endpoint will not be available in static deployments
//
// For server builds (output: 'server' or with adapter):
//   - This endpoint will be available as a server endpoint
//   - It requires Square API credentials to function
//
// For serverless platforms (Vercel, Netlify, Cloudflare):
//   - This endpoint automatically becomes a serverless function
//   - Ensure your platform supports serverless functions for API routes
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// TODO: When we move to production, we need to mark this endpoint as server-rendered (not static)
// Mark this endpoint as server-rendered (not static)
// This is required for API routes that handle POST requests and need access to request body/headers
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// export const prerender = false;

// Helper to detect if we're in a static build context at runtime
// This is a safety check in case the endpoint is somehow called in a static context
function isStaticBuildRuntime(): boolean {
  // Check if we're in SSR context (should be true for server builds)
  const isSSR = import.meta.env.SSR === true;
  
  // If SSR is false or undefined, we might be in a static build
  // Also check if we can access environment variables (server-only)
  try {
    // Try to access an environment variable - this will fail in static builds
    const testEnv = import.meta.env.SQUARE_ACCESS_TOKEN;
    // If we can't access env vars or SSR is false, we're likely in static build
    return !isSSR || typeof testEnv === 'undefined';
  } catch {
    // If accessing env vars throws, we're in static build
    return true;
  }
}

interface CheckoutRequest {
  lineItems: Array<{
    itemId: string;
    itemVariationId: string;
    quantity: string;
    name?: string;
  }>;
  totalAmount: number; // in cents
  currency: string;
  redirectUrl: string; // URL to return to after payment
}

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export const POST: APIRoute = async ({ request, url }) => {
  // Check if we're in a static build context at runtime
  // This endpoint requires server-side rendering to access Square API
  if (isStaticBuildRuntime()) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Checkout endpoint requires server-side rendering. This endpoint is not available in static builds. Please deploy to a platform that supports serverless functions (Vercel, Netlify, Cloudflare) or enable server-side rendering.',
        hint: 'Deploy to Vercel, Netlify, or Cloudflare Pages to use serverless functions, or configure Astro with output: "server"'
      }),
      { 
        status: 503, 
        headers: { 
          'Content-Type': 'application/json',
          'X-Static-Build': 'true'
        } 
      }
    );
  }

  try {
    // Handle empty or malformed request body
    let body: CheckoutRequest;
    try {
      // Check content type first
      const contentType = request.headers.get('content-type');
      console.log('Request content-type:', contentType);
      
      // Try to parse JSON directly - Astro's request.json() handles this better
      // But fall back to text() if needed for compatibility
      if (contentType && contentType.includes('application/json')) {
        body = await request.json();
      } else {
        // Fallback: read as text and parse
        const bodyText = await request.text();
        console.log('Request body text:', bodyText);
        if (!bodyText || bodyText.trim() === '') {
          return new Response(
            JSON.stringify({ success: false, error: 'Request body is empty' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        body = JSON.parse(bodyText);
      }
      
      // Check if body is empty or null
      if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Request body is empty' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Parsed request body:', body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body: ' + (parseError instanceof Error ? parseError.message : 'Unknown error') }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate request
    if (!body.lineItems || body.lineItems.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items in checkout' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!body.totalAmount || body.totalAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid total amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get Square API credentials
    const squareAccessToken = import.meta.env.SQUARE_ACCESS_TOKEN;
    const squareLocationId = import.meta.env.SQUARE_LOCATION_ID;
    const squareEnvironment = import.meta.env.SQUARE_ENVIRONMENT || 'sandbox';
    
    if (!squareAccessToken || !squareLocationId) {
      console.error('Square API credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Payment service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine Square API base URL based on environment
    const squareApiBaseUrl = squareEnvironment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    
    // Build the origin URL for redirect
    const origin = url.origin;
    const redirectUrl = body.redirectUrl || `${origin}/en/store/confirmation`;
    
    // Create payment link using Square's Payment Links API
    // This creates a hosted checkout page that redirects back to our site
    
    // Build request body for Square Payment Links API
    // Use 'order' instead of 'quick_pay' to support line items with quantities
    // Square requires quantity to be a string in line items
    const requestBody: any = {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: squareLocationId,
        line_items: body.lineItems.map((item) => ({
          catalog_object_id: item.itemVariationId,
          catalog_version: null, // Use latest version
          quantity: item.quantity, // Square requires quantity as string
          name: item.name || 'Item',
          // Note: Square will calculate the total from catalog prices
          // We don't need to specify base_price_money here as it comes from catalog
        })),
      },
      checkout_options: {
        ask_for_shipping_address: false,
        allow_tipping: false,
        redirect_url: redirectUrl,
        collect_email: true, // Explicitly enable email collection
      },
    };
    
    // Log the request for debugging (remove sensitive data in production)
    console.log('Creating Square payment link:', {
      lineItems: body.lineItems.map(item => ({
        itemVariationId: item.itemVariationId,
        quantity: item.quantity,
        name: item.name
      })),
      totalAmount: body.totalAmount,
      currency: body.currency,
      locationId: squareLocationId,
      redirectUrl: redirectUrl,
      itemCount: body.lineItems.length,
    });
    
    console.log('Square API request body:', JSON.stringify(requestBody, null, 2));
    
    // Only include pre_populated_data if we have a valid email
    // (Square requires valid email or field to be omitted)
    
    const checkoutResponse = await fetch(`${squareApiBaseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const checkoutData = await checkoutResponse.json();
    
    if (!checkoutResponse.ok) {
      const errorMessage = checkoutData.errors?.[0]?.detail || checkoutData.errors?.[0]?.code || 'Checkout creation failed';
      console.error('Square checkout error:', JSON.stringify(checkoutData, null, 2));
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: checkoutResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract payment link URL from response
    // Square may return 'url' or 'long_url' depending on API version
    const checkoutUrl = checkoutData.payment_link?.url || checkoutData.payment_link?.long_url;
    
    if (!checkoutUrl) {
      console.error('No checkout URL in response:', JSON.stringify(checkoutData, null, 2));
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get checkout URL from Square response' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Square payment link created successfully:', checkoutUrl);
    
    const response: CheckoutResponse = {
      success: true,
      checkoutUrl: checkoutUrl,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Checkout creation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

