import { describe, expect, it } from 'vitest';
import { IDIOM_EXHIBIT_BY_TEXT, PRIMARY_IDIOM_EXHIBITS } from './idiom-exhibits';
import { PRIMARY_IDIOMS } from './primary-idioms';

describe('idiom hall exhibits', () => {
  it('gives every selected idiom a complete visual exhibit', () => {
    expect(PRIMARY_IDIOM_EXHIBITS).toHaveLength(PRIMARY_IDIOMS.length);
    expect(IDIOM_EXHIBIT_BY_TEXT.size).toBe(PRIMARY_IDIOMS.length);
    PRIMARY_IDIOM_EXHIBITS.forEach((item, index) => {
      expect(item.id).toBe(index + 1);
      expect(`/images/idioms/${String(item.id).padStart(3, '0')}.webp`).toMatch(/^\/images\/idioms\/\d{3}\.webp$/);
      expect(item.originNote.length, `${item.text} needs a research boundary`).toBeGreaterThan(20);
      expect(item.visualBasis.length, `${item.text} needs a visual basis`).toBeGreaterThan(15);
    });
  });

  it('keeps verified fables separate from modern-use explanations', () => {
    for (const text of ['守株待兔', '狐假虎威', '亡羊补牢', '画蛇添足', '井底之蛙']) {
      const item = IDIOM_EXHIBIT_BY_TEXT.get(text)!;
      expect(item.originType).toBe('原典故事');
      expect(item.sourceLabel).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https:\/\//);
    }
    expect(IDIOM_EXHIBIT_BY_TEXT.get('一心一意')?.originType).toBe('现代用法');
  });

  it('supports all six browsing categories', () => {
    expect(new Set(PRIMARY_IDIOM_EXHIBITS.map((item) => item.category))).toEqual(new Set(['numbers', 'nature', 'animals', 'learning', 'character', 'action']));
  });
});
