import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());
}

function buildAssetMap(
  content:
    | { links?: { assets?: { block?: unknown[]; hyperlink?: unknown[] } } }
    | null
    | undefined
): Map<string, any> {
  const assetMap = new Map<string, any>();
  const assets = content?.links?.assets;
  const merged = [...(assets?.block ?? []), ...(assets?.hyperlink ?? [])];
  for (const asset of merged) {
    const id = (asset as { sys?: { id?: string } })?.sys?.id;
    if (id) assetMap.set(id, asset);
  }
  return assetMap;
}

function renderEmbeddedAssetHtml(asset: {
  url?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}): string {
  const url = asset?.url;
  if (!url) return "";

  const alt = asset?.title || asset?.description || "";
  const width = typeof asset?.width === "number" ? asset.width : undefined;
  const height = typeof asset?.height === "number" ? asset.height : undefined;

  if (isVideoUrl(url)) {
    return `
      <video controls playsinline class="w-full max-w-full">
        <source src="${escapeHtmlAttribute(url)}" />
        Your browser does not support the video tag.
      </video>
    `.trim();
  }

  return `
    <img
      src="${escapeHtmlAttribute(url)}"
      alt="${escapeHtmlAttribute(alt)}"
      ${width ? `width="${width}"` : ""}
      ${height ? `height="${height}"` : ""}
    />
  `.trim();
}

/**
 * Default `documentToHtmlString` has no renderer for `embedded-asset-block`, so embedded
 * images/videos disappear. This merges `content.links.assets` from GraphQL and renders
 * `&lt;img&gt;` / `&lt;video&gt;` plus asset hyperlinks.
 */
export function renderContentfulRichTextWithEmbeddedAssets(
  content: any
): string {
  const json = content?.json;
  if (!json) return "";

  const assetMap = buildAssetMap(content);

  return documentToHtmlString(json, {
    // Contentful stores soft line breaks (Shift+Enter) as literal "\n" characters
    // within a text node's value, rather than as separate nodes. Without this
    // option, `documentToHtmlString` leaves them as-is and the browser collapses
    // them into a single space, so intentional line breaks are lost. Setting
    // `preserveWhitespace` converts them into `<br/>` tags instead.
    preserveWhitespace: true,
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node: {
        data?: { target?: { sys?: { id?: string } } };
      }) => {
        const assetId = node?.data?.target?.sys?.id;
        const asset = assetId ? assetMap.get(assetId) : undefined;
        if (!asset) return "";
        return renderEmbeddedAssetHtml(asset);
      },
      [INLINES.ASSET_HYPERLINK]: (
        node: any,
        next: (nodes: any[]) => string
      ) => {
        const assetId = node?.data?.target?.sys?.id;
        const asset = assetId ? assetMap.get(assetId) : undefined;
        const url = asset?.url;
        if (!url) return next(node.content);
        const inner = next(node.content);
        return `<a href="${escapeHtmlAttribute(url)}">${inner}</a>`;
      },
    },
  });
}
