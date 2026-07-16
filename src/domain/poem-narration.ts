import type { PrimaryPoem } from '../data/primary-poems';

type VoiceSummary = Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'name'>;

const PREFERRED_MANDARIN_NAMES = [
  'xiaoxiao', 'xiaoyou', 'yunxi', 'yunyang', 'tingting', 'ting-ting', 'yu-shu', 'yushu'
];
const NOVELTY_VOICE_NAMES = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'];

export function poemNarrationText(poem: PrimaryPoem) {
  return [`《${poem.title}》`, `${poem.dynasty}，${poem.author}`, ...poem.lines].join('。\n');
}

export function selectMandarinVoice<T extends VoiceSummary>(voices: T[]): T | undefined {
  const score = (voice: T) => {
    const language = voice.lang.toLowerCase().replace('_', '-');
    const name = voice.name.toLowerCase();
    let value = language === 'zh-cn' ? 100 : language.startsWith('zh') ? 50 : 0;
    const preference = PREFERRED_MANDARIN_NAMES.findIndex((candidate) => name.includes(candidate));
    if (preference >= 0) value += 30 - preference;
    if (NOVELTY_VOICE_NAMES.some((candidate) => name.includes(candidate))) value -= 40;
    if (voice.localService) value += 4;
    return value;
  };
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith('zh')).sort((left, right) => score(right) - score(left))[0];
}
