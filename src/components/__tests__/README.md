# Component Tests

This directory contains tests for components, including both unit tests and integration tests.

## Test Types

### Unit Tests (`*.test.ts`)
- Fast, isolated tests
- Mock external dependencies
- Test component logic and data transformation
- Example: `Navbar.test.ts`

### Integration Tests (`*.integration.test.ts`)
- Build the actual site
- Verify rendered HTML output
- Check for 404s and error pages
- Validate page structure and content
- Example: `Navbar.integration.test.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests (builds site first)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Integration Test Requirements

Integration tests require the site to be built first. They will:
1. Check if `dist/` directory exists
2. If not, you'll need to run `npm run build` first
3. Parse all HTML files in the dist directory
4. Verify page content, structure, and functionality

## Writing New Tests

### Unit Test Example
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    // Test logic here
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';

describe('MyComponent Integration', () => {
  beforeAll(() => {
    // Setup - verify dist exists
  });

  it('should render correctly', () => {
    const html = readFileSync('dist/index.html', 'utf-8');
    expect(html).toContain('expected content');
  });
});
```

