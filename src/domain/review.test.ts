import { describe, expect, it } from 'vitest';
import type { AttemptEvent, CharacterEntry, CharacterProgress } from '../types';
import { makeContextChoices, makeContextPrompt, reviewCandidateIds, reviewModeFor } from './review';

const entry = (id: number, char: string, extra: Partial<CharacterEntry> = {}): CharacterEntry => ({
  id,
  char,
  unicode: `U+${char.codePointAt(0)?.toString(16)}`,
  curriculumList: 1,
  productBand: 'seed',
  pinyin: `pin${id}`,
  words: [`${char}字`],
  example: `我认识${char}这个字。`,
  theme: '测试',
  scene: '测试场景',
  confusables: [],
  englishBridges: [],
  contentStatus: 'reviewed',
  ...extra
});

const attempt = (id: string, characterId: number, mode: AttemptEvent['mode'], result: AttemptEvent['result'] = 'correct'): AttemptEvent => ({
  id,
  childId: 'child',
  characterId,
  mode,
  result,
  latencyMs: 1000,
  hintUsed: false,
  occurredAt: `2026-07-0${id}T08:00:00.000Z`,
  ruleVersion: 'v1'
});

describe('adaptive review', () => {
  it('fills missing pronunciation evidence before context evidence', () => {
    expect(reviewModeFor(1, [])).toBe('pronunciation-choice');
    expect(reviewModeFor(1, [attempt('1', 1, 'pronunciation-choice')])).toBe('context-choice');
  });

  it('alternates modes after both evidence types have succeeded', () => {
    const attempts = [attempt('1', 1, 'pronunciation-choice'), attempt('2', 1, 'context-choice')];
    expect(reviewModeFor(1, attempts)).toBe('pronunciation-choice');
    attempts.push(attempt('3', 1, 'pronunciation-choice'));
    expect(reviewModeFor(1, attempts)).toBe('context-choice');
  });

  it('keeps practising a missing evidence type after an incorrect answer', () => {
    const attempts = [attempt('1', 1, 'pronunciation-choice'), attempt('2', 1, 'context-choice', 'incorrect')];
    expect(reviewModeFor(1, attempts)).toBe('context-choice');
  });

  it('builds four unique context choices including the answer and masks every answer occurrence', () => {
    const entries = [entry(1, '日', { example: '今天是我的生日。', confusables: ['目', '白'] }), entry(2, '目'), entry(3, '白'), entry(4, '月')];
    const choices = makeContextChoices(entries, entries[0]);
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain('日');
    expect(makeContextPrompt(entries[0])).toBe('今天是我的生＿。');
  });

  it('prioritizes due and forming reviewed items and excludes stable or unreviewed items', () => {
    const entries = [entry(1, '一'), entry(2, '二'), entry(3, '三'), entry(4, '四', { contentStatus: 'basic' })];
    const progress = new Map<number, CharacterProgress>([
      [1, { characterId: 1, state: 'basic', score: 1, attempts: 1, correct: 1, objectiveCorrect: 1, objectiveAttempts: 1, objectiveAccuracy: 1, automaticity: 'developing', distinctModes: 1, distinctDays: 1 }],
      [2, { characterId: 2, state: 'due', score: 1, attempts: 1, correct: 1, objectiveCorrect: 1, objectiveAttempts: 1, objectiveAccuracy: 1, automaticity: 'developing', distinctModes: 1, distinctDays: 1 }],
      [3, { characterId: 3, state: 'stable', score: 2, attempts: 3, correct: 2, objectiveCorrect: 2, objectiveAttempts: 2, objectiveAccuracy: 1, automaticity: 'automatic', distinctModes: 2, distinctDays: 2 }],
      [4, { characterId: 4, state: 'forming', score: 0, attempts: 2, correct: 0, objectiveCorrect: 0, objectiveAttempts: 1, objectiveAccuracy: 0, automaticity: 'effortful', distinctModes: 1, distinctDays: 1 }]
    ]);
    expect(reviewCandidateIds(progress, entries)).toEqual([2, 1]);
  });
});
