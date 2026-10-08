import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts', 
      'src/**/*.spec.ts',
      'src/**/*.integration.test.ts',
      'tools/**/*.test.ts',
      'tools/**/*.spec.ts'
    ],
    testTimeout: 60000, // 60 seconds for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/testContent/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/generated/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

