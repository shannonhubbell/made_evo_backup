/**
 * Page metadata resolution utilities
 *
 * Generates a page-specific title/description/social-share image for a given Contentful
 * Page, using (in priority order):
 *   1. The Page entry's own `title`/`description`/`image` fields (primary source, once an
 *      editor fills them in).
 *   2. If missing, the first Post-derived content view (double/single column, mini splash) -
 *      its rendered body copy holds the page's most salient information: its heading(s) are
 *      the punchiest summary, and the paragraph right after gives supporting detail. Its
 *      image is used as an image fallback too.
 *   3. If still missing, the page's Splash content view (if present) - its subtitle is
 *      normally a short tagline (e.g. a recurring schedule blurb for Program pages) that at
 *      least captures the page's salient "category", and its poster gives a strong visual -
 *      generally nicer than a Post's inline image, so it's preferred for the image fallback
 *      ahead of step 2's post image.
 *
 * Used by Layout.astro (via data_specific/Page.astro and friends) to populate <title>,
 * <meta name="description">, and Open Graph/Twitter Card tags per-page instead of the site's
 * generic defaults.
 */

import type { WidgetData } from "../schema/ui/widget-data";
import type { SplashProps, DoubleColumnItem } from "../schema/ui";

export interface ResolvedPageMeta {
  title?: string;
  sharingTitle?: string;
  sharingImage?: string;
  description?: string;
  image?: string;
}

export interface PageMetaContentViewItem {
  type: string;
  data: WidgetData;
}

/** Strips HTML tags and decodes common entities, leaving plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncates text to at most `maxLength` characters, breaking on a word boundary when possible. */
export function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const boundary = lastSpace > maxLength * 0.6 ? lastSpace : cut.length;
  return `${cut.slice(0, boundary)}\u2026`;
}

/**
 * Pulls the first heading and the first paragraph out of rendered rich-text HTML (as
 * produced by `documentToHtmlString`). The heading is normally the punchiest summary of the
 * content (e.g. "TUESDAYS 12 TO 4 PM"), and the paragraph right after fills in supporting
 * detail - combined, they make a solid page description.
 */
export function extractHeadingAndParagraph(html: string): {
  heading?: string;
  paragraph?: string;
} {
  const headingMatch = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const heading = headingMatch ? stripHtml(headingMatch[1]) : undefined;
  const paragraph = paragraphMatch ? stripHtml(paragraphMatch[1]) : undefined;
  return {
    heading: heading || undefined,
    paragraph: paragraph || undefined,
  };
}

const DESCRIPTION_MAX_LENGTH = 160;

/**
 * Resolves the best available title/description/image for a page, falling back through
 * its content views when the Page entry itself doesn't have its own metadata set.
 */
export function resolvePageMeta({
  pageTitle,
  sharingTitle,
  sharingImage,
  pageDescription,
  pageImage,
  items,
}: {
  pageTitle?: string | null;
  sharingTitle?: string | null;
  sharingImage?: string | null;
  pageDescription?: string | null;
  pageImage?: string | null;
  items: PageMetaContentViewItem[];
}): ResolvedPageMeta {
  let description = pageDescription?.trim() || undefined;
  let image = pageImage?.trim() || undefined;

  const splashData = items.find((i) => i.type === "splash")?.data as
    | SplashProps
    | undefined;
  const splashContent = splashData?.contents?.[0];

  const postWidgetTypes = ["doubleColumn", "singleColumn", "miniSplash"];
  const postWidget = items.find((i) => postWidgetTypes.includes(i.type))
    ?.data as { items?: DoubleColumnItem[] } | undefined;
  const firstPostItem = postWidget?.items?.[0];

  // Description: prefer the Post-derived widget's heading + paragraph (the most salient,
  // on-topic prose available), falling back to the Splash's tagline-style subtitle.
  if (!description && firstPostItem?.content) {
    const { heading, paragraph } = extractHeadingAndParagraph(
      firstPostItem.content
    );
    const combined = [heading, paragraph].filter(Boolean).join(" \u2014 ");
    if (combined) description = combined;
  }
  if (!description && splashContent?.subtitle?.trim()) {
    description = splashContent.subtitle.trim();
  }

  // Image: prefer the Splash's poster (usually a nicer hero shot), falling back to the
  // first Post-derived item's own image.
  if (!image && splashContent?.videoPoster?.trim()) {
    image = splashContent.videoPoster.trim();
  }
  if (!image && firstPostItem?.image?.trim()) {
    image = firstPostItem.image.trim();
  }

  return {
    title: pageTitle?.trim() || undefined,
    sharingTitle: sharingTitle?.trim() || undefined,
    sharingImage: sharingImage || undefined,
    description: description
      ? truncateText(description, DESCRIPTION_MAX_LENGTH)
      : undefined,
    image,
  };
}
