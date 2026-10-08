/**
 * Contentful Tools - Main Export
 * 
 * Central export point for all Contentful tools and utilities.
 */

// Widget Mapping
export * from './widget-mapping';
export type {
  WidgetMapping,
  FieldMapping,
  VisualProperties
} from './widget-mapping';

// Schema Validation
export * from './schema-validation';
export type {
  SchemaValidationError
} from './schema-validation';

// Figma Parser
export * from './figma-parser';
export type {
  FigmaConfig,
  FigmaText,
  FigmaImage,
  FigmaLayout,
  FigmaDesignData
} from './figma-parser';
export { FigmaAPIError } from './figma-parser';

// LLM Converter (planned)
export * from './llm-converter';
export type {
  LLMConfig,
  ConversionOptions,
  ExtractedField,
  ConversionResult
} from './llm-converter';

// Contentful Generator (planned)
export * from './contentful-generator';
export type {
  ContentfulConfig,
  AssetUploadResult,
  EntryCreationResult
} from './contentful-generator';

// Content Analyzer
export * from './content-analyzer';
export type {
  PageContentSummary,
  ContentViewSummary,
  SiteContentAnalysis,
  SimilarityMatch
} from './content-analyzer';

// Visual Validator (planned)
export * from './visual-validator';
export type {
  ScreenshotConfig,
  VisualComparison,
  VisualDifference,
  ValidationOptions
} from './visual-validator';

