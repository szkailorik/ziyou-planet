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

  it('does not call fast but inaccurate recognition automatic', () => {
    const attempts: AttemptEvent[] = [
      { ...base, id: '2', mode: 'pronunciation-choice', result: 'correct', latencyMs: 700 },
      { ...base, id: '3', mode: 'meaning-choice', result: 'incorrect', latencyMs: 500, occurredAt: '2026-07-02T08:00:00.000Z' },
      { ...base, id: '4', mode: 'context-choice', result: 'incorrect', latencyMs: 600, occurredAt: '2026-07-03T08:00:00.000Z' }
    ];
    const progress = progressFromAttempts(attempts, new Date('2026-07-03T08:01:00.000Z')).get(1)!;
    expect(progress.objectiveAccuracy).toBeCloseTo(1 / 3, 2);
    expect(progress.automaticity).toBe('effortful');
  });

  it('requires cross-day context evidence for automatic recognition', () => {
    const sameDay: AttemptEvent[] = [
      { ...base, id: '2', mode: 'pronunciation-choice', result: 'correct', latencyMs: 1200 },
      { ...base, id: '3', mode: 'meaning-choice', result: 'correct', latencyMs: 1400, occurredAt: '2026-07-01T08:02:00.000Z' },
      { ...base, id: '4', mode: 'context-choice', result: 'correct', latencyMs: 1500, occurredAt: '2026-07-01T08:03:00.000Z' }
    ];
    expect(progressFromAttempts(sameDay, new Date('2026-07-01T08:04:00.000Z')).get(1)!.automaticity).toBe('developing');
    sameDay[2] = { ...sameDay[2], occurredAt: '2026-07-02T08:03:00.000Z' };
    expect(progressFromAttempts(sameDay, new Date('2026-07-02T08:04:00.000Z')).get(1)!.automaticity).toBe('automatic');
  });
});
