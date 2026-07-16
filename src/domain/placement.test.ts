import { describe, expect, it } from 'vitest';
import { estimateLiteracy, placementSampleIds, weaknessSampleIds } from './placement';
import type { AttemptEvent, CharacterEntry, CharacterProgress } from '../types';

function entry(id: number, list: 1 | 2): CharacterEntry {
  return { id, char: String.fromCodePoint(0x4e00 + id), unicode: '', curriculumList: list, productBand: 'core', pinyin: 'x', words: [], example: '', theme: '', scene: '', confusables: [], englishBridges: [], contentStatus: 'basic' };
}

const entries = [...Array.from({ length: 2500 }, (_, index) => entry(index + 1, 1)), ...Array.from({ length: 1000 }, (_, index) => entry(index + 2501, 2))];
const base: AttemptEvent = { id: 'a', childId: 'c', characterId: 1, mode: 'self-check', result: 'partial', confidence: 'sure', latencyMs: 1000, hintUsed: false, occurredAt: '2026-07-01T00:00:00.000Z', ruleVersion: 'v1' };

describe('placement assessment', () => {
  it('draws a deterministic stratified sample across both curriculum lists', () => {
    const ids = placementSampleIds(entries, [], 36);
    expect(ids).toHaveLength(36);
    expect(ids.filter((id) => id <= 2500)).toHaveLength(24);
    expect(ids.filter((id) => id > 2500)).toHaveLength(12);
    expect(placementSampleIds(entries, [], 36)).toEqual(ids);
  });

  it('does not repeat already sampled characters', () => {
    const first = placementSampleIds(entries, [], 36);
    const attempts = first.map((id, index) => ({ ...base, id: String(index), characterId: id }));
    const second = placementSampleIds(entries, attempts, 24);
    expect(second.some((id) => first.includes(id))).toBe(false);
  });

  it('reports a bounded range instead of a false exact total', () => {
    const ids = placementSampleIds(entries, [], 36);
    const attempts = ids.map((id, index) => ({ ...base, id: String(index), characterId: id, confidence: (index % 3 ? 'sure' : 'unsure') as AttemptEvent['confidence'] }));
    const estimate = estimateLiteracy(entries, attempts);
    expect(estimate.sampleSize).toBe(36);
    expect(estimate.lower).toBeLessThan(estimate.estimate);
    expect(estimate.upper).toBeGreaterThan(estimate.estimate);
    expect(estimate.reliability).toBe('初步范围');
  });

  it('prioritizes explicit weak responses over merely due items', () => {
    const attempts: AttemptEvent[] = [
      { ...base, id: 'due', characterId: 1 },
      { ...base, id: 'unsure', characterId: 2, confidence: 'unsure' },
      { ...base, id: 'teach', characterId: 3, confidence: 'teach-me' }
    ];
    const progress = new Map<number, CharacterProgress>([[1, { characterId: 1, state: 'due', score: 1, attempts: 1, correct: 0, objectiveCorrect: 0, objectiveAttempts: 0, objectiveAccuracy: 0, automaticity: 'insufficient', distinctModes: 1, distinctDays: 1 }]]);
    expect(weaknessSampleIds(attempts, progress, 3)).toEqual([3, 2, 1]);
  });
});
