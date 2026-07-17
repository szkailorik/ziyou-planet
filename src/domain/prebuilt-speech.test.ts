import { describe, expect, it } from 'vitest';
import { prebuiltSpeechUrl } from './prebuilt-speech';

describe('prebuilt speech URLs', () => {
  it('uses the stable curriculum position for characters', () => {
    expect(prebuiltSpeechUrl({ kind: 'character', character: '阿' })).toBe('/audio/tts/v1/characters/1.mp3?rev=20260717a');
    expect(prebuiltSpeechUrl({ kind: 'character', character: '水' })).toMatch(/^\/audio\/tts\/v1\/characters\/\d+\.mp3\?rev=20260717a$/);
  });

  it('uses poem slugs and rejects unknown characters', () => {
    expect(prebuiltSpeechUrl({ kind: 'poem', slug: 'jing-ye-si' })).toBe('/audio/tts/v1/poems/jing-ye-si.mp3?rev=20260717a');
    expect(prebuiltSpeechUrl({ kind: 'character', character: '𠮷' })).toBeNull();
  });
});
