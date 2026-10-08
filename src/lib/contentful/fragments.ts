/**
 * GraphQL Query Fragments for Contentful
 *
 * This file contains reusable GraphQL fragments for querying Contentful content types.
 * Fragments are used to ensure consistent field selection across queries and enable
 * type-safe query building.
 *
 * Usage:
 *   import { ProgramFields, EventFields } from './fragments';
 *   const query = `{ programCollection { items { ${ProgramFields} } } }`;
 */

/**
 * Base sys fields that are included in all content types
 * Note: Contentful GraphQL API only supports id and publishedAt on Sys type
 */
export const SysFields = `
  sys {
    id
    publishedAt
  }
`;

/** Rich Text `links.assets` for embedded images/videos (block + inline asset links) */
export const RichTextAssetLinkFields = `
  sys {
    id
  }
  url
  title
  description
  width
  height
`;

/**
 * Program content type fields - Full version
 * Use for single program queries
 */
export const ProgramFields = `
  ${SysFields}
  name
  title
  description
  url
  recurringWeekday
  content {
    json
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
`;

/**
 * Program fields - Simplified version for collection queries
 * Reduces query complexity by limiting nested collections
 */
export const ProgramFieldsSimple = `
  ${SysFields}
  name
  title
  description
  url
  recurringWeekday
  imageCollection(limit: 1) {
    items {
      sys {
        id
      }
      url
    }
  }
`;

/**
 * Event content type fields - Full version with all nested data
 * Use for single event queries or when all data is needed
 */
export const EventFields = `
  ${SysFields}
  name
  title
  startDate
  endDate
  slug
  description
  content {
    json
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  presenterCollection {
    items {
      sys {
        id
      }
      firstName
      lastName
    }
  }
  program {
    sys {
      id
    }
    title
    url
  }
  callToAction {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * Event fields - Simplified version for grid/calendar queries
 * Reduces query complexity by limiting nested collections
 */
export const EventFieldsSimple = `
  ${SysFields}
  name
  title
  startDate
  endDate
  slug
  description
  imageCollection(limit: 1) {
    items {
      sys {
        id
      }
      url
    }
  }
  program {
    sys {
      id
    }
    title
    url
  }
  callToAction {
    sys {
      id
    }
    title
    url
  }
  callToAction {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * Post content type fields - Full version with all nested data
 * Use for single post queries or when all data is needed
 */
export const PostFields = `
  ${SysFields}
  name
  title
  slug
  description
  content {
    json
  }
  date
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  videoCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  callToAction {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * Post fields - Simplified version for double/single column queries
 * Removes unnecessary collections to reduce query complexity
 * Note: Still includes content.json as it's needed for rendering
 */
export const PostFieldsSimple = `
  ${SysFields}
  name
  title
  slug
  description
  content {
    json
  }
  date
  imageCollection(limit: 1) {
    items {
      sys {
        id
      }
      url
    }
  }
  callToAction {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * Post fields - Minimal version for grid queries
 * Removes content.json and collections to minimize complexity
 */
export const PostFieldsMinimal = `
  ${SysFields}
  name
  title
  slug
  description
  date
  callToAction {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * Page content type fields
 * Matches: src/generated/contentful-types.ts - Page interface
 */
export const PageFields = `
  ${SysFields}
  name
  title
  sharingTitle
  slug
  description
  sharingImage {
    sys {
        id
    }
    url
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  contentViewCollection {
    items {
      ${SysFields}
      name
      title
      type
      keys
      values
      isAtomic
      isTitleVisible
      dataAdapter {
        sys {
          id
        }
        name
      }
      targetCollection {
        items {
          ... on Page {
            sys {
              id
            }
          }
          ... on Event {
            sys {
              id
            }
          }
          ... on Program {
            sys {
              id
            }
          }
          ... on Exhibit {
            sys {
              id
            }
          }
          ... on Member {
            sys {
              id
            }
          }
          ... on Post {
            sys {
              id
            }
          }
          ... on ImpactReport {
            sys {
              id
            }
          }
          ... on GoogleForm {
            sys {
              id
            }
          }
          ... on Organization {
            sys {
              id
            }
          }
        }
      }
    }
  }
`;

/**
 * ContentView fields (used in Page queries)
 */
export const ContentViewFields = `
  ${SysFields}
  name
  title
  type
  keys
  values
  isAtomic
  isTitleVisible
  dataAdapter {
    sys {
      id
    }
    name
  }
  targetCollection {
    items {
      ... on Page {
        sys {
          id
        }
      }
      ... on Event {
        sys {
          id
        }
      }
      ... on Program {
        sys {
          id
        }
      }
      ... on Exhibit {
        sys {
          id
        }
      }
      ... on Member {
        sys {
          id
        }
      }
      ... on Post {
        sys {
          id
        }
      }
      ... on ImpactReport {
        sys {
          id
        }
      }
      ... on GoogleForm {
        sys {
          id
        }
      }
      ... on Organization {
        sys {
          id
        }
      }
    }
  }
`;

/**
 * Alert content type fields
 * Matches: src/generated/contentful-types.ts - Alert interface
 *
 * `callToAction` is a polymorphic reference (validated in Contentful to link to either
 * a CallToAction or a Post entry) - the inline fragments below resolve whichever one
 * it points to so the caller can decide how to build a link (CallToAction.url is used
 * directly; Post.slug needs to be built into a locale-prefixed /blog/posts/{slug} URL).
 */
export const AlertFields = `
  ${SysFields}
  name
  title
  startDate
  endDate
  type
  callToAction {
    ... on CallToAction {
      sys {
        id
      }
      title
      url
    }
    ... on Post {
      sys {
        id
      }
      title
      slug
    }
  }
`;

/**
 * Redirect content type fields
 * Matches: src/generated/contentful-types.ts - Redirect interface
 * Maps a legacy/broken sourceUrl to a targetUrl to serve as a redirect
 * when no Page matches the requested slug.
 */
export const RedirectFields = `
  ${SysFields}
  name
  sourceUrl
  targetUrl
`;

/**
 * MenuItem content type fields
 * Matches: src/generated/contentful-types.ts - MenuItem interface
 */
export const MenuItemFields = `
  ${SysFields}
  name
  label
  href
  active
  isButton
  isTopLevel
  index
  childrenCollection {
    items {
      ${SysFields}
      name
      label
      href
      index
    }
  }
`;

/**
 * Exhibit — list/grid/collection queries (low GraphQL complexity).
 * Rich text links omitted; use ExhibitFieldsWithEmbeddedAssetLinks on single-item fetches.
 */
export const ExhibitFields = `
  ${SysFields}
  name
  title
  slug
  status
  creator
  releaseDate
  startDate
  endDate
  isDateEstimated
  content {
    json
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
`;

/**
 * Exhibit — single exhibit by slug (detail page). Includes rich-text asset links for embedded media.
 */
export const ExhibitFieldsWithEmbeddedAssetLinks = `
  ${SysFields}
  name
  title
  slug
  status
  creator
  releaseDate
  startDate
  endDate
  isDateEstimated
  content {
    json
    links {
      assets {
        block {
          ${RichTextAssetLinkFields}
        }
        hyperlink {
          ${RichTextAssetLinkFields}
        }
      }
    }
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  program {
    sys {
      id
    }
    title
    url
  }
`;

/**
 * VideoGame — collection queries (low complexity).
 */
export const VideoGameFields = `
  ${SysFields}
  name
  title
  slug
  creator
  releaseDate
  isDateEstimated
  content {
    json
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  exhibit {
    sys {
      id
    }
  }
`;

/**
 * VideoGame — single game by slug (detail page).
 */
export const VideoGameFieldsWithEmbeddedAssetLinks = `
  ${SysFields}
  name
  title
  slug
  creator
  releaseDate
  isDateEstimated
  content {
    json
    links {
      assets {
        block {
          ${RichTextAssetLinkFields}
        }
        hyperlink {
          ${RichTextAssetLinkFields}
        }
      }
    }
  }
  imageCollection {
    items {
      sys {
        id
      }
      url
    }
  }
  exhibit {
    sys {
      id
    }
  }
`;

/**
 * Member content type fields
 * Matches: src/generated/contentful-types.ts - Member interface
 */
export const MemberFields = `
  ${SysFields}
  firstName
  lastName
  email
  displayName
  role
  description
  displayPriority
`;

/**
 * ImpactReport content type fields
 * Matches: src/generated/contentful-types.ts - ImpactReport interface
 */
export const ImpactReportFields = `
  ${SysFields}
  name
  date
  period
  title
  description {
    json
  }
  goal {
    json
    links {
      assets {
        block {
          sys {
            id
          }
          url
          title
          description
          width
          height
        }
      }
    }
  }
  programCollection {
    items {
      ${SysFields}
      name
      title
      description
    }
  }
`;

/**
 * Metric content type fields
 * Matches: src/generated/contentful-types.ts - Metric interface
 */
export const MetricFields = `
  ${SysFields}
  name
  title
  description
  countType
  content {
    json
  }
  program {
    sys {
      id
    }
    title
  }
  inverted
`;

/**
 * MetricPeriod content type fields
 * Matches: src/generated/contentful-types.ts - MetricPeriod interface
 */
export const MetricPeriodFields = `
  ${SysFields}
  name
  title
  startDate
  endDate
  graphType
  data
  metric {
    sys {
      id
    }
    program {
      sys {
        id
      }
    }
  }
`;

/**
 * Press content type fields
 * Matches: src/generated/contentful-types.ts - Press interface
 */
export const PressFields = `
  ${SysFields}
  name
  title
  description
  content {
    json
  }
  url
  date
  slug
  organization {
    ... on Organization {
      sys {
        id
      }
      name
      title
    }
  }
`;

/**
 * CallToAction content type fields
 * Matches: src/generated/contentful-types.ts - CallToAction interface
 */
export const CallToActionFields = `
  ${SysFields}
  name
  title
  url
`;

/**
 * GoogleForm content type fields
 * Matches: src/generated/contentful-types.ts - GoogleForm interface
 */
export const GoogleFormFields = `
  ${SysFields}
  name
  slug
  formId
`;

/**
 * SpreadsheetForm content type fields
 * Matches: src/generated/contentful-types.ts - SpreadsheetForm interface
 */
export const SpreadsheetFormFields = `
  ${SysFields}
  name
  slug
  spreadsheetId
  tableName
`;

export const SocialMediaHandleFields = `
  ${SysFields}
  name
  category
  displayName
  url
  icon {
    sys {
      id
    }
    url
  }
`;

/**
 * Organization content type fields
 * Used for e.g. partner/sponsor logos (see the Image Marquee widget).
 */
export const OrganizationFields = `
  ${SysFields}
  name
  title
  entityType
  url
  logo {
    sys {
      id
    }
    url
  }
`;

/**
 * Minimal slug + sys fields shared by every content type that has its own dedicated
 * page route (Page, Post, Event, Exhibit, VideoGame). Used by the sitemap generator,
 * which needs to enumerate every entry across these types without pulling in their
 * heavier nested fields (e.g. Page's contentViewCollection), which can exceed
 * Contentful's GraphQL complexity budget on large collections.
 */
export const SitemapFields = `
  sys {
    id
    publishedAt
  }
  slug
`;

/**
 * Minimal fields for ID-only queries (used for references)
 */
export const IdOnlyFields = `
  sys {
    id
  }
`;

/**
 * Minimal fields for title-only queries
 */
export const TitleOnlyFields = `
  sys {
    id
  }
  title
`;
