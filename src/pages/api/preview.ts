import type { APIRoute } from 'astro';

/**
 * Contentful Preview API Endpoint
 * 
 * This endpoint enables preview mode for viewing draft/unpublished content.
 * 
 * Usage:
 * 1. From Contentful UI: Configure preview URL as:
 *    https://yourdomain.com/api/preview?secret=<SECRET>&slug={entry.fields.slug}
 * 
 * 2. Direct access:
 *    https://yourdomain.com/api/preview?secret=<SECRET>&slug=/your-page-slug
 * 
 * The preview mode is enabled via a cookie that persists for the session.
 */
export const prerender = false; // Must be server-rendered

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const slug = url.searchParams.get('slug') || '/';
  
  // Verify preview secret
  // Check both import.meta.env and process.env for compatibility
  const expectedSecret = import.meta.env.CONTENTFUL_PREVIEW_SECRET || 
                        (typeof process !== 'undefined' ? process.env.CONTENTFUL_PREVIEW_SECRET : undefined);
  
  // In development, allow preview without secret for easier testing
  const isDev = import.meta.env.DEV;
  
  // Debug: Log available environment variables (only in dev)
  if (isDev) {
    console.log('[preview] Environment check:', {
      hasPreviewSecret: !!expectedSecret,
      secretLength: expectedSecret?.length || 0,
      providedSecret: secret ? 'provided' : 'missing',
      envKeys: Object.keys(import.meta.env).filter(k => 
        k.includes('CONTENTFUL') || k.includes('PREVIEW')
      ),
      isDev: isDev
    });
  }
  
  if (!expectedSecret) {
    const errorMessage = isDev 
      ? 'Preview not configured. Add CONTENTFUL_PREVIEW_SECRET to your .env file.'
      : 'Preview not configured. CONTENTFUL_PREVIEW_SECRET must be set in your deployment environment.';
    
    console.error('[preview]', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: 'Preview not configured',
        message: errorMessage,
        ...(isDev && {
          hint: 'Create or update .env file with: CONTENTFUL_PREVIEW_SECRET=your-secret-here'
        })
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Verify secret matches
  if (secret !== expectedSecret) {
    console.warn('[preview] Invalid preview secret attempted');
    return new Response('Invalid token', { status: 401 });
  }
  
  // Log preview activation
  if (isDev) {
    console.log('[preview] Preview mode activated:', {
      slug,
      hasSecret: true
    });
  }
  
  // Enable preview mode via cookie
  // Cookie expires in 24 hours
  const cookieExpiry = new Date();
  cookieExpiry.setHours(cookieExpiry.getHours() + 24);
  
  cookies.set('preview-mode', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    expires: cookieExpiry,
  });
  
  // Normalize slug (ensure it starts with /)
  const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  
  // Redirect to the requested page
  // Preview mode will be active via the cookie
  return redirect(normalizedSlug, 307);
};
