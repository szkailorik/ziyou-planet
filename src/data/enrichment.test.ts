import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './enrichment';

describe('character catalog', () => {
  it('keeps 3500 unique curriculum characters', () => {
    expect(CHARACTERS).toHaveLength(3500);
    expect(new Set(CHARACTERS.map((entry) => entry.char)).size).toBe(3500);
  });

  it('connects seed characters to words and structured public-domain lines', () => {
    const mountain = CHARACTERS.find((entry) => entry.char === '山')!;
    expect(mountain.words.length).toBeGreaterThan(0);
    expect(mountain.theme).toBe('方位与自然');
    expect(mountain.classic?.line).toContain('依山尽');
    expect(mountain.classic?.title).toBe('登鹳雀楼');
    expect(mountain.classic?.author).toBe('王之涣');
  });

  it('uses child-friendly idioms as optional context rather than mastery evidence', () => {
    const one = CHARACTERS.find((entry) => entry.char === '一')!;
    expect(one.idiom?.text).toBe('一心一意');
    expect(one.idiom?.meaning).toContain('专心');
    expect(one.idiom?.example).toContain('积木');
  });
});
