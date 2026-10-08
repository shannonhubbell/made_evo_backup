# Contentful Tools

This directory contains tools for mapping UI widgets to Contentful data and converting Figma designs to Contentful entries.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a complete overview of the system.

## Core Components

### Widget Mapping (`widget-mapping.ts`)

Bidirectional mapping between UI widgets and Contentful content types.

**Usage**:
```typescript
import { getContentTypesForWidget, getWidgetsForContentType } from './widget-mapping';

// Find content types for a widget
const contentTypes = getContentTypesForWidget('splash');
// Returns: ['Page', 'Program']

// Find widgets for a content type
const widgets = getWidgetsForContentType('Event');
// Returns: ['blockGrid', 'textGrid', 'calendar']
```

### Figma Parser (`figma-parser.ts`)

Extracts design information from Figma files.

**Status**: 🚧 Planned

### LLM Converter (`llm-converter.ts`)

Converts Figma design data to Contentful entry structures using LLM assistance.

**Status**: 🚧 Planned

### Contentful Generator (`contentful-generator.ts`)

Creates Contentful entries via the Management API.

**Status**: 🚧 Planned

### Visual Validator (`visual-validator.ts`)

Compares rendered Contentful content with Figma designs.

**Status**: 🚧 Planned

## Implementation Status

- [x] Architecture documentation
- [x] Widget mapping system
- [x] Testing strategy and checkpoints
- [ ] Figma parser
- [ ] LLM converter
- [ ] Contentful generator
- [ ] Visual validator

## Testing

**Comprehensive testing checkpoints are integrated into each phase.**

See [TESTING.md](./TESTING.md) for:
- Detailed test cases for each checkpoint
- How to run tests at each phase
- Success criteria
- Debugging guidance

### Quick Test Reference

```bash
# Run tests for Checkpoint 1 (Widget Mapping)
npm test tools/contentful/__tests__/widget-mapping.test.ts

# Run all contentful tests
npm test tools/contentful

# Run with coverage
npm run test:coverage tools/contentful
```

## Future Work

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed implementation plans and future enhancements.

