# Figma API Integration Notes

## Official Documentation
- REST API: https://developers.figma.com/docs/rest-api
- Authentication: Personal Access Token or OAuth2
- Base URL: `https://api.figma.com/v1`

## Key Endpoints

### Get File
```
GET /v1/files/:file_key
Headers: X-Figma-Token: <access_token>
```

**Response Structure:**
```json
{
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "1:2",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [
          {
            "id": "2:3",
            "name": "Frame",
            "type": "FRAME",
            "layoutMode": "VERTICAL" | "HORIZONTAL" | null,
            "children": [...],
            "absoluteBoundingBox": {
              "x": 0,
              "y": 0,
              "width": 100,
              "height": 200
            },
            "fills": [...],
            "effects": [...],
            "characters": "text content" // Only for TEXT nodes
          }
        ]
      }
    ]
  },
  "components": {},
  "componentSets": {},
  "schemaVersion": 0,
  "styles": {}
}
```

### Get File Nodes
```
GET /v1/files/:file_key/nodes?ids=node1,node2
Headers: X-Figma-Token: <access_token>
```

**Response Structure:**
```json
{
  "nodes": {
    "node1": {
      "document": { /* node data */ },
      "components": {},
      "componentSets": {},
      "schemaVersion": 0,
      "styles": {}
    }
  }
}
```

### Get Images
```
GET /v1/images/:file_key?ids=node1,node2&format=png&scale=1
Headers: X-Figma-Token: <access_token>
```

**Response Structure:**
```json
{
  "images": {
    "node1": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/...",
    "node2": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/..."
  },
  "error": false
}
```

## Node Types

### Common Node Types
- `DOCUMENT` - Root document
- `CANVAS` - Page
- `FRAME` - Container/frame
- `GROUP` - Group of nodes
- `COMPONENT` - Component instance
- `INSTANCE` - Component instance
- `TEXT` - Text node
- `RECTANGLE` - Rectangle shape
- `VECTOR` - Vector shape
- `IMAGE` - Image node

### Text Nodes
- `characters` - The text content
- `style` - Text style object with:
  - `fontFamily` - Font family name
  - `fontSize` - Font size in pixels
  - `fontWeight` - Font weight (400, 700, etc.)
  - `lineHeightPx` - Line height
  - `letterSpacing` - Letter spacing
- `fills` - Array of fill objects

### Layout Properties
- `layoutMode` - `"VERTICAL"` | `"HORIZONTAL"` | `null` (for auto-layout)
- `itemSpacing` - Gap between items (for auto-layout)
- `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom` - Padding values
- `absoluteBoundingBox` - Position and size:
  - `x`, `y` - Position
  - `width`, `height` - Dimensions

### Fills
- `type` - `"SOLID"` | `"IMAGE"` | `"GRADIENT_LINEAR"` | etc.
- `color` - For SOLID fills: `{ r: 0-1, g: 0-1, b: 0-1, a: 0-1 }`
- `imageRef` - For IMAGE fills: reference to image

### Effects (Shadows, etc.)
- `type` - `"DROP_SHADOW"` | `"INNER_SHADOW"` | `"LAYER_BLUR"` | etc.
- `color` - Shadow color
- `radius` - Blur radius
- `offset` - `{ x: number, y: number }`

## Important Notes

1. **Text Content**: Only nodes with `type: "TEXT"` have `characters` property
2. **Layout Detection**: Check `layoutMode` for auto-layout (VERTICAL/HORIZONTAL)
3. **Images**: Use `/v1/images/:file_key` endpoint to get actual image URLs
4. **Recursive Structure**: Nodes have `children` array for nested structure
5. **Node IDs**: Format is typically `"pageId:nodeId"` or similar

## Rate Limits
- REST API: Check current rate limits in documentation
- Use exponential backoff for retries

## Error Responses
```json
{
  "err": "Invalid file key",
  "status": 404
}
```

