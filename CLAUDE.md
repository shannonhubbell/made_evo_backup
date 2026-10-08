# CLAUDE.md

This file orients coding agents (Claude, or any other agent) working in this repository. Read this first, then dive into the more detailed docs it links to as needed. Don't duplicate content that's already documented elsewhere — this file is a map, not the territory.

## What this project is

**MADE Evo** is the website for The MADE (Museum of Art and Digital Entertainment), built with **Astro**. Content is authored in **Contentful** (headless CMS) and rendered through a generic, schema-validated "widget" system, so most pages are built by editors composing content views in Contentful rather than by writing new page templates.

## Tech stack

- **Astro 5** (SSR, `output: "server"`) deployed to **Cloudflare Pages/Workers** via `@astrojs/cloudflare` (see `astro.config.ts`, `wrangler.jsonc`)
- **Contentful** as the CMS, queried via GraphQL (Content Delivery / Preview API)
- **Tailwind CSS 4** (via `@tailwindcss/vite`, config in `tailwind.config.ts`)
- **Svelte** and **Vue** for hydrated interactive islands (`@astrojs/svelte`, `@astrojs/vue`)
- **Zod** for runtime schema validation
- **Square** for e-commerce/store catalog, **Google APIs** (Forms/Sheets), **Figma API** (design-to-content tooling), **Slack** webhooks, **Eventbrite** import
- **Vitest** for testing
- Package manager: npm. Astro CLI: `npm run astro ...`

## Repo layout

```
made_evo/
├── src/
│   ├── pages/                 # Astro routes (file-based routing)
│   │   ├── [slug].astro       # Legacy non-locale page slug -> redirects to /:locale/:slug
│   │   ├── [locale]/          # Locale-prefixed routes (/en/..., /es/...)
│   │   │   ├── [slug].astro   # Generic CMS page renderer (fetches Page by slug)
│   │   │   ├── event/, exhibit/, store/, video_game/, blog/  # Content-type detail routes
│   │   │   └── qr.astro
│   │   └── api/                # Server endpoints (webhooks, forms, etc.)
│   ├── components/
│   │   ├── data_specific/      # Components bound to a Contentful content type (Page, Event, Post, Exhibit, VideoGame, PostList)
│   │   ├── hydrated/            # Svelte/Vue islands (calendar, forms, graphs, store checkout)
│   │   ├── integrations/        # Third-party embeds (Mailchimp, etc.)
│   │   └── *.astro              # Widget/presentation components (Splash, ResponsiveGrid, CategorizedCatalog, Calendar, Report, etc.) — one per WidgetType
│   ├── lib/
│   │   ├── adapters.ts          # All adapter functions (Contentful data -> WidgetData)
│   │   ├── adapters/
│   │   │   ├── registry.ts      # Adapter registry: id/name -> handler + metadata
│   │   │   ├── id-mapping.ts    # Contentful adapter entry name -> stable adapter id
│   │   │   ├── validation.ts    # validateContentfulData / validation error types
│   │   │   ├── google-form.ts, spreadsheet-form.ts  # Extra adapter implementations
│   │   │   └── __tests__/
│   │   ├── components/
│   │   │   ├── component-map.ts # WidgetType <-> expected WidgetData shape/validators
│   │   │   └── renderer.ts      # validateWidgetDataForRendering, error component helper
│   │   ├── contentful.ts        # High-level Contentful data access (getPageBySlug, getAdapterDataByType, getByQuery, ...)
│   │   ├── contentful/
│   │   │   ├── fragments.ts     # Reusable GraphQL field fragments per content type
│   │   │   ├── query-builder.ts # Type-safe query builders (queryEvents, queryPosts, ...)
│   │   │   ├── locales.ts       # Locale detection/validation/normalization
│   │   │   └── rich-text.ts     # Contentful rich text -> HTML helpers
│   │   ├── square/               # Square catalog/checkout integration
│   │   ├── helpers.ts, images.ts, seo.ts, qrcode.ts, slack.ts, google-*.ts
│   │   └── __tests__/
│   ├── schema/
│   │   ├── contentful/          # Zod schemas matching raw Contentful GraphQL responses
│   │   ├── ui/                  # Zod schemas for transformed UI/component data + WidgetData union (widget-data.ts)
│   │   └── DataSchema.ts        # Legacy, being phased out — avoid extending
│   ├── generated/
│   │   └── contentful-types.ts  # AUTO-GENERATED from Contentful; never hand-edit (see scripts/generate-contentful-types.ts)
│   ├── integrations/
│   │   └── square-catalog.ts    # Astro integration hook for build-time Square catalog generation
│   ├── layouts/Layout.astro     # Root HTML shell (nav, footer, theme, SEO tags)
│   ├── middleware.ts            # Locale detection (path/query/cookie) -> Astro.locals.locale
│   ├── testContent/             # Static JSON fixtures for local/offline content
│   └── styles/global.css
├── scripts/                     # One-off/CLI tsx scripts (type generation, migrations, imports, validation)
├── tools/contentful/             # Larger Contentful tooling (space backup, slug generation, Figma-to-Contentful pipeline)
├── docs/                         # Deep-dive docs (deployment, env vars, multi-language, Square, Contentful preview)
├── ARCHITECTURE_ANALYSIS.md      # Original architecture review/recommendations
├── ARCHITECTURE_MIGRATION_12_2025.md  # Migration tracking for the schema/type-safety work (now complete)
├── ARCHITECTURE_MIGRATION_NOTES.md
└── astro.config.ts, tailwind.config.ts, tsconfig.json, vitest.config.ts, wrangler.jsonc
```

## The core architecture: CMS-driven widgets

This is the single most important pattern to understand before making changes. Full detail lives in **`docs/DEVELOPER_GUIDE.md`** — read it before touching adapters/schemas. Short version:

```
Contentful Page entry
  -> contentViewCollection (ordered list of ContentView entries; each has a `type`, a `dataAdapter` reference, `keys`/`values` config pairs, and optional `targetCollection`)
  -> for each ContentView: getAdapterDataByType() looks up the adapter by Contentful entry name (via nameToStableId) or stable id in the registry
  -> adapter handler(keys, values, targetIDs, isAtomic) runs:
       1. builds a GraphQL query (via lib/contentful/query-builder.ts + fragments.ts — never write raw ad-hoc GraphQL strings)
       2. fetches via getByQuery()/getByQueryAndVariables()
       3. validates the raw response against a Contentful schema (src/schema/contentful)
       4. transforms Contentful shape -> UI shape
       5. validates the transformed result against a UI schema, returning one of the WidgetData union members (src/schema/ui/widget-data.ts)
  -> src/components/data_specific/Page.astro validates the WidgetData against the declared WidgetType (lib/components/renderer.ts) and renders the matching *.astro component (Splash, ResponsiveGrid, CategorizedCatalog, Calendar, Report, DoubleColumn, SingleColumn, MiniSplash, ImageMarquee, VerticalTimeline, Store, GoogleFormLoader, ...)
```

Key files for this flow: `src/lib/contentful.ts` (`getPageBySlug`, `getAdapterDataByType`), `src/lib/adapters.ts`, `src/lib/adapters/registry.ts`, `src/lib/components/component-map.ts`, `src/components/data_specific/Page.astro`.

### Adapter conventions worth knowing

- Every adapter has the signature `(keys: string[], values: string[], targetIDs: string[], isAtomic: boolean) => Promise<WidgetData>`. `keys`/`values` are parallel arrays configured per-ContentView in Contentful — a generic, low-code way for editors to pass adapter options without new fields/code.
- Recognized `keys` entries are matched **case-insensitively** by `.toLowerCase()`, e.g. `orderBy`/`orderDirection` (see `resolveOrderClause` in `adapters.ts`), `program` (in `categorizedGridFromUpcomingEvents`), `slug` (in `googleFormFromGoogleForm`), `keyword` (in `gridFromEvents`, filters by a Contentful tag via `contentfulMetadata: { tags: { id_contains_some: [...] } }`). When adding a new configurable option to an adapter, follow this same pattern for consistency rather than inventing a new mechanism.
- Adapters are registered once in `src/lib/adapters/registry.ts` with metadata (`id`, Contentful `name`/`contentfulName`, `inputTypes`, `outputType`, `isAtomic`, `description`). The registry is looked up by both stable id and Contentful entry name.
- `scripts/populate-adapter-id-mapping.ts` maintains the Contentful-name -> stable-id table (`src/lib/adapters/id-mapping.ts`) — rerun it (`npm run populate:adapter-mapping`, or the umbrella `npm run sync:contentful`) if adapter names change in Contentful.
- Always validate: Contentful response -> `validateContentfulData(data, SomeSchema, "context label")` -> transform -> `SomeUiSchema.parse(...)`. Don't skip either half.

### Schema system (`src/schema/`)

Two-tier, by design (see `src/schema/README.md`):
- `src/schema/contentful/` — mirrors raw Contentful GraphQL shape (`imageCollection`, `sys`, etc.)
- `src/schema/ui/` — mirrors what components actually consume (`image`, flattened fields); `widget-data.ts` defines the `WidgetData` discriminated union that every adapter must return one member of.
- `src/schema/DataSchema.ts` is legacy — don't build new features on it.

### Generated types

`src/generated/contentful-types.ts` is generated by `scripts/generate-contentful-types.ts` (`npm run generate:types`) from the live Contentful space. **Never hand-edit it.** It's regenerated automatically as part of `npm run build` / `npm run sync:contentful`.

## Localization

- Locale is resolved once per request in `src/middleware.ts` (`Astro.locals.locale`), from (in priority order) `?locale=` query param, `/:locale/...` path segment, `NEXT_LOCALE` cookie, then request `Accept-Language`. See `src/lib/contentful/locales.ts` for the locale list/validation/normalization helpers.
- Routes live under `src/pages/[locale]/...`; `src/pages/[slug].astro` and `src/pages/[locale]/[slug].astro` both exist because Astro's SSR router can't otherwise disambiguate a single dynamic path segment from a locale-prefixed one — read the comment at the top of `src/pages/[slug].astro` before changing routing.
- See `docs/MULTI_LANGUAGE_IMPLEMENTATION.md` / `docs/MULTI_LANGUAGE_SUPPORT_PLAN.md` for the fuller design.

## Commands

```bash
npm run dev                 # local dev server (localhost:4321)
npm run dev:preview         # dev server with Contentful Preview API enabled
npm run build               # sync Contentful types -> validate schemas -> generate Square catalog -> astro build
npm run build:static        # same, but forces a fully static build (STATIC_BUILD=true)
npm run preview             # build, then serve via `wrangler pages dev`
npm run sync:contentful     # generate:types + populate:adapter-mapping
npm run validate:schemas    # checks generated types/fragments/schemas are consistent
npm run test                # vitest run (all tests)
npm run test:unit           # vitest, excluding *.integration.test.ts
npm run test:integration    # builds first, then runs Navbar integration test
```

Most `scripts/*.ts` files are one-off/maintenance CLI tools (Contentful migrations, Figma import, Eventbrite import, Square checks) run via `tsx` — check `package.json` scripts for the full list before writing a new script; something similar may already exist.

`npm run github:issues` (wraps `scripts/github-issues.ts`) queries this repo's GitHub issues directly via the REST API (`--json`, `--issue=<number>`, `--label=`, `--state=`). Requires `GITHUB_TOKEN` in `.env` (a fine-grained PAT scoped to just this repo, `Issues: Read-only` + `Metadata: Read-only` — this repo is private, so unauthenticated requests 404). If the user wants to find something to work on from the issue tracker, use the `/pick-issue` skill rather than improvising this flow from scratch — it fetches issues, curates and presents options, and synthesizes an implementation-ready kickoff prompt from the chosen issue's actual content (including comments).

## Environment variables / secrets

Local secrets live in `.dev.vars` (gitignored — **never commit real values or echo its contents into docs/commits**). See `docs/CLOUDFLARE_ENV_VARS.md` for what needs to be configured in Cloudflare for deployed environments, and `docs/CLOUDFLARE_DEPLOYMENT.md` / `docs/CONTENTFUL_PREVIEW_SETUP.md` / `docs/SQUARE_*.md` for the integration-specific setup docs. If you work across multiple `git worktree`s, see `docs/LOCAL_SECRETS_SETUP.md` for the direnv-based setup that avoids copying `.env`/`.dev.vars`/`.keys/` into every worktree by hand.

## Testing conventions

- Vitest config: `vitest.config.ts`. Tests live alongside code in `__tests__/` directories (e.g. `src/lib/adapters/__tests__/`, `src/lib/contentful/__tests__/`, `src/components/__tests__/`).
- Contentful/network calls are mocked with `vi.mock('../../contentful', ...)` — see `src/lib/adapters/__tests__/adapters.test.ts` for the established pattern (mock `getByQuery`/`getByQueryAndVariables`, build minimal valid fixtures via helper `createMock*` functions).
- `*.integration.test.ts` files are excluded from `test:unit` and require a build first (`test:integration`).

## Conventions and gotchas learned from working in this codebase

- **Don't run project-wide formatters/reformat files you weren't asked to touch.** Quote style is inconsistent across files (mix of single/double quotes) because there's no committed Prettier config — match the surrounding file's existing style rather than "fixing" it, and keep diffs scoped to the change you were asked for.
- Favor `lib/contentful/query-builder.ts` + `lib/contentful/fragments.ts` over hand-rolled GraphQL strings; look at an existing `query*` function for the content type you need before adding a new one.
- When adding a new content type end-to-end, follow the checklist in `docs/DEVELOPER_GUIDE.md` ("Adding a New Content Type"): Contentful field -> `generate:types` -> fragment -> Contentful schema -> adapter -> registry entry -> `validate:schemas`.
- Widget rendering is centralized in `src/components/data_specific/Page.astro`; if you add a new `WidgetType`, you need to update: `component-map.ts` (validators), `registry.ts` (adapter metadata), `Page.astro` (render `switch` case), and add the matching `*.astro` component.
- There are three overlapping architecture docs at the repo root (`ARCHITECTURE_ANALYSIS.md`, `ARCHITECTURE_MIGRATION_12_2025.md`, `ARCHITECTURE_MIGRATION_NOTES.md`) — the migration described in them is marked complete; treat them as historical context, not a live task list.

## Where to go deeper

- `docs/DEVELOPER_GUIDE.md` — the canonical guide to the schema/adapter/rendering architecture; read this first for any adapter/schema/component work.
- `docs/CLOUDFLARE_DEPLOYMENT.md`, `docs/CLOUDFLARE_ENV_VARS.md` — deployment and required env vars.
- `docs/CONTENTFUL_PREVIEW_SETUP.md` — Contentful Preview API wiring.
- `docs/MULTI_LANGUAGE_IMPLEMENTATION.md`, `docs/MULTI_LANGUAGE_SUPPORT_PLAN.md` — i18n design/status.
- `docs/SQUARE_*.md` — Square catalog/checkout integration and static-build notes.
- `src/schema/README.md` — schema directory structure and conventions.
- `tools/contentful/README.md`, `tools/contentful/ARCHITECTURE.md` — Figma-to-Contentful content generation tooling.
- `README.md` — original Astro scaffold notes plus PII handling rules for data files under `tools/`/CSV imports.
