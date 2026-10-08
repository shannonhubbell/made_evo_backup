/**
 * Integration Tests for Navbar Component
 * 
 * These tests start a live server and verify that:
 * - Pages render correctly (not 404s or error pages)
 * - Navbar is present on pages
 * - Menu items appear in the HTML
 * - Navigation links are valid
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { preview } from 'astro';
import type { PreviewServer } from 'astro';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');
const distDir = join(projectRoot, 'dist');

describe('Navbar Integration Tests', () => {
  let server: PreviewServer;
  let serverUrl: string;
  let testPages: string[] = [];

  beforeAll(async () => {
    // Check if dist directory exists (site must be built first)
    if (!existsSync(distDir)) {
      throw new Error(
        'Dist directory not found. Please run `npm run build` before running integration tests.\n' +
        'The integration tests start a preview server, so the site must be built first.'
      );
    }

    // Start the preview server
    console.log('Starting preview server for integration tests...');
    server = await preview({
      root: projectRoot,
    });
    
    // Get the server URL - Astro preview server provides the URL in different ways
    // Try to get from resolvedUrls first, then fallback to constructing from server info
    if (server.server.resolvedUrls?.local && server.server.resolvedUrls.local.length > 0) {
      serverUrl = server.server.resolvedUrls.local[0];
    } else if (server.server.resolvedUrls?.network && server.server.resolvedUrls.network.length > 0) {
      serverUrl = server.server.resolvedUrls.network[0];
    } else {
      // Fallback: construct URL from server properties
      // The server object structure varies, so we need to check multiple properties
      const serverInfo = server.server as any;
      const port = serverInfo.port || 
                   serverInfo.address?.()?.port ||
                   (serverInfo.listeningAddress && typeof serverInfo.listeningAddress === 'string' 
                     ? new URL(serverInfo.listeningAddress).port 
                     : null) ||
                   4321; // Astro default port
      
      const hostname = serverInfo.hostname || 
                       serverInfo.host || 
                       'localhost';
      
      serverUrl = `http://${hostname}:${port}`;
    }
    
    console.log(`Preview server running at ${serverUrl}`);
    
    // Verify server is actually running by making a test request
    try {
      const testResponse = await fetch(`${serverUrl}/`);
      if (!testResponse.ok && testResponse.status !== 404) {
        throw new Error(`Server responded with status ${testResponse.status}`);
      }
      console.log('Server is responding to requests');
    } catch (error) {
      console.warn('Warning: Could not verify server is running:', error);
    }

    // Test common routes - start with homepage and 404
    // We can expand this to discover pages dynamically if needed
    testPages = [
      '/',
      '/404',
    ];

    // Try to discover additional pages by checking the sitemap or common routes
    // For now, we'll test the homepage which should have the navbar
    console.log(`Will test ${testPages.length} pages: ${testPages.join(', ')}`);
  }, 60000); // 60 second timeout for server startup

  afterAll(async () => {
    // Stop the preview server
    if (server) {
      await server.stop();
      console.log('Preview server stopped');
    }
  });

  describe('Page Rendering', () => {
    it('should render homepage without 404 errors', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Check for 404 indicators
      const is404 = (
        html.includes('404') && 
        (html.includes('Page Not Found') || html.includes('page not found') || html.includes('not found'))
      ) && !html.includes('This is the 404 page');

      expect(is404).toBe(false);
      expect(response.status).not.toBe(404);
    });

    it('should render pages without error messages', async () => {
      const errorPages: Array<{ path: string; reason: string }> = [];

      for (const pagePath of testPages) {
        try {
          const response = await fetch(`${serverUrl}${pagePath}`);
          const html = await response.text();
          
          // Check for actual JavaScript/runtime errors - be more specific
          // Look for error patterns that indicate actual failures, not just the words
          const hasRuntimeError = (
            // Actual error messages with stack traces
            (html.includes('TypeError:') || html.includes('ReferenceError:') || html.includes('SyntaxError:')) ||
            // Error objects in console output
            (html.includes('Error:') && html.match(/Error:\s*[A-Z]/)) ||
            // Cannot read property errors (specific pattern)
            (html.match(/Cannot\s+read\s+(properties?|property)\s+of\s+(undefined|null)/i)) ||
            // Uncaught errors in script tags
            (html.match(/<script[^>]*>[\s\S]*?(Uncaught|throw new Error|\.error\(|console\.error)[\s\S]*?<\/script>/i))
          );
          
          // Check for Astro/SSR error indicators - be specific
          const hasSSRError = (
            html.includes('[ERROR]') ||
            html.includes('ResponseSentError') ||
            html.includes('Transform failed') ||
            html.includes('Build failed') ||
            // Astro error page indicators
            (html.includes('Error') && html.includes('astro') && html.includes('failed'))
          );
          
          // Check for common error page patterns
          const isErrorPage = (
            html.includes('Internal Server Error') ||
            html.includes('500 Internal Server Error') ||
            html.match(/<title[^>]*>.*Error.*<\/title>/i) ||
            (html.includes('Something went wrong') && html.includes('error'))
          );
          
          if (hasRuntimeError || hasSSRError || isErrorPage) {
            let reason = '';
            if (hasRuntimeError) reason = 'Contains runtime error';
            else if (hasSSRError) reason = 'Contains SSR/build error';
            else if (isErrorPage) reason = 'Appears to be an error page';
            
            errorPages.push({ path: pagePath, reason });
          }
        } catch (error) {
          errorPages.push({ 
            path: pagePath, 
            reason: `Failed to fetch: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
      }

      if (errorPages.length > 0) {
        console.error('Pages with error messages:');
        errorPages.forEach(({ path, reason }) => {
          console.error(`  - ${path}: ${reason}`);
        });
      }

      expect(errorPages).toHaveLength(0);
    });
  });

  describe('Navbar Presence', () => {
    it('should have navbar on homepage', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Check for navbar element (nav tag with navbar classes or id)
      const hasNavbar = html.includes('<nav') && (
        html.includes('navbar') || 
        html.includes('nav') ||
        html.includes('menu')
      );

      expect(hasNavbar).toBe(true);
    });

    it('should have menu items in navbar', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Check for menu items (links or buttons in nav)
      const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
      expect(navMatch).not.toBeNull();
      
      if (navMatch) {
        const navContent = navMatch[1];
        const hasMenuItems = navContent.includes('<a') || navContent.includes('<button');
        expect(hasMenuItems).toBe(true);
      }
    });
  });

  describe('Menu Item Validation', () => {
    it('should have valid menu item links', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      const invalidLinks: Array<{ link: string; reason: string }> = [];
      
      // Extract all links from navbar
      const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
      if (navMatch) {
        const navContent = navMatch[1];
        const linkMatches = navContent.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
        
        for (const match of linkMatches) {
          const href = match[1];
          
          // Check for invalid links
          if (href && (
            href.includes('undefined') ||
            href.includes('null') ||
            href.includes('error') ||
            (href.startsWith('/') && !isValidPath(href))
          )) {
            invalidLinks.push({ link: href, reason: 'Invalid link format' });
          }
        }
      }

      if (invalidLinks.length > 0) {
        console.error('Invalid menu item links:');
        invalidLinks.forEach(({ link, reason }) => {
          console.error(`  - ${link}: ${reason}`);
        });
      }

      expect(invalidLinks).toHaveLength(0);
    });

    it('should have menu item labels', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Check for menu item text content
      const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
      expect(navMatch).not.toBeNull();
      
      if (navMatch) {
        const navContent = navMatch[1];
        // Check if there's text content in links/buttons
        const hasTextContent = /<a[^>]*>[\s\S]*?[A-Za-z][\s\S]*?<\/a>|<button[^>]*>[\s\S]*?[A-Za-z][\s\S]*?<\/button>/i.test(navContent);
        
        expect(hasTextContent).toBe(true);
      }
    });
  });

  describe('Page Content', () => {
    it('should have valid HTML structure', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Basic HTML structure checks
      const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
      const hasHtmlTag = html.includes('<html') || html.includes('<HTML');
      const hasBodyTag = html.includes('<body') || html.includes('<BODY');
      
      expect(hasDoctype).toBe(true);
      expect(hasHtmlTag).toBe(true);
      expect(hasBodyTag).toBe(true);
    });

    it('should have page content', async () => {
      const response = await fetch(`${serverUrl}/`);
      const html = await response.text();
      
      // Check for title tag or heading
      const hasTitle = html.includes('<title') || html.includes('<h1') || html.includes('<h2');
      
      expect(hasTitle).toBe(true);
    });

    it('should return 200 status for homepage', async () => {
      const response = await fetch(`${serverUrl}/`);
      expect(response.status).toBe(200);
    });
  });
});

/**
 * Basic validation for path format
 */
function isValidPath(path: string): boolean {
  // Check for basic path issues
  if (path.includes('undefined') || path.includes('null')) {
    return false;
  }
  
  // Check for double slashes (except protocol)
  if (path.includes('//') && !path.startsWith('http://') && !path.startsWith('https://')) {
    return false;
  }
  
  return true;
}
