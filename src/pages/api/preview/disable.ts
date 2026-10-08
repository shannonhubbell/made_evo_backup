import type { APIRoute } from 'astro';

/**
 * Disable Preview Mode
 * 
 * GET /api/preview/disable
 * 
 * Removes the preview mode cookie and redirects to home page
 */
export const prerender = false; // Must be server-rendered

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('preview-mode', { path: '/' });
  return redirect('/', 307);
};
