# DataSchema.ts Audit Report

**Date:** December 29, 2025  
**Purpose:** Audit DataSchema.ts against actual Contentful structure and usage

## Current Schemas in DataSchema.ts

### 1. OrganizationSchema
- **Status:** ❌ Unused
- **Contentful Match:** ✅ Exists in Contentful (Organization type)
- **Action:** Remove (not used anywhere)

### 2. MemberSchema
- **Status:** ⚠️ Partially used (validation functions exported)
- **Contentful Match:** ❌ Doesn't match
  - DataSchema: `{ firstName, lastName, email, organization }`
  - Contentful: `{ sys, firstName, lastName, email?, organization?, displayName, role, description? }`
- **Usage:** Validation functions exported but not used
- **Action:** Remove (Contentful schema exists in `src/schema/contentful/index.ts`)

### 3. EventSchema
- **Status:** ❌ Unused (validation functions exported but not used)
- **Contentful Match:** ❌ Completely different
  - DataSchema: `{ name, description, startDate, endDate, location, url, images, tags, organizers, presenters }`
  - Contentful: `{ sys, name, title, startDate, endDate?, slug, description?, content?, imageCollection?, presenterCollection?, program? }`
- **Action:** Remove (Contentful schema exists in `src/schema/contentful/index.ts`)

### 4. ExhibitSchema
- **Status:** ❌ Unused (validation functions exported but not used)
- **Contentful Match:** ❌ Completely different
  - DataSchema: `{ name?, status, audio, images, interpretation }`
  - Contentful: `{ sys, name, title?, description? }`
- **Action:** Remove (Contentful schema exists in `src/schema/contentful/index.ts`)

### 5. ProductSchema
- **Status:** ❌ Unused
- **Contentful Match:** ❓ Not found in Contentful
- **Action:** Remove (not used anywhere)

### 6. ItemSchema
- **Status:** ❌ Unused
- **Contentful Match:** ❓ Not found in Contentful
- **Action:** Remove (not used anywhere)

### 7. MetricSchema
- **Status:** ✅ Used (imported in `src/schema/ui/index.ts` for GraphDataSchema)
- **Contentful Match:** ❌ Doesn't match
  - DataSchema: `{ name, description, value, unit }`
  - Contentful: `{ sys, name, title, content?, description?, program }`
- **Action:** Keep but move to appropriate location (used for UI GraphDataSchema, not Contentful validation)

### 8. ProgramSchema
- **Status:** ❌ Unused (validation functions exported but not used)
- **Contentful Match:** ❌ Completely different
  - DataSchema: `{ name, description, url, exhibits, items, products, metrics }`
  - Contentful: `{ sys, name, title, description, url?, content?, imageCollection? }`
- **Action:** Remove (Contentful schema exists in `src/schema/contentful/index.ts`)

## Validation Functions

All validation functions (`validateEvent`, `validateExhibit`, `validateProgram`, `validateMember`, etc.) are **not used anywhere** in the codebase.

## Recommendations

1. **Remove unused schemas:** OrganizationSchema, EventSchema, ExhibitSchema, ProgramSchema, ProductSchema, ItemSchema, MemberSchema
2. **Move MetricSchema:** Move to `src/schema/ui/` since it's used for GraphDataSchema (UI-related)
3. **Remove validation functions:** All validation functions are unused
4. **Update schema.json.ts:** Remove DataSchema import if all schemas are removed

## Migration Plan

1. Move `MetricSchema` to `src/schema/ui/index.ts` (where GraphDataSchema is)
2. Update import in `src/schema/ui/index.ts`
3. Remove all unused schemas and validation functions from DataSchema.ts
4. Either delete DataSchema.ts or keep it as a deprecated file with a note
5. Update `src/pages/api/schema.json.ts` to remove DataSchema import if file is deleted

