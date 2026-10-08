# Developer Guide
## Contentful Schema Standardization & Type Safety

This guide explains the architecture, patterns, and tools for working with Contentful data in this project.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Type Generation](#type-generation)
3. [Query Building](#query-building)
4. [Data Adapters](#data-adapters)
5. [Schema Validation](#schema-validation)
6. [Component Rendering](#component-rendering)
7. [Development Workflow](#development-workflow)

## Architecture Overview

This project uses a **two-tier schema system**:

1. **Contentful Schemas** (`src/schema/contentful/`) - Validate raw API responses
2. **UI Schemas** (`src/schema/ui/`) - Validate transformed data for components

### Data Flow

```
Contentful API → Contentful Schema Validation → Adapter Transformation → UI Schema Validation → Component
```

## Type Generation

### Generating Types from Contentful

Types are automatically generated from your Contentful schema:

```bash
npm run generate:types
```

This script:
- Fetches content types from Contentful Management API
- Generates TypeScript interfaces in `src/generated/contentful-types.ts`
- Matches Contentful GraphQL API structure

**Note:** Types are regenerated automatically during `npm run build`.

### Manual Type Updates

⚠️ **Do not edit** `src/generated/contentful-types.ts` manually - it will be overwritten.

If you need to add custom types, add them to a separate file and import alongside generated types.

## Query Building

### Using Fragments

GraphQL queries use reusable fragments defined in `src/lib/contentful/fragments.ts`:

```typescript
import { ProgramFields, EventFields } from './fragments';

const query = `
  {
    programCollection {
      items {
        ${ProgramFields}
      }
    }
  }
`;
```

### Type-Safe Query Builder

Use the query builder for type-safe queries:

```typescript
import { queryPrograms, queryEvents } from './query-builder';

// Simple query
const programs = await queryPrograms();

// With options
const events = await queryEvents({
  where: 'startDate_gte: "2024-01-01"',
  limit: 10,
  order: 'startDate_DESC'
});
```

## Data Adapters

### Adapter Pattern

Adapters transform Contentful data into UI-specific formats:

```typescript
import { queryPrograms } from './contentful/query-builder';
import { getByQuery } from './contentful';

export async function gridFromPrograms(
  keys: string[],
  values: string[],
  targetIDs: string[],
  isAtomic: boolean
): Promise<GridWidgetData> {
  // 1. Build query using query builder (not raw GraphQL)
  const query = queryPrograms({
    where: 'url_exists: true', // Optional where clause
  });
  
  // 2. Fetch data from Contentful
  const data = await getByQuery(query);
  
  // 3. Validate Contentful response
  const collection = validateContentfulData(
    data.programCollection,
    ProgramCollectionSchema,
    'gridFromPrograms: programCollection'
  );
  
  // 4. Transform to UI format
  const output = collection.items.map((program) => {
    // Transform logic...
    return GridItemSchema.parse(gridItem);
  });
  
  // 5. Return standardized WidgetData
  return { items: output };
}
```

### Validation Chain

All adapters use a **two-stage validation**:

1. **Contentful Schema Validation** - Validates raw API response
2. **UI Schema Validation** - Validates transformed data

This ensures data integrity throughout the transformation process.

### Adapter Registry

Adapters are registered in `src/lib/adapters/registry.ts`:

```typescript
registerAdapter({
  id: 'grid-from-programs',
  name: 'Grid Items from Programs',
  contentfulName: 'Data Adapter: Grid Items from Programs',
  handler: gridFromPrograms,
  inputTypes: ['Program'],
  outputType: 'grid',
  isAtomic: false,
  description: 'Creates grid items from Program content types',
});
```

## Schema Validation

### Running Validation

Validate that schemas match Contentful:

```bash
npm run validate:schemas
```

This checks:
- Generated types match Contentful schema
- GraphQL fragments query valid fields
- Required fields are present

### Build Integration

Validation runs automatically during `npm run build`:

```bash
npm run build
# Runs: sync:contentful → validate:schemas → astro build
```

Build fails if validation finds errors.

## Component Rendering

### Type-Safe Component Map

Components are rendered using a type-safe component map:

```typescript
import { validateWidgetDataForRendering } from '../lib/components/renderer';

// Validate before rendering
validateWidgetDataForRendering(widgetType, widgetData);

// Render component
switch (widgetType) {
  case 'splash':
    return <Splash {...widgetData} />
  case 'grid':
    return <ResponsiveGrid items={widgetData.items} />
  // ...
}
```

### Error Handling

Invalid widget data shows user-friendly error messages instead of crashing:

```typescript
try {
  validateWidgetDataForRendering(widgetType, data);
  // Render component...
} catch (error) {
  return <ErrorComponent error={error} />
}
```

## Development Workflow

### Adding a New Content Type

1. **Create Content Type in Contentful**
   - Define fields in Contentful UI

2. **Generate Types**
   ```bash
   npm run generate:types
   ```

3. **Create GraphQL Fragment**
   ```typescript
   // src/lib/contentful/fragments.ts
   export const NewTypeFields = `
     ${SysFields}
     field1
     field2
   `;
   ```

4. **Create Contentful Schema**
   ```typescript
   // src/schema/contentful/index.ts
   export const NewTypeSchema = z.object({
     sys: SysFieldsSchema,
     field1: z.string(),
     field2: z.string(),
   });
   ```

5. **Create Adapter (if needed)**
   ```typescript
   // src/lib/adapters.ts
   export async function widgetFromNewType(...): Promise<WidgetData> {
     // Implementation
   }
   ```

6. **Validate**
   ```bash
   npm run validate:schemas
   ```

### Syncing with Contentful

Before building, sync with Contentful:

```bash
npm run sync:contentful
```

This:
- Generates types from Contentful schema
- Updates adapter ID mappings

### Testing

Run tests:

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration
```

## Common Patterns

### Handling Optional Fields

```typescript
// Contentful schema allows optional fields
const description = validatedData.description || 'Default value';

// UI schema validation ensures required fields
const uiData = UISchema.parse({
  title: validatedData.title,
  description: description, // Always a string
});
```

### Handling Rich Text

```typescript
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

const html = documentToHtmlString(contentfulData.content.json);
```

### Handling Images

```typescript
// Contentful returns imageCollection
const imageUrl = program.imageCollection?.items?.[0]?.url;

// Transform to UI format
const gridItem = {
  image: imageUrl || undefined,
  // ...
};
```

## Troubleshooting

### Schema Mismatch Errors

If validation fails:

1. Check Contentful schema matches generated types
2. Verify GraphQL fragments query valid fields
3. Run `npm run generate:types` to regenerate

### Type Errors

If TypeScript complains about types:

1. Ensure types are generated: `npm run generate:types`
2. Check imports use generated types
3. Verify Contentful schema hasn't changed

### Build Failures

If build fails:

1. Check validation output: `npm run validate:schemas`
2. Verify all required fields are queried
3. Check adapter validation errors

### Google Form renders as a plain iframe instead of the styled form

The `GoogleForm` widget (`src/components/hydrated/forms/GoogleForm.vue`) renders a fully site-styled form when it can fetch the form's question structure from the Google Forms API (`fetchFormStructure` in `src/lib/google-forms.ts`). If that fetch fails, it silently falls back to an unstyled `<iframe>` embed of Google's own themed form — the page still "works," it just won't match the site's visual identity.

Two things must both be true for the styled version to render:

1. The `GoogleForm` entry's `formId` field in Contentful must be the **edit-URL ID** (`https://docs.google.com/forms/d/<THIS_ID>/edit`), not the public share/embed link ID (`https://docs.google.com/forms/d/e/<THIS_ID>/viewform`, which always starts with `1FAIpQLS...`). The share-link ID still works for the iframe fallback, which is why this mistake is easy to miss.
2. The form must be shared with the service account `made-website@the-made-1550370909551.iam.gserviceaccount.com` (Google Forms sharing only offers Editor access — there's no view-only role — so grant it as an **Editor**).

If either is wrong, `fetchFormStructure` returns no fields and the component quietly degrades to the iframe. Check the server console for `[google-forms] forms.get failed: <status>` to confirm.

## Best Practices

1. **Always validate** - Use validation chain in adapters
2. **Use fragments** - Don't write raw GraphQL queries
3. **Type safety** - Use generated types, not `any`
4. **Error handling** - Show user-friendly errors
5. **Sync regularly** - Run `sync:contentful` before major changes

## Additional Resources

- [Architecture Analysis](./ARCHITECTURE_ANALYSIS.md) - Full architecture documentation
- [Migration Tracking](./ARCHITECTURE_MIGRATION_12_2025.md) - Implementation progress
- [Schema README](../src/schema/README.md) - Schema organization

