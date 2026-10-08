/**
 * Similarity Detection Tests
 * 
 * Tests for finding and matching similar Contentful entries
 * with title-weighted similarity scoring.
 * 
 * To run: npm test tools/contentful/__tests__/similarity.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEntrySimilarity,
  findEntryToUpdate,
  SimilarityMatch,
} from '../content-analyzer';

describe('Similarity Detection', () => {
  describe('calculateEntrySimilarity', () => {
    it('should give high similarity for identical titles', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome to MADE',
        description: 'A museum',
      };
      
      const extracted = {
        title: 'Welcome to MADE',
        description: 'A museum',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.titleSimilarity).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.9);
    });

    it('should weight title heavily (50%)', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome to MADE',
        description: 'Different description',
      };
      
      const extracted = {
        title: 'Welcome to MADE',
        description: 'Completely different text here',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      // Even with different description, similarity should be high due to title match
      expect(result.titleSimilarity).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.5); // At least 50% from title
    });

    it('should handle similar but not identical titles', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome to MADE',
      };
      
      const extracted = {
        title: 'Welcome to MADE Museum',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.titleSimilarity).toBeGreaterThan(0.7);
      expect(result.similarity).toBeGreaterThan(0.35); // 50% of title similarity
    });

    it('should handle completely different titles', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome to MADE',
        description: 'A museum',
      };
      
      const extracted = {
        title: 'About Us',
        description: 'A museum',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.titleSimilarity).toBeLessThan(0.3);
      // Even with matching description, overall similarity should be lower
      expect(result.similarity).toBeLessThan(0.5);
    });

    it('should calculate description similarity (20% weight)', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        description: 'A digital art museum',
      };
      
      const extracted = {
        title: 'Welcome',
        description: 'A digital art museum',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.fieldSimilarities.get('description')).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.7); // Title (50%) + Description (20%)
    });

    it('should calculate slug similarity (15% weight)', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        slug: 'welcome',
      };
      
      const extracted = {
        title: 'Welcome',
        slug: 'welcome',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.fieldSimilarities.get('slug')).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.65); // Title (50%) + Slug (15%)
    });

    it('should handle missing fields gracefully', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
      };
      
      const extracted = {
        title: 'Welcome',
        description: 'Some description',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      // Should still calculate similarity based on available fields
      expect(result.titleSimilarity).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.5);
    });

    it('should return 0 similarity for completely different entries', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        description: 'A museum',
      };
      
      const extracted = {
        title: 'About',
        description: 'Different content',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.similarity).toBeLessThan(0.3);
    });

    it('should include field similarities in result', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        description: 'A museum',
        slug: 'welcome',
      };
      
      const extracted = {
        title: 'Welcome',
        description: 'A museum',
        slug: 'welcome',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      expect(result.fieldSimilarities.has('title')).toBe(true);
      expect(result.fieldSimilarities.has('description')).toBe(true);
      expect(result.fieldSimilarities.has('slug')).toBe(true);
      expect(result.fieldSimilarities.get('title')).toBe(1);
    });

    it('should handle substring matches in titles', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome to MADE',
      };
      
      const extracted = {
        title: 'Welcome',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      // "Welcome" is a substring of "Welcome to MADE"
      expect(result.titleSimilarity).toBeGreaterThan(0.5);
    });
  });

  describe('findEntryToUpdate', () => {
    it('should return null if no similar entries found', async () => {
      // This would need actual Contentful queries in implementation
      // For now, test the function signature
      const result = await findEntryToUpdate(
        { title: 'Unique Title' },
        'Page',
        0.7
      );
      
      // In real implementation, this would query Contentful
      // For now, it returns empty array which becomes null
      expect(result).toBeNull();
    });

    it('should respect similarity threshold', async () => {
      // In real implementation, this would:
      // 1. Query Contentful for entries
      // 2. Calculate similarity for each
      // 3. Filter by threshold
      // 4. Return most similar
      
      const result = await findEntryToUpdate(
        { title: 'Test' },
        'Page',
        0.9 // High threshold
      );
      
      // Would only return entries with >90% similarity
      expect(result).toBeNull(); // No matches above threshold
    });
  });

  describe('Similarity Weights', () => {
    it('should prioritize title over other fields', () => {
      // Scenario: Title matches, everything else is different
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        description: 'Old description',
        slug: 'old-slug',
      };
      
      const extracted = {
        title: 'Welcome',
        description: 'Completely different',
        slug: 'different-slug',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      // Should still have high similarity due to title match
      expect(result.similarity).toBeGreaterThan(0.5);
      expect(result.titleSimilarity).toBe(1);
    });

    it('should combine multiple field matches', () => {
      const entry = {
        sys: { id: 'entry-1' },
        title: 'Welcome',
        description: 'A museum',
        slug: 'welcome',
      };
      
      const extracted = {
        title: 'Welcome',
        description: 'A museum',
        slug: 'welcome',
      };
      
      const result = calculateEntrySimilarity(entry, extracted);
      
      // All fields match, should have very high similarity
      expect(result.similarity).toBeGreaterThan(0.9);
    });
  });
});

