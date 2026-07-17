import { describe, expect, it } from 'vitest';
import { buildAudioCacheKey, buildQwenPayload, resolveSpeechInput } from './tts';

describe('Qwen3-TTS proxy input', () => {
  it('only accepts a single character from the curriculum catalog', () => {
    expect(resolveSpeechInput({ kind: 'character', character: '山' }).text).toBe('山');
    expect(() => resolveSpeechInput({ kind: 'character', character: '山水' })).toThrow('汉字不在课程字库中');
    expect(() => resolveSpeechInput({ kind: 'character', character: '𠀀' })).toThrow('汉字不在课程字库中');
  });

  it('resolves poem text on the server instead of trusting client-provided prose', () => {
    const speech = resolveSpeechInput({ kind: 'poem', slug: 'jing-ye-si', text: '伪造文本' });
    expect(speech.text).toContain('《静夜思》');
    expect(speech.text).toContain('唐，李白');
    expect(speech.text).not.toContain('伪造文本');
  });

  it('uses the requested Qwen3-TTS instruct model with fixed Mandarin controls', () => {
    const payload = buildQwenPayload(resolveSpeechInput({ kind: 'character', character: '水' }));
    expect(payload.model).toBe('qwen3-tts-instruct-flash');
    expect(payload.input.voice).toBe('Cherry');
    expect(payload.input.language_type).toBe('Chinese');
    expect(payload.input.instructions).toContain('标准的普通话');
    expect(payload.input.instructions).toContain('shuǐ');
    expect(payload.input.instructions).toContain('不要读出拼音');
  });

  it('builds a stable same-origin GET key for edge audio reuse', () => {
    const speech = resolveSpeechInput({ kind: 'poem', slug: 'jing-ye-si' });
    const cacheKey = buildAudioCacheKey('https://shizi.kailorik.com/api/tts?ignored=1', speech);
    expect(cacheKey.method).toBe('GET');
    expect(cacheKey.url).toBe('https://shizi.kailorik.com/api/tts-cache/v1/poem/jing-ye-si.wav');
    const retry = resolveSpeechInput({ kind: 'character', character: '场', variant: 2 });
    expect(buildAudioCacheKey('https://shizi.kailorik.com/api/tts', retry).url).toContain('/character/191-retry2.wav');
    expect(() => resolveSpeechInput({ kind: 'character', character: '场', variant: 4 })).toThrow('语音变体不正确');
  });
});
