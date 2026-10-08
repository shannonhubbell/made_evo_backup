import type { APIContext } from "astro";


export function GET({ request }: APIContext) {
  let response = new Response(
    "# Foo"
  );
  response.headers.set("Content-Type", "text/markdown");
  return response;
}