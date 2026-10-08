# Testing Checkpoint Guide

This guide walks you through each testing checkpoint as you implement the Figma-to-Contentful conversion system.

## Overview

We've integrated **6 testing checkpoints** into the implementation phases. Each checkpoint ensures the system works correctly before moving to the next phase.

## Checkpoint 1: Widget Mapping ✅ Ready Now

**Status**: Tests are written and ready to run  
**Location**: `tools/contentful/__tests__/widget-mapping.test.ts`

### What to Test

The widget mapping system is already implemented, so you can run these tests immediately:

```bash
npm test tools/contentful/__tests__/widget-mapping.test.ts
```

### What the Tests Cover

1. **Bidirectional Lookups**
   - Finding content types for widgets
   - Finding widgets for content types
   - Getting the "best" widget for a content type

2. **Field Mappings**
   - Required fields for each widget
   - Optional fields
   - Field metadata (types, descriptions)

3. **Pattern Matching**
   - Matching Figma patterns to widget types
   - Hero sections → splash
   - Grid layouts → blockGrid/textGrid
   - Calendar components → calendar

4. **Edge Cases**
   - Unknown widget types
   - Empty mappings
   - Invalid lookups

5. **Data Integrity**
   - All widgets have valid mappings
   - All fields have valid metadata
   - Visual properties are complete

### Expected Results

- ✅ All tests should pass
- ✅ 100% code coverage for mapping functions
- ✅ No edge case failures

### If Tests Fail

1. Check that `widget-mapping.ts` exports all functions correctly
2. Verify widget type names match exactly (case-sensitive)
3. Ensure all widget mappings are defined in `widgetMappings` array

---

## Checkpoint 2: Figma Parser

**Status**: Tests need to be written after implementation  
**Location**: `tools/contentful/__tests__/figma-parser.test.ts`

### When to Test

After implementing:
- Figma API client
- Design data extraction
- Widget type detection

### What to Test

1. **Figma API Connection**
   - Successful API calls
   - Authentication handling
   - Error handling (rate limits, invalid files)

2. **Data Extraction**
   - Text content extraction
   - Image extraction with metadata
   - Layout information
   - Hierarchy preservation

3. **Widget Detection**
   - Pattern-based detection
   - Confidence scoring
   - Ambiguous design handling

### How to Test

```bash
# After implementing figma-parser.ts
npm test tools/contentful/__tests__/figma-parser.test.ts
```

### Mock Data Needed

Create mock Figma API responses in `__tests__/fixtures/figma-responses/`:
- Sample file structure
- Node data
- Image URLs

---

## Checkpoint 3: LLM Converter

**Status**: Tests need to be written after implementation  
**Location**: `tools/contentful/__tests__/llm-converter.test.ts`

### When to Test

After implementing:
- LLM client integration
- Prompt templates
- Content extraction
- Field mapping

### What to Test

1. **Widget Identification**
   - Accuracy of widget type detection
   - Confidence scores
   - Handling ambiguous designs

2. **Content Extraction**
   - All required fields extracted
   - Field type correctness
   - Optional field handling

3. **Validation**
   - Missing required fields caught
   - Low confidence warnings
   - Schema validation

### How to Test

```bash
# After implementing llm-converter.ts
npm test tools/contentful/__tests__/llm-converter.test.ts
```

### Mock Data Needed

Create mock LLM responses in `__tests__/fixtures/llm-responses/`:
- Widget identification responses
- Content extraction responses
- Error responses

---

## Checkpoint 4: Content Analyzer

**Status**: Tests are written and ready to run after implementation  
**Location**: `tools/contentful/__tests__/content-analyzer.test.ts`

### When to Test

After implementing:
- Contentful page querying
- Content view analysis
- Widget type detection from adapters
- Usage statistics tracking

### What to Test

1. **Site Content Analysis**
   - Querying all pages from Contentful
   - Analyzing content views on each page
   - Identifying widget types via adapters
   - Building usage statistics

2. **Page Content Queries**
   - Getting content for specific pages
   - Checking widget type usage
   - Getting all widget types on a page

3. **Duplicate Detection**
   - Detecting if widget type already exists on page
   - Checking for similar content

4. **Placement Recommendations**
   - Recommending where to add new content
   - Considering existing usage
   - Providing helpful suggestions

### How to Test

```bash
# After implementing content-analyzer.ts
npm test tools/contentful/__tests__/content-analyzer.test.ts
```

### Mock Data Needed

Mock Contentful API responses with:
- Page collections
- Content view collections
- Adapter references

---

## Checkpoint 5: Contentful Generator

**Status**: Tests need to be written after implementation  
**Location**: `tools/contentful/__tests__/contentful-generator.test.ts`

### When to Test

After implementing:
- Management API client
- Entry creation
- Asset upload
- Publishing workflow

### What to Test

1. **Entry Creation**
   - All content types supported
   - Field format mapping
   - Draft vs published entries

2. **Asset Upload**
   - Image uploads
   - Video uploads
   - Asset linking

3. **Validation**
   - Schema validation before creation
   - Required field checking
   - Error messages

### How to Test

```bash
# After implementing contentful-generator.ts
npm test tools/contentful/__tests__/contentful-generator.test.ts
```

### Mock Data Needed

Create mock Contentful API responses in `__tests__/fixtures/contentful-responses/`:
- Entry creation responses
- Asset upload responses
- Error responses

---

## Checkpoint 6: Visual Validator

**Status**: Tests need to be written after implementation  
**Location**: `tools/contentful/__tests__/visual-validator.test.ts`

### When to Test

After implementing:
- Rendering pipeline
- Screenshot capture
- Image comparison
- Difference detection

### What to Test

1. **Rendering**
   - Contentful content renders correctly
   - Screenshots captured at correct dimensions
   - Error handling

2. **Comparison**
   - Match score accuracy
   - Difference detection (layout, color, text)
   - Location accuracy

3. **Suggestions**
   - Actionable feedback
   - Widget-specific suggestions

### How to Test

```bash
# After implementing visual-validator.ts
npm test tools/contentful/__tests__/visual-validator.test.ts
```

### Test Images Needed

Create sample screenshots in `__tests__/fixtures/screenshots/`:
- Figma design screenshots
- Rendered content screenshots
- Expected diff results

---

## Checkpoint 7: End-to-End Integration

**Status**: Tests need to be written after all phases complete  
**Location**: `tools/contentful/__tests__/e2e.test.ts`

### When to Test

After all phases are complete and working individually.

### What to Test

1. **Complete Flows**
   - Splash widget: Figma → Contentful → Validation
   - Grid widget: Figma → Contentful → Validation
   - All widget types

2. **Error Recovery**
   - Figma API failures
   - LLM failures
   - Contentful failures
   - Graceful degradation

3. **Performance**
   - Complete flow <30s
   - Asset uploads don't timeout
   - Visual validation <10s

### How to Test

```bash
# After all phases complete
npm test tools/contentful/__tests__/e2e.test.ts
```

---

## Running All Tests

```bash
# Run all contentful tests
npm test tools/contentful

# Run with coverage
npm run test:coverage tools/contentful

# Run in watch mode (during development)
npm run test:watch tools/contentful
```

## Test Organization

```
tools/contentful/
├── __tests__/
│   ├── widget-mapping.test.ts          ✅ Ready
│   ├── figma-parser.test.ts           ⏳ After Phase 2
│   ├── llm-converter.test.ts          ⏳ After Phase 3
│   ├── content-analyzer.test.ts       ⏳ After Phase 4
│   ├── contentful-generator.test.ts   ⏳ After Phase 5
│   ├── visual-validator.test.ts      ⏳ After Phase 6
│   ├── e2e.test.ts                    ⏳ After all phases
│   └── fixtures/                      📁 Test data
│       ├── figma-responses/
│       ├── llm-responses/
│       ├── contentful-responses/
│       └── screenshots/
```

## Next Steps

1. **Run Checkpoint 1 tests now** to verify the mapping system works
2. **As you implement each phase**, write and run the corresponding tests
3. **Fix any failures** before moving to the next phase
4. **Document issues** you encounter for future reference

## Getting Help

- See [TESTING.md](./TESTING.md) for detailed test cases
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for implementation details
- Check test output for specific error messages
- Review mock data if tests fail unexpectedly

