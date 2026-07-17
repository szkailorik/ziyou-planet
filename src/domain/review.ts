import type { AttemptEvent, AttemptMode, CharacterEntry, CharacterProgress } from '../types';

export type ObjectiveReviewMode = Extract<AttemptMode, 'pronunciation-choice' | 'context-choice'>;

const REVIEW_PRIORITY: Record<CharacterProgress['state'], number> = {
  due: 0,
  forming: 1,
  introduced: 2,
  basic: 3,
  untested: 4,
  stable: 5
};

export function reviewCandidateIds(
  progress: Map<number, CharacterProgress>,
  entries: CharacterEntry[],
  limit = 12
) {
  const reviewedIds = new Set(entries.filter((entry) => entry.contentStatus === 'reviewed').map((entry) => entry.id));
  return [...progress.values()]
    .filter((item) => item.state !== 'stable' && reviewedIds.has(item.characterId))
    .sort((a, b) => {
      const byState = REVIEW_PRIORITY[a.state] - REVIEW_PRIORITY[b.state];
      if (byState) return byState;
      return (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '');
    })
    .slice(0, limit)
    .map((item) => item.characterId);
}

export function reviewModeFor(characterId: number, attempts: AttemptEvent[]): ObjectiveReviewMode {
  const objective = attempts.filter((attempt) => attempt.characterId === characterId && attempt.mode !== 'self-check');
  const hasPronunciation = objective.some((attempt) => attempt.mode === 'pronunciation-choice' && attempt.result === 'correct');
  const hasContext = objective.some((attempt) => (attempt.mode === 'context-choice' || attempt.mode === 'meaning-choice') && attempt.result === 'correct');

  if (!hasPronunciation) return 'pronunciation-choice';
  if (!hasContext) return 'context-choice';

  const lastMode = objective.at(-1)?.mode;
  return lastMode === 'pronunciation-choice' ? 'context-choice' : 'pronunciation-choice';
}

function stableOrder(values: string[], entry: CharacterEntry) {
  return values
    .map((value) => ({
      value,
      sort: value === entry.char || value === entry.pinyin
        ? entry.id % 4
        : (entry.id + (value.codePointAt(0) ?? 0)) % 11
    }))
    .sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value, 'zh-CN'))
    .map((item) => item.value);
}

export function makePinyinChoices(entries: CharacterEntry[], entry: CharacterEntry) {
  const index = entries.indexOf(entry);
  const candidates = [entry.pinyin];
  for (let offset = 1; candidates.length < 4 && offset < entries.length; offset += 1) {
    const value = entries[(index + offset * 7) % entries.length].pinyin;
    if (!candidates.includes(value)) candidates.push(value);
  }
  return stableOrder(candidates, entry);
}

export function makeContextChoices(entries: CharacterEntry[], entry: CharacterEntry) {
  const knownCharacters = new Set(entries.map((item) => item.char));
  const candidates = [entry.char, ...entry.confusables.filter((char) => knownCharacters.has(char) && char !== entry.char)];
  const index = entries.indexOf(entry);

  for (let offset = 1; candidates.length < 4 && offset < entries.length; offset += 1) {
    const value = entries[(index + offset * 13) % entries.length].char;
    if (!candidates.includes(value)) candidates.push(value);
  }
  return stableOrder(candidates.slice(0, 4), entry);
}

export function makeContextPrompt(entry: CharacterEntry) {
  const prompt = entry.example.includes(entry.char)
    ? entry.example.split(entry.char).join('＿')
    : `${entry.words[0] ? entry.words[0].split(entry.char).join('＿') : '在句子里找到这个字'}。`;
  return prompt;
}
