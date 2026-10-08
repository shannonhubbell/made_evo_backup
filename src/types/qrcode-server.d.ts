// The "qrcode" package's package.json remaps "./lib/index.js" to "./lib/browser.js"
// via its "browser" field, which some bundlers (including Cloudflare Workers'
// esbuild-based bundling) apply even for server-side code. The browser build
// requires a DOM `canvas` element and lacks `toBuffer`. Importing the server
// renderer directly (bypassing the "browser" remap) avoids this issue.
// See: https://github.com/soldair/node-qrcode/issues/349
declare module "qrcode/lib/server.js" {
  import type { QRCodeToBufferOptions } from "qrcode";

  export function toBuffer(
    text: string,
    options: QRCodeToBufferOptions,
    callback: (error: Error | null | undefined, buffer: Buffer) => void
  ): void;
}
