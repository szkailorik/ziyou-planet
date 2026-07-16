import { describe, expect, it } from 'vitest';
import { PRIMARY_POEMS } from './primary-poems';

describe('primary school poetry library', () => {
  it('contains the complete 75-item curriculum recommendation list', () => {
    expect(PRIMARY_POEMS).toHaveLength(75);
    expect(PRIMARY_POEMS.map((poem) => poem.id)).toEqual(Array.from({ length: 75 }, (_, index) => index + 1));
    expect(new Set(PRIMARY_POEMS.map((poem) => poem.slug)).size).toBe(75);
  });

  it('keeps learning meaning and visual research boundaries on every poem', () => {
    for (const poem of PRIMARY_POEMS) {
      expect(poem.lines.length).toBeGreaterThanOrEqual(2);
      expect(poem.interpretation.length).toBeGreaterThan(16);
      expect(poem.mood.length).toBeGreaterThan(2);
      expect(poem.historicalContext.length).toBeGreaterThan(10);
      expect(poem.visualBasis.length).toBeGreaterThan(10);
      expect(['史实较明确', '部分可考', '情境复原']).toContain(poem.evidenceLevel);
      expect(poem.image).toMatch(/^\/images\/(classics|poems)\/.+\.jpg$/);
      expect(poem.imageAlt).toContain(poem.title);
      expect(poem.authorProfile).toBeDefined();
      expect(poem.authorProfile.identity.length).toBeGreaterThan(8);
      expect(poem.authorProfile.knownFor.length).toBeGreaterThan(8);
      expect(poem.authorProfile.memoryPoint.length).toBeGreaterThan(8);
    }
  });

  it('reuses the reviewed first batch and assigns new assets to the poetry gallery', () => {
    expect(PRIMARY_POEMS.filter((poem) => poem.image.startsWith('/images/classics/'))).toHaveLength(8);
    expect(PRIMARY_POEMS.filter((poem) => poem.image.startsWith('/images/poems/'))).toHaveLength(67);
  });
});
