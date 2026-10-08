/**
 * Widget-to-Contentful Mapping System
 * 
 * Provides bidirectional mapping between UI widgets and Contentful content types.
 * This enables intelligent conversion from Figma designs to Contentful entries.
 */

import type { WidgetType } from '../../src/lib/components/component-map';
import type { ContentType } from '../../src/lib/adapters/registry';

/**
 * Visual properties that describe how a widget appears
 */
export interface VisualProperties {
  /** Layout type (e.g., 'full-width', 'grid', 'column') */
  layout: string;
  /** Whether the widget supports overlay effects */
  hasOverlay?: boolean;
  /** Whether the widget supports video backgrounds */
  supportsVideo?: boolean;
  /** Whether the widget displays images */
  hasImages?: boolean;
  /** Whether the widget is responsive */
  isResponsive?: boolean;
  /** Typical number of items displayed (for collection widgets) */
  typicalItemCount?: number;
}

/**
 * Field mapping information
 */
export interface FieldMapping {
  /** Contentful field name */
  fieldName: string;
  /** Whether this field is required */
  required: boolean;
  /** Field type in Contentful */
  fieldType: 'Text' | 'RichText' | 'Asset' | 'Date' | 'Reference' | 'Number' | 'Boolean';
  /** Description of what this field represents */
  description: string;
  /** Figma patterns that might contain this data */
  figmaPatterns?: string[];
}

/**
 * Widget mapping definition
 */
export interface WidgetMapping {
  /** The widget type */
  widgetType: WidgetType;
  /** Content types that can be used with this widget */
  contentTypes: ContentType[];
  /** Adapter IDs that can produce this widget */
  adapters: string[];
  /** Required fields for this widget */
  requiredFields: FieldMapping[];
  /** Optional fields for this widget */
  optionalFields: FieldMapping[];
  /** Visual properties of this widget */
  visualProperties: VisualProperties;
  /** Figma design patterns that match this widget */
  figmaPatterns: string[];
  /** Description of the widget */
  description: string;
}

/**
 * Complete widget mapping registry
 */
export const widgetMappings: WidgetMapping[] = [
  {
    widgetType: 'splash',
    contentTypes: ['Page', 'Program'],
    adapters: ['splash-from-page', 'splash-from-program'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Main heading text',
        figmaPatterns: ['Large heading text', 'Hero title', 'H1 text']
      },
      {
        fieldName: 'imageCollection',
        required: false, // Can use videoCollection instead
        fieldType: 'Asset',
        description: 'Background image or video',
        figmaPatterns: ['Background image', 'Hero image', 'Full-width image']
      },
      {
        fieldName: 'videoCollection',
        required: false, // Can use imageCollection instead
        fieldType: 'Asset',
        description: 'Background video',
        figmaPatterns: ['Background video', 'Hero video']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Subtitle or description text',
        figmaPatterns: ['Subtitle', 'Description text', 'Body text']
      }
    ],
    visualProperties: {
      layout: 'full-width',
      hasOverlay: true,
      supportsVideo: true,
      hasImages: true,
      isResponsive: true
    },
    figmaPatterns: [
      'Hero sections',
      'Large image/video backgrounds',
      'Centered text over images',
      'Full-width banners',
      'Landing page headers'
    ],
    description: 'Full-width hero section with background image/video and centered text'
  },
  {
    widgetType: 'blockGrid',
    contentTypes: ['Exhibit', 'Event', 'Program', 'Member', 'Post'],
    adapters: [
      'grid-from-exhibits',
      'grid-from-events',
      'grid-from-programs',
      'grid-from-members',
      'grid-from-posts'
    ],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Item title',
        figmaPatterns: ['Card title', 'Item heading', 'Grid item title']
      },
      {
        fieldName: 'imageCollection',
        required: true,
        fieldType: 'Asset',
        description: 'Item image',
        figmaPatterns: ['Card image', 'Thumbnail', 'Grid item image']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Item description or subtitle',
        figmaPatterns: ['Card description', 'Subtitle', 'Body text']
      },
      {
        fieldName: 'url',
        required: false,
        fieldType: 'Text',
        description: 'Link URL',
        figmaPatterns: ['Link', 'Card link', 'Button link']
      }
    ],
    visualProperties: {
      layout: 'grid',
      hasImages: true,
      isResponsive: true,
      typicalItemCount: 4
    },
    figmaPatterns: [
      'Grid layouts',
      'Card components',
      'Image galleries',
      'Product grids',
      'Responsive grids'
    ],
    description: 'Responsive grid of items with images and titles'
  },
  {
    widgetType: 'textGrid',
    contentTypes: ['Exhibit', 'Event', 'Program', 'Member', 'Post'],
    adapters: [
      'grid-from-exhibits',
      'grid-from-events',
      'grid-from-programs',
      'grid-from-members',
      'grid-from-posts'
    ],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Item title',
        figmaPatterns: ['Card title', 'Item heading']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Item description',
        figmaPatterns: ['Card description', 'Body text']
      },
      {
        fieldName: 'imageCollection',
        required: false,
        fieldType: 'Asset',
        description: 'Optional item image',
        figmaPatterns: ['Card image', 'Thumbnail']
      }
    ],
    visualProperties: {
      layout: 'grid',
      isResponsive: true,
      typicalItemCount: 4
    },
    figmaPatterns: [
      'Text-based grids',
      'List layouts',
      'Card grids without images'
    ],
    description: 'Text-focused grid layout (similar to blockGrid but text-primary)'
  },
  {
    widgetType: 'calendar',
    contentTypes: ['Event'],
    adapters: ['calendar-from-events'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Event title',
        figmaPatterns: ['Event name', 'Calendar event title']
      },
      {
        fieldName: 'startDate',
        required: true,
        fieldType: 'Date',
        description: 'Event start date and time',
        figmaPatterns: ['Date', 'Calendar date', 'Event date']
      },
      {
        fieldName: 'slug',
        required: true,
        fieldType: 'Text',
        description: 'URL slug for event page',
        figmaPatterns: []
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Event description',
        figmaPatterns: ['Event description', 'Body text']
      },
      {
        fieldName: 'endDate',
        required: false,
        fieldType: 'Date',
        description: 'Event end date and time',
        figmaPatterns: ['End date', 'Event end']
      }
    ],
    visualProperties: {
      layout: 'calendar',
      isResponsive: true
    },
    figmaPatterns: [
      'Calendar components',
      'Date pickers',
      'Event lists',
      'Schedule views'
    ],
    description: 'Calendar view displaying events by date'
  },
  {
    widgetType: 'doubleColumn',
    contentTypes: ['Post', 'Program'],
    adapters: ['double-column-from-posts', 'double-column-from-programs'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Article or post title',
        figmaPatterns: ['Article title', 'Heading', 'H1']
      },
      {
        fieldName: 'content',
        required: true,
        fieldType: 'RichText',
        description: 'Main article content',
        figmaPatterns: ['Body text', 'Article content', 'Paragraphs']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Article excerpt or description',
        figmaPatterns: ['Excerpt', 'Summary', 'Subtitle']
      },
      {
        fieldName: 'imageCollection',
        required: false,
        fieldType: 'Asset',
        description: 'Article images',
        figmaPatterns: ['Article image', 'Featured image']
      },
      {
        fieldName: 'date',
        required: false,
        fieldType: 'Date',
        description: 'Publication date',
        figmaPatterns: ['Date', 'Published date']
      }
    ],
    visualProperties: {
      layout: 'column',
      isResponsive: true
    },
    figmaPatterns: [
      'Article layouts',
      'Blog posts',
      'Two-column text',
      'Magazine layouts'
    ],
    description: 'Two-column article or blog post layout'
  },
  {
    widgetType: 'singleColumn',
    contentTypes: ['Post'],
    adapters: ['single-column-from-posts'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Article title',
        figmaPatterns: ['Article title', 'Heading']
      },
      {
        fieldName: 'content',
        required: true,
        fieldType: 'RichText',
        description: 'Main article content',
        figmaPatterns: ['Body text', 'Article content']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Article excerpt',
        figmaPatterns: ['Excerpt', 'Summary']
      },
      {
        fieldName: 'imageCollection',
        required: false,
        fieldType: 'Asset',
        description: 'Article images',
        figmaPatterns: ['Article image']
      }
    ],
    visualProperties: {
      layout: 'column',
      isResponsive: true
    },
    figmaPatterns: [
      'Single column articles',
      'Blog posts',
      'Narrow text layouts'
    ],
    description: 'Single-column article layout'
  },
  {
    widgetType: 'verticalTimeline',
    contentTypes: ['Press', 'Post'],
    adapters: ['vertical-timeline-from-press', 'vertical-timeline-from-history'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Timeline item title',
        figmaPatterns: ['Event title', 'Timeline heading']
      },
      {
        fieldName: 'date',
        required: true,
        fieldType: 'Date',
        description: 'Timeline item date',
        figmaPatterns: ['Date', 'Timeline date', 'Event date']
      },
      {
        fieldName: 'description',
        required: true,
        fieldType: 'Text',
        description: 'Timeline item description',
        figmaPatterns: ['Description', 'Body text', 'Event description']
      }
    ],
    optionalFields: [
      {
        fieldName: 'imageCollection',
        required: false,
        fieldType: 'Asset',
        description: 'Timeline item image',
        figmaPatterns: ['Timeline image', 'Event image']
      }
    ],
    visualProperties: {
      layout: 'timeline',
      hasImages: true,
      isResponsive: true
    },
    figmaPatterns: [
      'Timeline components',
      'Chronological lists',
      'History views',
      'Event timelines'
    ],
    description: 'Vertical timeline displaying chronological events'
  },
  {
    widgetType: 'report',
    contentTypes: ['ImpactReport'],
    adapters: ['report-from-impact-report'],
    requiredFields: [
      {
        fieldName: 'title',
        required: true,
        fieldType: 'Text',
        description: 'Report title',
        figmaPatterns: ['Report heading', 'Dashboard title']
      },
      {
        fieldName: 'categories',
        required: true,
        fieldType: 'Reference',
        description: 'Report categories with metrics',
        figmaPatterns: ['Data sections', 'Chart groups']
      }
    ],
    optionalFields: [
      {
        fieldName: 'description',
        required: false,
        fieldType: 'Text',
        description: 'Report description',
        figmaPatterns: ['Report summary', 'Introduction']
      }
    ],
    visualProperties: {
      layout: 'report',
      isResponsive: true
    },
    figmaPatterns: [
      'Dashboard layouts',
      'Data tables',
      'Charts and graphs',
      'Statistics displays'
    ],
    description: 'Impact report with data visualization and statistics'
  },
  {
    widgetType: 'store',
    contentTypes: [], // Store doesn't use Contentful content types
    adapters: [],
    requiredFields: [],
    optionalFields: [],
    visualProperties: {
      layout: 'store',
      isResponsive: true
    },
    figmaPatterns: [
      'E-commerce layouts',
      'Product grids',
      'Shopping carts'
    ],
    description: 'Store component for Square payment integration'
  }
];

/**
 * Get widget mapping for a specific widget type
 */
export function getWidgetMapping(widgetType: WidgetType): WidgetMapping | undefined {
  return widgetMappings.find(mapping => mapping.widgetType === widgetType);
}

/**
 * Get all content types that can be used with a widget
 */
export function getContentTypesForWidget(widgetType: WidgetType): ContentType[] {
  const mapping = getWidgetMapping(widgetType);
  return mapping?.contentTypes || [];
}

/**
 * Get all widgets that can be created from a content type
 */
export function getWidgetsForContentType(contentType: ContentType): WidgetType[] {
  return widgetMappings
    .filter(mapping => mapping.contentTypes.includes(contentType))
    .map(mapping => mapping.widgetType);
}

/**
 * Get the best widget type for a content type (prefers first match)
 */
export function getBestWidgetForContentType(contentType: ContentType): WidgetType | undefined {
  const widgets = getWidgetsForContentType(contentType);
  return widgets[0];
}

/**
 * Get adapter IDs for a widget type
 */
export function getAdaptersForWidget(widgetType: WidgetType): string[] {
  const mapping = getWidgetMapping(widgetType);
  return mapping?.adapters || [];
}

/**
 * Get all required fields for a widget type
 */
export function getRequiredFields(widgetType: WidgetType): FieldMapping[] {
  const mapping = getWidgetMapping(widgetType);
  return mapping?.requiredFields || [];
}

/**
 * Get all optional fields for a widget type
 */
export function getOptionalFields(widgetType: WidgetType): FieldMapping[] {
  const mapping = getWidgetMapping(widgetType);
  return mapping?.optionalFields || [];
}

/**
 * Get visual properties for a widget type
 */
export function getVisualProperties(widgetType: WidgetType): VisualProperties | undefined {
  const mapping = getWidgetMapping(widgetType);
  return mapping?.visualProperties;
}

/**
 * Find widget type that matches Figma patterns
 */
export function findWidgetByFigmaPattern(patterns: string[]): WidgetType[] {
  const matches: WidgetType[] = [];
  
  for (const mapping of widgetMappings) {
    const hasMatch = patterns.some(pattern =>
      mapping.figmaPatterns.some(figmaPattern =>
        figmaPattern.toLowerCase().includes(pattern.toLowerCase()) ||
        pattern.toLowerCase().includes(figmaPattern.toLowerCase())
      )
    );
    
    if (hasMatch) {
      matches.push(mapping.widgetType);
    }
  }
  
  return matches;
}

/**
 * Get field mapping for a specific field in a widget
 */
export function getFieldMapping(
  widgetType: WidgetType,
  fieldName: string
): FieldMapping | undefined {
  const mapping = getWidgetMapping(widgetType);
  if (!mapping) return undefined;
  
  return [
    ...mapping.requiredFields,
    ...mapping.optionalFields
  ].find(field => field.fieldName === fieldName);
}

