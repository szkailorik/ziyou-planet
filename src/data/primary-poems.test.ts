import { describe, expect, it } from 'vitest';
import { PRIMARY_POEM_SPEECH } from './primary-poem-speech';
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
      expect(poem.learningGuide.glossary.length).toBeGreaterThanOrEqual(2);
      expect(poem.learningGuide.glossary.length).toBeLessThanOrEqual(3);
      for (const item of poem.learningGuide.glossary) {
        expect(item.term.length).toBeGreaterThan(0);
        expect(item.meaning.length).toBeGreaterThanOrEqual(3);
      }
      expect(poem.learningGuide.context.length).toBeGreaterThan(20);
      expect(poem.learningGuide.readingHint.length).toBeGreaterThan(20);
      expect(poem.examPoint.focus.length).toBeGreaterThan(20);
      expect(poem.examPoint.pitfall.length).toBeGreaterThan(12);
    }
  });

  it('gives every poem a unique child-facing understanding guide', () => {
    expect(new Set(PRIMARY_POEMS.map((poem) => poem.learningGuide)).size).toBe(75);
    expect(PRIMARY_POEMS.find((poem) => poem.slug === 'jing-ye-si')?.learningGuide.glossary.map((item) => item.term)).toContain('疑');
    expect(PRIMARY_POEMS.find((poem) => poem.slug === 'jiu-yue-jiu-ri-yi-shan-dong-xiong-di')?.learningGuide.context).toContain('不是今天的山东省');
  });

  it('covers common Chinese primary-school exam prompts without claiming a national ranking', () => {
    expect(new Set(PRIMARY_POEMS.map((poem) => poem.examPoint)).size).toBe(75);
    expect(PRIMARY_POEMS.find((poem) => poem.slug === 'lu-zhai')?.examPoint.pitfall).toContain('zhài');
    expect(PRIMARY_POEMS.find((poem) => poem.slug === 'bo-chuan-gua-zhou')?.examPoint.focus).toContain('“绿”作动词');
    expect(PRIMARY_POEMS.find((poem) => poem.slug === 'ti-lin-an-di')?.examPoint.pitfall).toContain('南宋都城');
  });

  it('reuses the reviewed first batch and assigns new assets to the poetry gallery', () => {
    expect(PRIMARY_POEMS.filter((poem) => poem.image.startsWith('/images/classics/'))).toHaveLength(8);
    expect(PRIMARY_POEMS.filter((poem) => poem.image.startsWith('/images/poems/'))).toHaveLength(67);
  });

  it('keeps the lightweight TTS manifest synchronized with the reviewed poem text', () => {
    expect(Object.keys(PRIMARY_POEM_SPEECH)).toHaveLength(PRIMARY_POEMS.length);
    for (const { slug, title, author, dynasty, lines } of PRIMARY_POEMS) {
      expect(PRIMARY_POEM_SPEECH[slug]).toEqual({ title, author, dynasty, lines });
    }
  });
});
