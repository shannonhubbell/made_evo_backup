# Schema Directory Structure

This directory contains Zod schemas organized by their purpose and source.

## Directory Structure

```
src/schema/
├── contentful/          # Contentful API response schemas
│   └── index.ts        # Zod schemas matching Contentful GraphQL API
├── ui/                  # UI component schemas
│   ├── index.ts        # UI component props and data schemas
│   ├── report.ts       # Report widget schemas
│   └── widget-data.ts # WidgetData union types
├── DataSchema.ts       # Legacy schemas (to be audited/removed)
└── README.md           # This file
```

## Schema Types

### Contentful Schemas (`contentful/`)

Schemas that validate data directly from Contentful's GraphQL API. These match the structure returned by Contentful and are used to validate API responses before transformation.

**Usage:**
```typescript
import { ProgramSchema, EventSchema } from '@/schema/contentful';

// Validate Contentful API response
const program = ProgramSchema.parse(contentfulData);
```

**Key Features:**
- Match Contentful GraphQL API structure exactly
- Include `sys` fields (id, publishedAt, etc.)
- Use Contentful naming conventions (e.g., `imageCollection`)
- Generated/maintained to match `src/generated/contentful-types.ts`

### UI Schemas (`ui/`)

Schemas for UI component props and transformed data structures. These represent the data after it's been transformed by adapters for presentation.

**Usage:**
```typescript
import { GridItemSchema, SplashPropsSchema } from '@/schema/ui';

// Validate UI component props
const gridItem = GridItemSchema.parse(transformedData);
```

**Key Features:**
- Optimized for UI presentation
- Use UI-friendly naming (e.g., `image` instead of `imageCollection`)
- Include validation for component props
- Separate from Contentful structure

### WidgetData (`ui/widget-data.ts`)

Union types for standardized adapter return values. All adapters return one of these types.

**Usage:**
```typescript
import type { WidgetData, GridWidgetData } from '@/schema/ui/widget-data';

function handleWidgetData(data: WidgetData) {
  if ('items' in data) {
    // Collection widget
  } else if ('report' in data) {
    // Report widget
  }
}
```

## Migration Notes

### From Old Structure

**Before:**
```typescript
import { GridItemSchema } from '@/schema/ui';
import { ReportSchema } from '@/schema/ui/report';
```

**After:**
```typescript
import { GridItemSchema } from '@/schema/ui';
import { ReportSchema } from '@/schema/ui/report';
```

### DataSchema.ts

`DataSchema.ts` contains legacy schemas that don't match actual Contentful structure. These are being audited and will either be:
- Updated to match Contentful structure (moved to `contentful/`)
- Removed if unused
- Kept if they serve a different purpose

## Best Practices

1. **Use Contentful schemas** for validating raw API responses
2. **Use UI schemas** for validating transformed data and component props
3. **Import from specific files** when you need a specific schema
4. **Import from index** when you need multiple schemas from the same category

## Future Improvements

- [ ] Generate Contentful schemas automatically from type generation
- [ ] Add validation chain in adapters (validate Contentful → transform → validate UI)
- [ ] Remove or update legacy DataSchema.ts
- [ ] Add schema versioning for breaking changes

