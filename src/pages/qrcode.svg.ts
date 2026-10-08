import type { APIContext, APIRoute } from "astro";
import { getQrCodeParams, generateQrCodeSvg } from "../lib/qrcode";

// Always server-rendered so the QR code reflects the request's query params
export const prerender = false;

export const GET: APIRoute = ({ url }: APIContext) => {
  const params = getQrCodeParams(url.searchParams);
  const svg = generateQrCodeSvg(params);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
