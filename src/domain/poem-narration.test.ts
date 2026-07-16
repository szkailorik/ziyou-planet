import { describe, expect, it } from 'vitest';
import { PRIMARY_POEMS } from '../data/primary-poems';
import { poemNarrationText, selectMandarinVoice } from './poem-narration';

describe('poetry narration', () => {
  it('reads the title, attribution and full poem in order', () => {
    const poem = PRIMARY_POEMS[0];
    const text = poemNarrationText(poem);
    expect(text).toContain(`《${poem.title}》`);
    expect(text).toContain(`${poem.dynasty}，${poem.author}`);
    expect(poem.lines.every((line) => text.includes(line))).toBe(true);
  });

  it('prefers a named mainland Mandarin voice over generic Chinese voices', () => {
    const voices = [
      { name: 'Eddy (中文（中国大陆）)', lang: 'zh-CN', localService: true },
      { name: 'Meijia', lang: 'zh-TW', localService: true },
      { name: 'Generic Mandarin', lang: 'zh-CN', localService: true },
      { name: 'Tingting', lang: 'zh-CN', localService: true }
    ];
    expect(selectMandarinVoice(voices)?.name).toBe('Tingting');
  });
});
