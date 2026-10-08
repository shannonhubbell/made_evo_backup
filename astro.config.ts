// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";

import tailwindcss from "@tailwindcss/vite";
import { squareCatalogIntegration } from "./src/integrations/square-catalog";

// Cloudflare configuration
// Use server mode to enable on-demand rendering, with pages opting into prerendering
// Cloudflare Pages automatically sets CF_PAGES=true
const isCloudflare =
  process.env.CF_PAGES === "true" || process.env.CLOUDFLARE === "true";
const forceStatic = process.env.STATIC_BUILD === "true";

// Static builds prerender eligible pages; routes marked prerender=false remain
// server-rendered by the Cloudflare adapter.
const output: "static" | "server" = forceStatic ? "static" : "server";

// https://astro.build/config
export default defineConfig({
  // Canonical, deployed domain. Astro uses this to build absolute URLs (e.g. in
  // context.site / Astro.site), which the sitemap and RSS feed rely on so their
  // <loc>/<link> entries are full URLs rather than paths relative to whatever
  // host happens to serve the request (localhost, a preview deployment, etc.)
  site: "https://www.themade.org",

  output,
  adapter: cloudflare({
    imageService: "cloudflare",
  }),

  integrations: [
    svelte({
      extensions: [".svelte"],
    }),
    vue(),
    squareCatalogIntegration(),
  ],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // Externalize Node.js built-in modules that Cloudflare doesn't support
      // These warnings are expected and handled by Cloudflare's nodejs_compat flag
      noExternal: [],
    },
    build: {
      // Suppress chunk size warning for apexcharts (known large dependency)
      chunkSizeWarningLimit: 600,
    },
  },
});
