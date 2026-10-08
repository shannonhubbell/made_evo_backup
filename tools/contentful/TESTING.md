# Testing Strategy for Figma-to-Contentful Conversion System

## Overview

This document outlines the comprehensive testing strategy for the Figma-to-Contentful conversion system. Testing checkpoints are integrated into each implementation phase to catch issues early and ensure system reliability.

## Testing Framework

- **Framework**: Vitest (matches project standard)
- **Test Types**: Unit tests, integration tests, E2E tests
- **Coverage Goal**: 80%+ for all modules

## Testing Checkpoints

### Checkpoint 1: Core Mapping System ✅ Ready to Test

**Location**: After Phase 1 implementation  
**Test File**: `__tests__/widget-mapping.test.ts`

#### Test Cases

1. **Bidirectional Lookups**
   ```typescript
   - getContentTypesForWidget('splash') returns ['Page', 'Program']
   - getWidgetsForContentType('Event') returns ['blockGrid', 'textGrid', 'calendar']
   - getBestWidgetForContentType('Page') returns 'splash'
   ```

2. **Field Mapping**
   ```typescript
   - getRequiredFields('splash') returns correct fields
   - getOptionalFields('grid') returns correct fields
   - getFieldMapping('splash', 'title') returns correct mapping
   ```

3. **Pattern Matching**
   ```typescript
   - findWidgetByFigmaPattern(['hero sections']) includes 'splash'
   - findWidgetByFigmaPattern(['grid layouts']) includes 'blockGrid'
   ```

4. **Edge Cases**
   ```typescript
   - getWidgetMapping('unknown') returns undefined
   - getContentTypesForWidget('store') returns empty array
   - getRequiredFields('invalid') returns empty array
   ```

5. **Visual Properties**
   ```typescript
   - getVisualProperties('splash') returns correct properties
   - Visual properties match widget capabilities
   ```

**How to Run**:
```bash
npm test tools/contentful/__tests__/widget-mapping.test.ts
```

**Success Criteria**:
- ✅ All lookup functions return correct results
- ✅ Field mappings are accurate
- ✅ Pattern matching works for all widget types
- ✅ Edge cases handled gracefully
- ✅ 100% code coverage for mapping functions

---

### Checkpoint 2: Figma Parser Integration

**Location**: After Phase 2 implementation  
**Test File**: `__tests__/figma-parser.test.ts`

#### Test Cases

1. **Figma API Connection**
   ```typescript
   - parseFigmaFile() connects to Figma API successfully
   - Handles authentication errors
   - Handles rate limiting
   - Handles invalid file keys
   ```

2. **Design Data Extraction**
   ```typescript
   - Extracts all text content correctly
   - Extracts all images with correct metadata
   - Extracts layout information
   - Preserves hierarchy (children)
   ```

3. **Widget Type Detection**
   ```typescript
   - detectWidgetType() identifies 'splash' for hero sections
   - detectWidgetType() identifies 'grid' for grid layouts
   - detectWidgetType() returns undefined for ambiguous designs
   ```

4. **Helper Functions**
   ```typescript
   - extractTexts() returns all texts recursively
   - extractImages() returns all images recursively
   ```

5. **Error Handling**
   ```typescript
   - Handles missing Figma files
   - Handles network errors
   - Handles malformed API responses
   ```

**Mock Data**: Use sample Figma API responses

**How to Run**:
```bash
npm test tools/contentful/__tests__/figma-parser.test.ts
```

**Success Criteria**:
- ✅ Figma API integration works with mocks
- ✅ All extraction functions work correctly
- ✅ Widget detection has >80% accuracy on test cases
- ✅ Error handling covers all failure scenarios
- ✅ 80%+ code coverage

---

### Checkpoint 3: LLM Conversion

**Location**: After Phase 3 implementation  
**Test File**: `__tests__/llm-converter.test.ts`

#### Test Cases

1. **Widget Identification**
   ```typescript
   - identifyWidgetType() correctly identifies widget types
   - Returns confidence scores
   - Handles ambiguous designs
   ```

2. **Content Extraction**
   ```typescript
   - extractContentFields() extracts all required fields
   - Maps Figma data to Contentful fields correctly
   - Handles missing optional fields
   - Validates field types
   ```

3. **Full Conversion**
   ```typescript
   - convertFigmaToContentful() produces valid ConversionResult
   - All required fields are present
   - Field values are correctly typed
   - Confidence scores are reasonable (>0.7 for required fields)
   ```

4. **Validation**
   ```typescript
   - validateExtractedFields() catches missing required fields
   - validateExtractedFields() flags low confidence fields
   - Returns actionable error messages
   ```

5. **Error Handling**
   ```typescript
   - Handles LLM API failures
   - Handles invalid LLM responses
   - Handles timeout errors
   - Retries on transient failures
   ```

**Mock Data**: Use mock LLM responses (JSON format)

**How to Run**:
```bash
npm test tools/contentful/__tests__/llm-converter.test.ts
```

**Success Criteria**:
- ✅ Widget identification accuracy >85%
- ✅ Content extraction captures all required fields
- ✅ Field mapping is correct for all widget types
- ✅ Validation catches all schema violations
- ✅ Error handling is robust
- ✅ 80%+ code coverage

---

### Checkpoint 4: Content Analyzer & Similarity Detection

**Location**: After Phase 4 implementation  
**Test File**: `__tests__/content-analyzer.test.ts`

#### Test Cases

1. **Site Content Analysis**
   ```typescript
   - analyzeSiteContent() queries all pages
   - Identifies widget types on each page
   - Tracks widget usage statistics
   - Extracts content view details
   ```

2. **Page Content Queries**
   ```typescript
   - getPageContent() returns page summary
   - isWidgetTypeUsedOnPage() checks usage
   - getPageWidgetTypes() returns all widget types
   - Handles non-existent pages
   ```

3. **Widget Type Search**
   ```typescript
   - findPagesWithWidgetType() finds pages
   - Returns empty array if none found
   ```

4. **Duplicate Detection**
   ```typescript
   - checkForDuplicateContent() detects duplicates
   - Returns false for new content
   - Handles non-existent pages
   ```

5. **Placement Recommendations**
   ```typescript
   - getContentPlacementRecommendations() provides suggestions
   - Recommends target page if specified
   - Detects existing usage
   - Includes usage statistics
   ```

6. **Similarity Detection**
   ```typescript
   - calculateEntrySimilarity() weights title at 50%
   - calculateEntrySimilarity() calculates description (20%)
   - calculateEntrySimilarity() calculates slug (15%)
   - findEntryToUpdate() respects similarity threshold
   - Handles missing fields gracefully
   - Returns field-level similarities
   ```

7. **Edge Cases**
   ```typescript
   - Handles pages with no content views
   - Handles unknown adapters
   - Handles missing collections
   - Handles completely different entries
   ```

**Mock Data**: Mock Contentful page queries with content views

**How to Run**:
```bash
npm test tools/contentful/__tests__/content-analyzer.test.ts
npm test tools/contentful/__tests__/similarity.test.ts
```

**Success Criteria**:
- ✅ All analysis functions work correctly
- ✅ Widget type detection is accurate
- ✅ Duplicate detection works
- ✅ Similarity detection weights title at 50%
- ✅ Similarity threshold filtering works
- ✅ Recommendations are helpful
- ✅ Edge cases handled gracefully
- ✅ 80%+ code coverage

---

### Checkpoint 5: Contentful Generation & Updates

**Location**: After Phase 4 implementation  
**Test File**: `__tests__/contentful-generator.test.ts`

#### Test Cases

1. **Entry Creation/Update**
   ```typescript
   - createOrUpdateContentfulEntry() checks for similar entries first
   - Updates existing entries if similarity > threshold
   - Creates new entries if no similar entry found
   - createContentfulEntry() creates entries successfully
   - updateContentfulEntry() updates entries successfully
   - Field format mapping is correct
   - Handles all content types
   - Creates draft entries when specified
   ```

2. **Asset Upload**
   ```typescript
   - uploadAsset() uploads images successfully
   - Handles different image formats
   - Returns correct asset IDs
   - Links assets to entries correctly
   ```

3. **Field Format Mapping**
   ```typescript
   - mapFieldsToContentfulFormat() produces correct structure
   - Handles different locales
   - Handles nested fields
   ```

4. **Validation**
   ```typescript
   - validateEntry() catches schema violations
   - validateEntry() checks required fields
   - Returns clear error messages
   ```

5. **Publishing**
   ```typescript
   - publishEntry() publishes entries successfully
   - Handles version conflicts
   - Updates entry status correctly
   ```

6. **Error Handling**
   ```typescript
   - Handles Contentful API errors
   - Handles network failures
   - Handles invalid entry data
   - Provides retry logic
   ```

**Mock Data**: Mock Contentful Management API responses

**How to Run**:
```bash
npm test tools/contentful/__tests__/contentful-generator.test.ts
```

**Success Criteria**:
- ✅ Entry creation works for all content types
- ✅ Entry updates work correctly
- ✅ Similarity checking before create/update
- ✅ Asset upload handles all formats
- ✅ Field mapping is correct
- ✅ Validation prevents invalid entries
- ✅ Publishing workflow works
- ✅ 80%+ code coverage

---

### Checkpoint 6: Visual Validation

**Location**: After Phase 5 implementation  
**Test File**: `__tests__/visual-validator.test.ts`

#### Test Cases

1. **Rendering**
   ```typescript
   - renderAndCapture() renders Contentful content correctly
   - Screenshots are captured at correct dimensions
   - Handles rendering errors
   ```

2. **Screenshot Comparison**
   ```typescript
   - compareImages() calculates accurate match scores
   - Detects layout differences
   - Detects color differences
   - Detects text differences
   - Detects missing/extra elements
   ```

3. **Difference Detection**
   ```typescript
   - Identifies difference types correctly
   - Provides accurate locations
   - Assigns correct severity levels
   ```

4. **Suggestion Generation**
   ```typescript
   - generateSuggestions() produces actionable feedback
   - Suggestions match difference types
   - Suggestions are widget-specific
   ```

5. **Full Validation**
   ```typescript
   - validateVisualMatch() returns accurate comparison
   - Match scores are reasonable
   - Differences are correctly identified
   - Suggestions are helpful
   ```

**Test Images**: Use sample screenshots for comparison

**How to Run**:
```bash
npm test tools/contentful/__tests__/visual-validator.test.ts
```

**Success Criteria**:
- ✅ Rendering pipeline works correctly
- ✅ Image comparison accuracy >90%
- ✅ Difference detection is precise
- ✅ Suggestions are actionable
- ✅ 80%+ code coverage

---

### Checkpoint 7: End-to-End Integration

**Location**: After all phases complete  
**Test File**: `__tests__/e2e.test.ts`

#### Test Scenarios

1. **Complete Flow: Splash Widget**
   ```typescript
   - Parse Figma hero section
   - Identify as 'splash' widget
   - Extract content (title, image)
   - Create Page entry in Contentful
   - Validate visual match
   - All steps succeed
   ```

2. **Complete Flow: Grid Widget**
   ```typescript
   - Parse Figma grid layout
   - Identify as 'blockGrid' widget
   - Extract multiple items
   - Create Event entries
   - Validate visual match
   - All steps succeed
   ```

3. **Error Recovery**
   ```typescript
   - Handles Figma API failure gracefully
   - Handles LLM conversion failure
   - Handles Contentful creation failure
   - Provides clear error messages
   ```

4. **Performance**
   ```typescript
   - Complete flow completes in <30s
   - Asset uploads don't timeout
   - Visual validation completes in <10s
   ```

**Test Data**: Use real Figma files (or realistic mocks)

**How to Run**:
```bash
npm test tools/contentful/__tests__/e2e.test.ts
```

**Success Criteria**:
- ✅ Complete flows work for all widget types
- ✅ Error recovery is robust
- ✅ Performance meets targets
- ✅ Visual validation is accurate

---

## Test Organization

```
tools/contentful/
├── __tests__/
│   ├── widget-mapping.test.ts          # Checkpoint 1
│   ├── figma-parser.test.ts           # Checkpoint 2
│   ├── llm-converter.test.ts          # Checkpoint 3
│   ├── contentful-generator.test.ts   # Checkpoint 4
│   ├── visual-validator.test.ts      # Checkpoint 5
│   ├── e2e.test.ts                    # Checkpoint 6
│   └── fixtures/                      # Test data
│       ├── figma-responses/
│       ├── llm-responses/
│       ├── contentful-responses/
│       └── screenshots/
```

## Running Tests

### Run All Tests
```bash
npm test tools/contentful
```

### Run Specific Checkpoint
```bash
# Checkpoint 1
npm test tools/contentful/__tests__/widget-mapping.test.ts

# Checkpoint 2
npm test tools/contentful/__tests__/figma-parser.test.ts

# etc.
```

### Run with Coverage
```bash
npm run test:coverage tools/contentful
```

### Watch Mode
```bash
npm run test:watch tools/contentful
```

## Test Data Management

### Fixtures
- Store mock API responses in `__tests__/fixtures/`
- Use realistic but anonymized data
- Version control test data

### Mocking Strategy
- **Figma API**: Mock HTTP responses
- **LLM API**: Mock JSON responses
- **Contentful API**: Mock Management API responses
- **Rendering**: Use headless browser mocks

## Continuous Integration

Tests should run:
- On every commit (unit tests)
- On pull requests (all tests)
- Before deployment (E2E tests)

## Debugging Failed Tests

1. **Check test output** for specific failures
2. **Review mock data** for accuracy
3. **Check API mocks** are correctly configured
4. **Verify test data** matches expected formats
5. **Run tests in isolation** to identify specific issues

## Next Steps

When you reach each checkpoint:
1. Review the test cases for that checkpoint
2. Run the tests to see current status
3. Fix any failing tests
4. Ensure coverage targets are met
5. Document any issues or edge cases found
6. Proceed to next phase

