# Architecture Migration Notes
## Working Notes & Scratch File

**Purpose:** This file contains working notes, decisions, discoveries, and temporary information during the migration process. This is a living document that should be updated as we work through each phase.

**Last Updated:** December 2025

---

## Quick Reference

- **Migration Tracking:** See `ARCHITECTURE_MIGRATION_12_2025.md` for task status
- **Architecture Analysis:** See `ARCHITECTURE_ANALYSIS.md` for recommendations

---

## Phase 1: Foundation Notes

### Tool Research (Task 1.1) ✅

**Evaluation Date:** December 2025  
**Status:** ✅ Complete

**Options Evaluated:**

1. **contentful-typescript-codegen** ⭐ INITIALLY RECOMMENDED
   - **Approach:** Dedicated CLI tool for Contentful
   - **Pros:** 
     - Purpose-built for Contentful
     - Simple CLI interface
     - Handles locales, assets, rich text automatically
     - Active community (high npm downloads)
     - Good documentation
     - Generates clean TypeScript interfaces
   - **Cons:**
     - Community-maintained (not official)
     - Less flexible than graphql-codegen
     - May have limitations for complex schemas
     - Requires Management API access
   - **NPM Package:** `contentful-typescript-codegen`
   - **Setup Complexity:** Low
   - **Maintenance:** Low
   - **Flexibility:** Medium
   - **Community Support:** High
   - **Status:** ✅ Evaluated - Initially recommended

2. **graphql-codegen**
   - **Approach:** Universal GraphQL code generator with Contentful plugin
   - **Pros:**
     - Very flexible and configurable
     - Widely used and well-maintained
     - Supports many plugins and customizations
     - Can generate queries, types, and more
     - Strong TypeScript support
     - Can be extended for custom needs
   - **Cons:**
     - More complex setup
     - Requires GraphQL schema introspection
     - Steeper learning curve
     - More configuration needed
     - May be overkill for simple use cases
   - **NPM Package:** `@graphql-codegen/cli @graphql-codegen/typescript`
   - **Setup Complexity:** High
   - **Maintenance:** Low
   - **Flexibility:** High
   - **Community Support:** High
   - **Status:** ✅ Evaluated - Consider for Phase 2 if query generation needed

3. **Custom Script (Contentful Management API)** ⭐ FINAL DECISION
   - **Approach:** Build custom script using Contentful Management API
   - **Pros:**
     - Full control over output
     - Can customize exactly to our needs
     - No external dependencies (we have `contentful` package)
     - Can integrate with our build process
     - Can add custom logic
   - **Cons:**
     - More development time
     - We maintain it ourselves
     - Need to handle edge cases
     - More code to maintain
     - Need to keep up with Contentful API changes
   - **NPM Package:** `contentful-management` (needs to be installed)
   - **Setup Complexity:** Medium
   - **Maintenance:** High
   - **Flexibility:** High
   - **Community Support:** Low
   - **Status:** ✅ Chosen - Custom script created

**Decision:** 🎯 **Build custom script using Contentful Management API**

**Rationale:**
- After evaluation, decided custom script gives us full control
- We can customize output exactly to our needs
- Already have contentful package, just need contentful-management
- Can integrate perfectly with our workflow
- Can add custom logic for edge cases

**Implementation:**
- Script created: `scripts/generate-contentful-types.ts`
- Uses Contentful Management API to fetch content types
- Generates TypeScript interfaces automatically
- Maps Contentful field types to TypeScript types
- Handles sys fields, links, arrays, rich text, etc.

**Environment Check:**
- ✅ CONTENTFUL_SPACE_ID available
- ✅ CONTENTFUL_DELIVERY_TOKEN available  
- ✅ CONTENTFUL_MANAGEMENT_TOKEN available
- ✅ CONTENTFUL_ENVIRONMENT_ID available (defaults to 'master')

**Notes:**
- We already have `contentful` package installed (v11.9.0)
- Need to install `contentful-management` package
- Management API token is available in env.d.ts
- Evaluation script created at `scripts/evaluate-type-generation-tools.ts`

---

### Type Generation Script Setup (Task 1.2) ✅

**Status:** ✅ Complete - Validated

**Implementation Details:**

1. **Script Created:** `scripts/generate-contentful-types.ts`
   - Uses Contentful Management API
   - Fetches all content types from specified environment
   - Generates TypeScript interfaces
   - Maps Contentful field types to TypeScript

2. **Type Mapping:**
   - Symbol/Text → `string`
   - Integer/Number → `number`
   - Boolean → `boolean`
   - Date → `string` (ISO date)
   - Location → `{ lat: number; lon: number }`
   - Object → `Record<string, any>`
   - Array → `Array<T>` (with proper item types)
   - Link (Entry) → `{ sys: { id: string } }`
   - Link (Asset) → `{ sys: { id: string }; url?: string }`
   - RichText → `{ json: any }`

3. **Output:**
   - File: `src/generated/contentful-types.ts`
   - Includes header comment with generation info
   - Auto-generated, should not be edited manually

4. **NPM Script Added:**
   - `npm run generate:types` - Runs the generation script
   - Integrated into build process: `npm run build` now runs type generation first

5. **Dependencies:**
   - Requires `contentful-management` package (installed)
   - Uses `tsx` (already installed) to run TypeScript script
   - Includes simple .env file parser (no dotenv package needed)

**Next Steps:**
1. ✅ Fixed dotenv dependency issue - script now parses .env file directly
2. ✅ Installed `contentful-management` package
3. ✅ Tested script with actual Contentful space
4. ✅ Generated 15 interfaces successfully
5. ✅ Validated output quality

**Known Issues:**
- ✅ Fixed: Removed dotenv dependency - script now includes simple .env parser
- ✅ Fixed: Removed duplicate variable declarations

**Notes:**
- Script handles error cases
- Provides helpful output and progress messages
- Shows summary of generated interfaces
- Output directory created automatically

---

## Phase 2: Query Standardization Notes

### Query Build Process Architecture

**Question:** How would queries be created as part of the build setup?

**Current Implementation (Runtime Query Building):**
- Query builder functions are called at runtime
- Functions return GraphQL query strings when invoked
- Queries are built dynamically based on parameters
- Works for both static (SSG) and server-rendered (SSR) pages

**How It Works:**
1. **Build Time (Static Pages):**
   - Astro generates static pages during `npm run build`
   - For each page, `getStaticPaths()` is called
   - Pages call query builder functions
   - Queries are executed against Contentful API
   - Results are baked into static HTML

2. **Runtime (Server-Rendered Pages):**
   - When page is requested, query builder functions are called
   - Queries are built and executed
   - Results are used to render the page

**Example Flow:**
```typescript
// In [slug].astro (static page)
export async function getStaticPaths() {
  // Query builder called at BUILD TIME
  const query = queryPages();
  const data = await getByQuery(query);
  // Pages generated with data baked in
}

// In adapters.ts (called during page generation)
export async function gridFromPrograms(...) {
  // Query builder called at BUILD TIME (for static) or RUNTIME (for SSR)
  const query = queryPrograms({ where: 'url_exists: true' });
  const data = await getByQuery(query);
}
```

**Alternative: Pre-Generated Queries (Not Recommended):**
- Could generate static query strings during build
- Would require knowing all query variations upfront
- Less flexible, more complex
- Current runtime approach is better for this use case

**Decision:** ✅ **Keep Runtime Query Building**
- More flexible
- Works with dynamic parameters
- Simpler to maintain
- Type-safe through TypeScript

---

### Query Fragment Structure

**Proposed Structure:**
```typescript
// src/lib/contentful/fragments.ts
export const ProgramFields = `
  sys { id publishedAt }
  name
  title
  description
  url
  imageCollection {
    items { url }
  }
`;
```

**Considerations:**
- Should fragments be composable?
- How to handle nested references?
- Version control for fragments?

**Notes:**
- ✅ Created fragments for all content types
- Fragments use template literals (runtime string building)
- Can be composed and reused
- Aligned with generated TypeScript types

---

### Query Builder Implementation

**Status:** ✅ Complete

**Features:**
- Type-safe query functions
- QueryOptions interface for flexible building
- Helper functions for where clauses
- Type-safe response types
- Functions for common patterns (by slug, paginated, counts)

**Usage:**
```typescript
// Simple query
const query = queryPrograms();

// With options
const query = queryPrograms({ 
  where: 'url_exists: true',
  limit: 10 
});

// Type-safe response
const data = await getByQuery<ProgramCollectionResponse>(query);
```

**Notes:**
- Query builder functions return strings (GraphQL queries)
- Queries are built at runtime when functions are called
- Type safety comes from TypeScript types, not build-time validation
- Works seamlessly with Astro's build process

---

## Phase 3: Adapter Improvements Notes

### Adapter ID Strategy

**Options:**
1. Use Contentful entry IDs (stable, but requires querying)
2. Use slug/name-based IDs (human-readable, but can change)
3. Use custom ID field in Contentful (requires schema change)

**Decision:** _Pending_

**Notes:**
- Need to check if Contentful supports custom ID fields
- Consider migration path for existing content

---

## Phase 4: Schema Alignment Notes

### Schema Audit Results

**DataSchema.ts Current State:**
- EventSchema: ❌ Doesn't match actual queries
- ExhibitSchema: ❌ Doesn't match actual queries
- ProgramSchema: ❌ Doesn't match actual queries
- MemberSchema: ⚠️ Partially matches

**Action Items:**
- [ ] Compare each schema with actual GraphQL queries
- [ ] Document mismatches
- [ ] Decide: fix schemas or remove them

**Notes:**
- _To be filled during audit_

---

## Phase 5: UI Type System Notes

### WidgetData Union Type

**Proposed Structure:**
```typescript
export type WidgetData = 
  | { type: 'grid'; items: GridItem[] }
  | { type: 'calendar'; items: CalendarEvent[] }
  | { type: 'timeline'; items: TimelineItem[] }
  | { type: 'splash'; props: SplashProps }
  | { type: 'report'; report: Report }
  | { type: 'doubleColumn'; items: DoubleColumnItem[] }
  | { type: 'singleColumn'; items: DoubleColumnItem[] };
```

**Considerations:**
- Should we include metadata (title, visibility)?
- How to handle widget-specific options?
- Type narrowing for component rendering

**Notes:**
- _To be refined during implementation_

---

## Phase 6: Validation & Tooling Notes

### Validation Script Requirements

**Must Check:**
1. Generated types match Contentful schema
2. All queries use valid fields
3. Adapters handle all required fields
4. No orphaned types or schemas

**Nice to Have:**
- Diff report showing schema changes
- Suggestions for fixing mismatches
- Performance metrics

**Notes:**
- _To be filled during implementation_

---

## General Notes & Discoveries

### Contentful API Access

**Status:** ✅ Verified
- Management API token configured
- GraphQL API token configured
- Permissions confirmed

**Notes:**
- All required environment variables are available

---

### Build Process Integration

**Current Build:**
- `npm run build` → Generate types + Astro build
- `npm run generate:types` → Generate types only

**Implementation:**
- Type generation runs before build
- Can be run independently
- Uses tsx to run TypeScript directly

**Query Building:**
- Queries are built at runtime (when functions are called)
- Works for both static (SSG) and server-rendered (SSR) pages
- Type-safe through TypeScript types
- No pre-generation needed

**Notes:**
- Build process updated in package.json
- Pre-build hook integrated
- Query builder works seamlessly with Astro's build process

---

### Type Generation Output Location

**Decision:** Use `src/generated/` directory
- Pros: Clear separation, easy to identify as generated
- Cons: Need to ensure it's not ignored

**Implementation:**
- Directory created automatically
- File: `src/generated/contentful-types.ts`
- Added note to .gitignore that generated types are committed

**Notes:**
- Generated files will be committed to git (common practice)
- Header comment marks file as auto-generated

---

## Decisions Log

### Decision: December 2025 - Custom Type Generation Script
**Context:** Evaluating tools for generating TypeScript types from Contentful  
**Options Considered:**
1. contentful-typescript-codegen (community tool)
2. graphql-codegen (flexible but complex)
3. Custom script (full control)
**Decision:** Build custom script using Contentful Management API  
**Rationale:** Full control, can customize exactly to our needs, already have contentful package  
**Impact:** Need to install contentful-management, maintain our own script

### Decision: December 2025 - Runtime Query Building
**Context:** How should queries be created in the build process?  
**Options Considered:**
1. Runtime query building (current approach)
2. Pre-generated static queries
**Decision:** Keep runtime query building  
**Rationale:** More flexible, works with dynamic parameters, simpler to maintain, type-safe through TypeScript  
**Impact:** Queries built when functions are called, works seamlessly with Astro's SSG and SSR

---

## Issues & Blockers

### Issue: contentful-management Package Not Installed
**Date:** December 2025  
**Phase:** Phase 1.2  
**Description:** Script requires contentful-management package but it's not yet installed  
**Impact:** Script won't run until package is installed  
**Resolution:** ✅ Installed `npm install --save-dev contentful-management`  
**Status:** ✅ Resolved

---

## Questions for Team Discussion

1. **Type Generation Frequency**
   - Generate on every build? (always fresh, slower) ✅ CURRENT
   - Generate on demand? (faster, might be stale)
   - Cache with invalidation? (balance)

2. **Generated Files in Git**
   - Commit generated types? (common practice) ✅ DECIDED: Yes
   - Ignore and generate in CI? (cleaner repo)
   - Hybrid: commit but mark as generated? ✅ IMPLEMENTED

3. **Backward Compatibility**
   - How long support old adapter patterns?
   - Migration timeline?
   - Rollback strategy?

4. **Query Building Approach**
   - Runtime query building? ✅ DECIDED: Yes
   - Pre-generated queries? (less flexible)
   - Hybrid approach?

---

## Testing Notes

### Test Cases to Verify

**Phase 1:**
- [x] Types generate correctly
- [x] Types match Contentful schema
- [x] Build process includes generation
- [x] Generated types compile

**Phase 2:**
- [ ] Query builder works
- [ ] Fragments are reusable
- [ ] Type safety is maintained
- [ ] All queries migrated

**Phase 3:**
- [ ] Adapter registry works
- [ ] All adapters registered
- [ ] Lookup is type-safe
- [ ] Error handling works

**Phase 4:**
- [ ] Schemas match reality
- [ ] Validation chain works
- [ ] No unused schemas
- [ ] Clear separation maintained

**Phase 5:**
- [ ] WidgetData type works
- [ ] All adapters return standardized types
- [ ] Component mapping is type-safe
- [ ] Rendering works correctly

**Phase 6:**
- [ ] Validation script works
- [ ] CI integration works
- [ ] Developer tooling helpful
- [ ] Documentation complete

---

## Code Snippets & Examples

### Example: Generated Type Structure
```typescript
// src/generated/contentful-types.ts
export interface Program {
  sys: {
    id: string;
    publishedAt?: string;
    updatedAt?: string;
    revision?: number;
  };
  name: string;
  title: string;
  description: string;
  url?: string;
  content?: { json: any };
  image?: Array<{ sys: { id: string }; url?: string }>;
}
```

### Example: Query Builder Usage
```typescript
// Runtime query building
import { queryPrograms } from './query-builder';
import type { ProgramCollectionResponse } from './query-builder';

// Build query at runtime
const query = queryPrograms({ where: 'url_exists: true' });

// Execute with type safety
const data = await getByQuery<ProgramCollectionResponse>(query);
// data.programCollection.items is typed as Program[]
```

### Example: Adapter Registry
```typescript
// To be filled with actual implementation
```

---

## Resources & References

### Documentation
- [Contentful GraphQL API](https://www.contentful.com/developers/docs/references/graphql-api/)
- [Contentful Management API](https://www.contentful.com/developers/docs/references/content-management-api/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)
- [Zod Documentation](https://zod.dev/)
- [Astro Build Process](https://docs.astro.build/en/guides/build/)

### Tools
- `contentful-typescript-codegen`: [GitHub](https://github.com/intercom/contentful-typescript-codegen)
- `graphql-codegen`: [Documentation](https://the-guild.dev/graphql/codegen)
- `contentful-management`: [NPM](https://www.npmjs.com/package/contentful-management)

---

## Future Considerations

### Potential Enhancements
- Real-time schema sync
- Schema change notifications
- Automated migration scripts
- Visual schema diff tool
- Query optimization/validation at build time

### Technical Debt
- _To be tracked as discovered_

---

**Note:** This file should be updated frequently during active development. Keep it current with discoveries, decisions, and working notes.
