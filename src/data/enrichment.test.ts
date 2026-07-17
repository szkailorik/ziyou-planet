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
    expect(mountain.classic?.historicalContext).toContain('历史楼阁形制');
    expect(mountain.classic?.evidenceLevel).toBe('史实较明确');
    expect(mountain.classic?.image).toBe('/images/classics/deng-guan-que-lou.jpg');
  });

  it('uses child-friendly idioms as optional context rather than mastery evidence', () => {
    const one = CHARACTERS.find((entry) => entry.char === '一')!;
    expect(one.idiom?.text).toBe('一心一意');
    expect(one.idiom?.meaning).toContain('专心');
    expect(one.idiom?.example).toContain('积木');
  });

  it('keeps every objectively reviewed character inside its practice sentence', () => {
    const reviewed = CHARACTERS.filter((entry) => entry.contentStatus === 'reviewed');
    expect(reviewed.length).toBeGreaterThan(40);
    expect(reviewed.every((entry) => entry.example.includes(entry.char))).toBe(true);
  });

  it('keeps research boundaries on every classic and publishes only the reviewed image batch', () => {
    const classics = new Map(
      CHARACTERS.flatMap((entry) => entry.classic ? [[entry.classic.title, entry.classic] as const] : [])
    );

    expect(classics.size).toBe(20);
    for (const classic of classics.values()) {
      expect(classic.historicalContext.length).toBeGreaterThan(20);
      expect(classic.visualBasis.length).toBeGreaterThan(20);
      expect(['史实较明确', '部分可考', '情境复原']).toContain(classic.evidenceLevel);
    }

    const illustrated = [...classics.values()].filter((classic) => classic.image);
    expect(illustrated).toHaveLength(8);
    expect(illustrated.every((classic) => classic.image?.startsWith('/images/classics/'))).toBe(true);
    expect(illustrated.every((classic) => Boolean(classic.imageAlt))).toBe(true);
  });
});
