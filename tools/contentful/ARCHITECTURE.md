# Figma-to-Contentful Conversion System Architecture

## Overview

This system enables bidirectional mapping between UI widgets and Contentful content types, and provides LLM-assisted conversion from Figma designs to Contentful entries. The goal is to ensure visual fidelity between Figma designs and the rendered content from Contentful.

## System Components

### 1. Widget-to-Contentful Mapping (`widget-mapping.ts`)

**Purpose**: Establishes bidirectional relationships between UI widgets and Contentful content types.

**Key Concepts**:
- **Widget Types**: splash, grid, calendar, doubleColumn, singleColumn, verticalTimeline, report, store
- **Content Types**: Page, Program, Event, Post, Exhibit, Member, Press, ImpactReport
- **Adapters**: Functions that transform Contentful data into widget data

**Mapping Structure**:
```typescript
{
  widgetType: 'splash',
  contentTypes: ['Page', 'Program'],
  adapters: ['splash-from-page', 'splash-from-program'],
  requiredFields: ['title', 'imageCollection'],
  optionalFields: ['description', 'videoCollection'],
  visualProperties: {
    layout: 'full-width',
    hasOverlay: true,
    supportsVideo: true
  }
}
```

### 2. Figma Design Parser (`figma-parser.ts`)

**Purpose**: Extracts design information from Figma files/API.

**Capabilities**:
- Parse Figma frame/node structure
- Extract text content, images, layout information
- Identify widget patterns (e.g., grid layouts, timelines, hero sections)
- Extract styling information (colors, fonts, spacing)
- Identify component hierarchies

**Input**: Figma file URL or Figma API node data
**Output**: Structured design data matching widget schemas

### 3. LLM Conversion Engine (`llm-converter.ts`)

**Purpose**: Intelligently converts Figma design data into Contentful entry structures.

**Process**:
1. **Design Analysis**: LLM analyzes Figma design and identifies widget types
2. **Content Extraction**: Extracts text, images, and structured data from design
3. **Schema Mapping**: Maps extracted data to appropriate Contentful content types
4. **Field Mapping**: Intelligently maps design elements to Contentful fields
5. **Validation**: Ensures extracted data matches Contentful schema requirements

**LLM Prompts**:
- Widget type identification
- Content extraction and structuring
- Field mapping suggestions
- Validation and error correction

### 4. Contentful Entry Generator (`contentful-generator.ts`)

**Purpose**: Creates or updates Contentful entries from converted design data.

**Capabilities**:
- **Check for similar entries before creating**
- **Update existing entries if similarity threshold is met (default: 70%)**
- Generate Contentful Management API payloads
- Handle asset uploads (images, videos)
- Create linked entries (references)
- Validate entries before creation/update
- Support draft/publish workflows

### 5. Content Analyzer (`content-analyzer.ts`)

**Purpose**: Analyzes existing Contentful content to understand what's already on pages before creating new entries.

**Capabilities**:
- Query all pages and their content views
- Identify widget types used on each page
- Track widget and content type usage across the site
- **Find similar entries using weighted similarity (title weighted 50%)**
- **Detect duplicates and suggest updates instead of creation**
- Provide recommendations for content placement

**Process**:
1. Query all pages from Contentful
2. Analyze content views on each page
3. Map content views to widget types via adapters
4. Build usage statistics
5. Provide recommendations for new content

### 6. Visual Validation System (`visual-validator.ts`)

**Purpose**: Compares Figma designs with rendered Contentful content.

**Process**:
1. Render Contentful content using actual components
2. Capture screenshots of rendered output
3. Compare with Figma design screenshots
4. Identify visual discrepancies
5. Generate feedback for corrections

## Data Flow

```
┌─────────────┐
│  Figma File │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Figma Parser   │  Extract design data
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  LLM Converter  │  Analyze & convert to Contentful structure
└──────┬──────────┘
       │
       ▼
┌──────────────────────┐
│ Widget Mapping       │  Map to appropriate widget/content type
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Content Analyzer     │  Check existing content on pages
└──────┬───────────────┘  Find similar entries (title-weighted)
       │
       ▼
┌──────────────────────┐
│ Contentful Generator │  Create OR UPDATE entries via Management API
└──────┬───────────────┘  (Updates if similarity > 70%)
       │
       ▼
┌──────────────────────┐
│ Visual Validator     │  Compare rendered output with design
└──────────────────────┘
```

## Widget Mapping Rules

### Splash Widget
- **Content Types**: Page, Program
- **Required Fields**: title, imageCollection or videoCollection
- **Visual Properties**: Full-width hero, supports overlay, video background
- **Figma Patterns**: Hero sections, large image/video backgrounds, centered text

### Grid Widget
- **Content Types**: Exhibit, Event, Program, Member, Post
- **Required Fields**: title, imageCollection
- **Visual Properties**: Responsive grid layout, card-based items
- **Figma Patterns**: Grid layouts, card components, image galleries

### Calendar Widget
- **Content Types**: Event
- **Required Fields**: title, startDate, slug
- **Visual Properties**: Calendar view, date-based organization
- **Figma Patterns**: Calendar components, date pickers, event lists

### Double/Single Column Widget
- **Content Types**: Post, Program
- **Required Fields**: title, content
- **Visual Properties**: Text-heavy layouts, article-style
- **Figma Patterns**: Article layouts, blog posts, text columns

### Vertical Timeline Widget
- **Content Types**: Press, Post (with history tag)
- **Required Fields**: title, date, description
- **Visual Properties**: Chronological timeline, date-based ordering
- **Figma Patterns**: Timeline components, chronological lists

### Report Widget
- **Content Types**: ImpactReport
- **Required Fields**: title, categories, metrics
- **Visual Properties**: Data visualization, charts, statistics
- **Figma Patterns**: Dashboard layouts, data tables, charts

## LLM Integration Strategy

### Prompt Engineering

1. **Widget Identification Prompt**:
   - Analyze Figma frame structure
   - Identify layout patterns
   - Match to widget types
   - Provide confidence scores

2. **Content Extraction Prompt**:
   - Extract all text content
   - Identify images and their contexts
   - Extract structured data (dates, numbers, lists)
   - Preserve hierarchy and relationships

3. **Field Mapping Prompt**:
   - Map extracted content to Contentful fields
   - Suggest appropriate content types
   - Identify required vs optional fields
   - Handle edge cases and missing data

4. **Validation Prompt**:
   - Check data completeness
   - Verify field types match schemas
   - Suggest corrections for invalid data
   - Generate human-readable error messages

### LLM Provider Options

- **OpenAI GPT-4**: Best for complex reasoning and structured output
- **Anthropic Claude**: Good for long context and detailed analysis
- **Local LLMs**: For privacy-sensitive workflows (via Ollama, etc.)

## Implementation Phases

### Phase 1: Core Mapping System
- [x] Widget-to-Contentful mapping definitions
- [x] Bidirectional lookup functions
- [x] Schema validation helpers
- [ ] **TESTING CHECKPOINT 1**: Unit tests for all mapping functions
  - Test bidirectional lookups
  - Test field mapping extraction
  - Test pattern matching
  - Test edge cases (unknown widgets, empty mappings)

### Phase 2: Figma Integration
- [x] Figma API client setup
- [x] Design parser implementation
- [x] Pattern recognition for widget types
- [ ] **TESTING CHECKPOINT 2**: Integration tests for Figma parser
  - Test Figma API connection
  - Test design data extraction
  - Test widget type detection
  - Test error handling (invalid files, API errors)

### Phase 3: LLM Conversion
- [ ] LLM client integration
- [ ] Prompt templates
- [ ] Conversion pipeline
- [ ] Error handling and retry logic
- [ ] **TESTING CHECKPOINT 3**: LLM conversion tests
  - Test widget identification accuracy
  - Test content extraction quality
  - Test field mapping correctness
  - Test validation logic
  - Test with mock LLM responses

### Phase 4: Content Analyzer
- [ ] Contentful query functions for pages
- [ ] Content view analysis
- [ ] Widget type detection from adapters
- [ ] Usage statistics tracking
- [ ] Duplicate detection
- [ ] **TESTING CHECKPOINT 4**: Content analyzer tests
  - Test page content querying
  - Test content view analysis
  - Test widget type detection
  - Test duplicate detection
  - Test placement recommendations

### Phase 5: Contentful Generation
- [ ] Management API client
- [ ] Entry creation functions
- [ ] Asset upload handling
- [ ] Draft/publish workflow
- [ ] **TESTING CHECKPOINT 5**: Contentful generation tests
  - Test entry creation (with mocks)
  - Test asset upload flow
  - Test field format mapping
  - Test validation before creation
  - Test draft/publish workflow

### Phase 6: Visual Validation
- [ ] Rendering pipeline
- [ ] Screenshot comparison
- [ ] Diff generation
- [ ] Feedback system
- [ ] **TESTING CHECKPOINT 6**: Visual validation tests
  - Test rendering pipeline
  - Test screenshot capture
  - Test image comparison accuracy
  - Test difference detection
  - Test suggestion generation

### Phase 7: End-to-End Integration
- [ ] Full pipeline integration
- [ ] Error recovery and retry logic
- [ ] Performance optimization
- [ ] **TESTING CHECKPOINT 7**: E2E integration tests
  - Test complete Figma → Contentful flow
  - Test content analysis integration
  - Test error scenarios end-to-end
  - Test performance with real data
  - Test visual validation accuracy

## Usage Examples

### Basic Widget Mapping
```typescript
import { getWidgetForContentType, getContentTypesForWidget } from './widget-mapping';

// Find which widget to use for a Page content type
const widget = getWidgetForContentType('Page');
// Returns: { widgetType: 'splash', adapters: ['splash-from-page'] }

// Find which content types can create a grid widget
const contentTypes = getContentTypesForWidget('grid');
// Returns: ['Exhibit', 'Event', 'Program', 'Member', 'Post']
```

### Content Analysis Before Conversion
```typescript
import { analyzeSiteContent, findEntryToUpdate } from './content-analyzer';

// Analyze existing content
const analysis = await analyzeSiteContent();
console.log(`Found ${analysis.totalPages} pages with ${analysis.totalWidgets} widgets`);

// Find similar entries (title-weighted similarity)
const similarEntry = await findEntryToUpdate(
  { title: 'Welcome', description: '...' },
  'Page',
  0.7 // 70% similarity threshold
);

if (similarEntry) {
  console.log(`Found similar entry: ${similarEntry.entryId} (${similarEntry.similarity * 100}% similar)`);
  console.log(`Title similarity: ${similarEntry.titleSimilarity * 100}%`);
}
```

### Create or Update Entries
```typescript
import { createOrUpdateContentfulEntry } from './contentful-generator';

// Automatically updates if similar entry found, otherwise creates
const result = await createOrUpdateContentfulEntry(
  conversionResult,
  config,
  0.7 // Update threshold
);

if (result.wasUpdated) {
  console.log(`Updated existing entry: ${result.entryId}`);
} else {
  console.log(`Created new entry: ${result.entryId}`);
}
```

### Figma to Contentful Conversion
```typescript
import { convertFigmaToContentful } from './llm-converter';
import { getContentPlacementRecommendations } from './content-analyzer';

// Get recommendations for where to add content
const recommendations = await getContentPlacementRecommendations('splash', 'home');

// Convert Figma design
const figmaFileUrl = 'https://www.figma.com/file/...';
const result = await convertFigmaToContentful(figmaFileUrl, {
  targetWidget: 'splash',
  contentType: 'Page',
  spaceId: 'your-space-id'
});

// Creates Contentful entries and returns entry IDs
```

### Visual Validation
```typescript
import { validateVisualMatch } from './visual-validator';

const validation = await validateVisualMatch({
  figmaUrl: 'https://www.figma.com/file/...',
  contentfulEntryId: 'entry-id',
  widgetType: 'splash'
});

// Returns: { match: 0.95, differences: [...], suggestions: [...] }
```

## Error Handling

- **Figma API Errors**: Rate limiting, authentication, file access
- **LLM Errors**: API failures, timeout, invalid responses
- **Contentful Errors**: Schema validation, required fields, asset uploads
- **Validation Errors**: Visual mismatches, missing content, layout issues

## Future Enhancements

1. **Batch Processing**: Convert multiple Figma frames at once
2. **Incremental Updates**: Update existing Contentful entries from design changes
3. **Design System Integration**: Map Figma components to design tokens
4. **Collaboration Features**: Review and approval workflows
5. **Version Control**: Track design-to-content changes over time
6. **Automated Testing**: Continuous visual regression testing

