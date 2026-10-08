/**
 * Image optimization utility functions
 * Appends appropriate query parameters to image URLs based on device resolution
 */

export interface ImageOptions {
  quality?: number;
  width?: number;
  format?: 'webp' | 'jpg' | 'png' | 'auto';
  height?: number;
}

/**
 * Determines appropriate image width based on viewport size
 * Uses Tailwind CSS breakpoints as reference:
 * - Mobile: < 640px → 400px
 * - Tablet: 640px - 1024px → 800px
 * - Desktop: 1024px - 1280px → 1200px
 * - Large Desktop: 1280px+ → 1600px
 */
export function getResponsiveWidth(viewportWidth?: number): number {
  // Default to medium desktop if no viewport width provided (server-side)
  if (!viewportWidth) {
    return 1200;
  }

  if (viewportWidth < 640) {
    // Mobile
    return 400;
  } else if (viewportWidth < 1024) {
    // Tablet
    return 800;
  } else if (viewportWidth < 1280) {
    // Desktop
    return 1200;
  } else {
    // Large Desktop
    return 1600;
  }
}

/**
 * Appends image optimization query parameters to a URL
 * Uses the larger of width or height to determine the optimized image size.
 * @param url - The base image URL
 * @param options - Optional image parameters (quality, width, format)
 * @param viewportWidth - Optional viewport width for responsive sizing (client-side only)
 * @returns The URL with appended query parameters
 */
export function optimizeImageUrl(
  url: string,
  options: ImageOptions = {},
  viewportWidth?: number
): string {
  if (!url) return url;

  // Determine width - use provided width, or calculate from viewport, or default
  const width = options.width ?? getResponsiveWidth(viewportWidth);
  const height = options.height;

  // Use the larger dimension for optimization (query by height when taller, width when wider)
  const useHeight = height != null && height > width;

  // Determine quality - default to 75%
  const quality = options.quality ?? 75;

  // Determine format - default to webp
  const format = options.format ?? 'webp';

  // Build query parameters
  const params = new URLSearchParams();

  // Add quality
  params.set('q', quality.toString());

  // Add the larger dimension (query by height when taller, width when wider)
  if (useHeight) {
    params.set('h', height.toString());
  } else {
    params.set('w', width.toString());
  }

  // Add format
  if (format === 'auto') {
    params.set('fm', 'auto');
  } else {
    params.set('fm', format);
  }

  // Handle absolute URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      // Append to existing query parameters
      params.forEach((value, key) => {
        urlObj.searchParams.set(key, value);
      });
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, fall back to string concatenation
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${params.toString()}`;
    }
  } else {
    // Relative URL - append query string
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }
}

/**
 * Client-side function to optimize image URL based on current viewport
 * This should be called from browser code (e.g., in a script tag or Vue/Svelte component)
 * @param url - The base image URL
 * @param options - Optional image parameters
 * @returns The optimized URL with viewport-based width
 */
export function optimizeImageUrlForViewport(
  url: string,
  options: ImageOptions = {}
): string {
  if (typeof window === 'undefined') {
    // Server-side - use default
    return optimizeImageUrl(url, options);
  }
  
  const viewportWidth = window.innerWidth;
  return optimizeImageUrl(url, options, viewportWidth);
}

/**
 * Creates a srcset string for responsive images
 * @param baseUrl - The base image URL
 * @param options - Optional image parameters
 * @returns A srcset string with multiple sizes
 */
export function createImageSrcSet(
  baseUrl: string,
  options: ImageOptions = {}
): string {
  const widths = [400, 800, 1200, 1600];
  const srcset = widths.map(width => {
    const optimizedUrl = optimizeImageUrl(baseUrl, { ...options, width });
    return `${optimizedUrl} ${width}w`;
  }).join(', ');
  
  return srcset;
}

