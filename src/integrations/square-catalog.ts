import type { AstroIntegration } from 'astro';

export function squareCatalogIntegration(): AstroIntegration {
  return {
    name: 'square-catalog',
    hooks: {
      'astro:build:setup': async () => {
        // Skip on Cloudflare builds - the script is already run in the build command
        // Cloudflare's build environment doesn't support execSync reliably
        const isCloudflare = process.env.CF_PAGES === 'true' || 
                            process.env.CLOUDFLARE === 'true' ||
                            process.env.CI === 'true'; // Also skip in CI environments
        
        if (isCloudflare) {
          console.log('[square-catalog] Skipping catalog generation in Cloudflare build (already handled by build script)');
          return;
        }

        // Only run in local development when astro build is run directly
        // In production builds, this is handled by the npm build script
        try {
          const { execSync } = await import('child_process');
          const { fileURLToPath } = await import('url');
          const path = await import('path');
          
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const projectRoot = path.resolve(__dirname, '../..');

          console.log('[square-catalog] Generating Square catalog...');
          
          // Run the Square catalog generation script via npm
          execSync('npm run generate:square-catalog-static', {
            cwd: projectRoot,
            stdio: 'inherit',
            env: { ...import.meta.env },
          });
          console.log('[square-catalog] Square catalog generated successfully');
        } catch (error: any) {
          // Don't fail the build if this fails - it might already be generated
          // or the script might not be available in all environments
          console.warn('[square-catalog] Could not generate catalog (this is OK if already generated):', error?.message || error);
        }
      },
    },
  };
}

