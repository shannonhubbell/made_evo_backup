# Contentful Query Layer Test Suite

This directory contains comprehensive tests for the Contentful query layer, including fragments, query builder, and API functions.

## Test Files

### `fragments.test.ts`
Tests for GraphQL query fragments:
- Fragment structure validation
- Field inclusion checks
- Fragment composition
- GraphQL syntax validation

### `query-builder.test.ts`
Tests for the type-safe query builder:
- Query generation correctness
- Query options handling
- Parameter passing
- Query structure validation

### `contentful.test.ts`
Integration tests for Contentful API functions:
- Function behavior with mocked API calls
- Response handling
- Error cases
- Pagination logic

### `types.test.ts`
Type safety tests:
- Generated type structure
- Response type matching
- Optional field handling
- Type inference validation

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage Goals

- **Fragments**: 100% coverage of all fragment definitions
- **Query Builder**: 100% coverage of all query functions
- **API Functions**: 80%+ coverage of all public functions
- **Type Safety**: Validation of type correctness

## Notes

- Tests use Vitest for fast execution
- API calls are mocked to avoid actual Contentful requests
- Type tests verify TypeScript type safety at compile time
- Integration tests verify runtime behavior

