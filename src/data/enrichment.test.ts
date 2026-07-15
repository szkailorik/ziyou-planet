import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './enrichment';

describe('character catalog', () => {
  it('keeps 3500 unique curriculum characters', () => {
    expect(CHARACTERS).toHaveLength(3500);
    expect(new Set(CHARACTERS.map((entry) => entry.char)).size).toBe(3500);
  });

  it('connects seed characters to words and sourced public-domain lines', () => {
    const mountain = CHARACTERS.find((entry) => entry.char === '山')!;
    expect(mountain.words.length).toBeGreaterThan(0);
    expect(mountain.theme).toBe('方位与自然');
    expect(mountain.classicLine).toContain('依山尽');
    expect(mountain.classicSource).toContain('登鹳雀楼');
  });
});
