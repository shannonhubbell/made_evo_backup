import type { APIRoute } from "astro";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as UISchemas from "../../schema/ui";
import * as ReportSchemas from "../../schema/ui/report";
import * as ContentfulSchemas from "../../schema/contentful";

// Prerender this route - it generates static JSON that can be built at build time
// For static builds (GitHub Pages), this will be prerendered
// For server builds, this will still work but be generated on-demand
// export const prerender = true;

// Helper function to check if a value is a Zod schema
function isZodSchema(value: any): value is z.ZodTypeAny {
  return (
    value &&
    typeof value === 'object' &&
    '_def' in value &&
    typeof value.parse === 'function' &&
    typeof value.safeParse === 'function'
  );
}

// Helper function to collect and convert schemas from a module
function collectSchemas(
  module: Record<string, any>,
  prefix: string
): Record<string, any> {
  const schemas: Record<string, any> = {};
  
  for (const [name, value] of Object.entries(module)) {
    // Skip non-schema exports (types, functions, etc.)
    if (!isZodSchema(value)) continue;
    
    // Skip if name doesn't end with "Schema" (convention)
    if (!name.endsWith('Schema')) continue;
    
    try {
      schemas[`${prefix}.${name}`] = zodToJsonSchema(value, {
        name: name,
        target: 'openApi3',
      });
    } catch (error: any) {
      console.error(`Error converting ${prefix} schema ${name}:`, error.message);
      // Include error in output for debugging
      schemas[`${prefix}.${name}`] = {
        error: `Failed to convert: ${error.message}`,
      };
    }
  }
  
  return schemas;
}

export const GET: APIRoute = async () => {
  try {
    // Collect all exported Zod schemas
    const allSchemas: Record<string, any> = {
      ...collectSchemas(UISchemas, 'UI'),
      ...collectSchemas(ReportSchemas, 'Report'),
      ...collectSchemas(ContentfulSchemas, 'Contentful'),
    };

    return new Response(JSON.stringify(allSchemas, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate schemas" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

