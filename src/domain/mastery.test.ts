import { describe, expect, it } from 'vitest';
import { progressFromAttempts } from './mastery';
import type { AttemptEvent } from '../types';

const base: AttemptEvent = {
  id: '1', childId: 'local', characterId: 1, mode: 'self-check', result: 'partial',
  confidence: 'sure', latencyMs: 900, hintUsed: false, occurredAt: '2026-07-01T08:00:00.000Z', ruleVersion: 'v1'
};

describe('mastery rules', () => {
  it('does not treat a self-reported sure answer as stable mastery', () => {
    const progress = progressFromAttempts([base], new Date('2026-07-01T08:01:00.000Z')).get(1)!;
    expect(progress.state).toBe('introduced');
    expect(progress.objectiveCorrect).toBe(0);
  });

  it('requires objective evidence, multiple modes and days for stable mastery', () => {
    const attempts: AttemptEvent[] = [
      base,
      { ...base, id: '2', mode: 'pronunciation-choice', result: 'correct', occurredAt: '2026-07-02T08:00:00.000Z' },
      { ...base, id: '3', mode: 'context-choice', result: 'correct', occurredAt: '2026-07-09T08:00:00.000Z' }
    ];
    const progress = progressFromAttempts(attempts, new Date('2026-07-09T08:01:00.000Z')).get(1)!;
    expect(progress.state).toBe('stable');
    expect(progress.distinctModes).toBe(3);
    expect(progress.distinctDays).toBe(3);
  });

  it('does not mark repeated pronunciation evidence as stable', () => {
    const attempts: AttemptEvent[] = [
      base,
      { ...base, id: '2', mode: 'pronunciation-choice', result: 'correct', occurredAt: '2026-07-02T08:00:00.000Z' },
      { ...base, id: '3', mode: 'pronunciation-choice', result: 'correct', occurredAt: '2026-07-09T08:00:00.000Z' }
    ];
    expect(progressFromAttempts(attempts, new Date('2026-07-09T08:01:00.000Z')).get(1)!.state).not.toBe('stable');
  });

  it('reduces score after an incorrect objective response', () => {
    const attempts: AttemptEvent[] = [
      base,
      { ...base, id: '2', mode: 'pronunciation-choice', result: 'correct' },
      { ...base, id: '3', mode: 'pronunciation-choice', result: 'incorrect', occurredAt: '2026-07-01T09:00:00.000Z' }
    ];
    const progress = progressFromAttempts(attempts, new Date('2026-07-01T09:01:00.000Z')).get(1)!;
    expect(progress.score).toBeLessThan(0.8);
  });
});
