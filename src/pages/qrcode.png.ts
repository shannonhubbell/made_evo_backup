import type { APIContext, APIRoute } from "astro";
// Import the server renderer directly rather than the package's default entry:
// see made_evo/src/types/qrcode-server.d.ts for why.
import { toBuffer } from "qrcode/lib/server.js";
import { getQrCodeParams } from "../lib/qrcode";

// Always server-rendered so the QR code reflects the request's query params
export const prerender = false;

export const GET: APIRoute = ({ url }: APIContext) => {
  const params = getQrCodeParams(url.searchParams);

  return new Promise<Response>((resolve, reject) => {
    toBuffer(
      params.url,
      {
        errorCorrectionLevel: "M",
        margin: 4,
        width: params.width,
        color: {
          dark: params.color,
          light: params.background,
        },
      },
      (error, buffer) => {
        if (error || !buffer) {
          reject(error ?? new Error("Failed to render QR code PNG"));
          return;
        }

        resolve(
          new Response(new Uint8Array(buffer), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600",
            },
          })
        );
      }
    );
  });
};
