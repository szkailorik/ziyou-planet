import { describe, expect, it } from 'vitest';
import { IDIOMS_BY_CHAR, PRIMARY_IDIOMS } from './primary-idioms';

describe('primary idiom bank', () => {
  it('contains a substantial, duplicate-free child-friendly collection', () => {
    expect(PRIMARY_IDIOMS.length).toBeGreaterThanOrEqual(160);
    expect(new Set(PRIMARY_IDIOMS.map((item) => item.text)).size).toBe(PRIMARY_IDIOMS.length);
    expect(PRIMARY_IDIOMS.every((item) => Array.from(item.text).length === 4)).toBe(true);
    expect(PRIMARY_IDIOMS.every((item) => item.meaning.length >= 5)).toBe(true);
    expect(PRIMARY_IDIOMS.every((item) => item.example.length >= 8)).toBe(true);
  });

  it('builds associations only from characters actually in the idiom', () => {
    expect(IDIOMS_BY_CHAR.size).toBeGreaterThanOrEqual(340);
    for (const [char, idioms] of IDIOMS_BY_CHAR) {
      expect(idioms.length).toBeGreaterThan(0);
      expect(idioms.every((item) => item.text.includes(char)), `${char} must be present in every linked idiom`).toBe(true);
    }
  });

  it('keeps several relevant choices for highly productive characters', () => {
    expect(IDIOMS_BY_CHAR.get('一')?.length).toBeGreaterThanOrEqual(15);
    expect(IDIOMS_BY_CHAR.get('心')?.length).toBeGreaterThanOrEqual(8);
    expect(IDIOMS_BY_CHAR.get('学')?.length).toBeGreaterThanOrEqual(4);
  });
});
