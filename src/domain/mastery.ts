import type { AttemptEvent, CharacterProgress, MasteryState } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 1, 3, 7, 14, 30];

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function nextReviewIso(lastSeen: string, step: number) {
  return new Date(new Date(lastSeen).getTime() + INTERVALS[Math.min(step, INTERVALS.length - 1)] * DAY).toISOString();
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function progressFromAttempts(attempts: AttemptEvent[], now = new Date()): Map<number, CharacterProgress> {
  const grouped = new Map<number, AttemptEvent[]>();
  for (const attempt of attempts) {
    const group = grouped.get(attempt.characterId) ?? [];
    group.push(attempt);
    grouped.set(attempt.characterId, group);
  }

  const result = new Map<number, CharacterProgress>();
  for (const [characterId, events] of grouped) {
    events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    let score = 0;
    let correct = 0;
    let objectiveCorrect = 0;
    let objectiveAttempts = 0;
    let step = 0;
    const modes = new Set<string>();
    const days = new Set<string>();
    const objectiveCorrectModes = new Set<string>();
    const objectiveCorrectDays = new Set<string>();
    let contextCorrect = false;

    for (const event of events) {
      modes.add(event.mode);
      days.add(dateKey(event.occurredAt));
      if (event.mode === 'self-check') {
        if (event.confidence === 'sure') score += 0.35;
        if (event.confidence === 'unsure') score += 0.1;
        if (event.confidence === 'teach-me') score = Math.max(0, score - 0.2);
      } else if (event.result === 'correct') {
        objectiveAttempts += 1;
        score += event.hintUsed ? 0.45 : 0.8;
        correct += 1;
        objectiveCorrect += 1;
        objectiveCorrectModes.add(event.mode);
        objectiveCorrectDays.add(dateKey(event.occurredAt));
        if (event.mode === 'meaning-choice' || event.mode === 'context-choice') contextCorrect = true;
        if (!event.hintUsed && event.latencyMs <= 6000) step += 1;
      } else if (event.result === 'partial') {
        objectiveAttempts += 1;
        score += 0.2;
      } else if (event.result === 'incorrect') {
        objectiveAttempts += 1;
        score = Math.max(0, score - 0.65);
        step = 0;
      } else {
        objectiveAttempts += 1;
      }
    }

    const last = events.at(-1)!;
    const reviewStep = last.mode === 'self-check'
      ? (last.confidence === 'unsure' ? 1 : 0)
      : last.result === 'incorrect' ? 0 : step;
    const nextReviewAt = nextReviewIso(last.occurredAt, reviewStep);
    let state: MasteryState = 'introduced';
    if (score >= 1.2 && objectiveCorrect >= 2) state = 'basic';
    if (score >= 1.8 && objectiveCorrect >= 2 && objectiveCorrectModes.size >= 2 && objectiveCorrectDays.size >= 2 && contextCorrect) state = 'stable';
    if (new Date(nextReviewAt) <= now && state !== 'introduced') state = 'due';
    if (score < 0.6 && events.length > 1) state = 'forming';

    const recentCorrectLatencies = events
      .filter((event) => event.mode !== 'self-check' && event.result === 'correct' && !event.hintUsed)
      .slice(-5)
      .map((event) => event.latencyMs);
    const medianCorrectLatencyMs = recentCorrectLatencies.length ? Math.round(median(recentCorrectLatencies)) : undefined;
    const objectiveAccuracy = objectiveAttempts ? objectiveCorrect / objectiveAttempts : 0;
    let automaticity: CharacterProgress['automaticity'] = 'insufficient';
    if (objectiveAttempts >= 2 && medianCorrectLatencyMs !== undefined) {
      automaticity = objectiveAccuracy >= 0.7 && medianCorrectLatencyMs <= 6000 ? 'developing' : 'effortful';
      if (objectiveAttempts >= 3 && objectiveAccuracy >= 0.8 && medianCorrectLatencyMs <= 3000 && objectiveCorrectDays.size >= 2 && contextCorrect) automaticity = 'automatic';
    }

    result.set(characterId, {
      characterId,
      state,
      score: Math.round(score * 100) / 100,
      attempts: events.length,
      correct,
      objectiveCorrect,
      objectiveAttempts,
      objectiveAccuracy: Math.round(objectiveAccuracy * 1000) / 1000,
      medianCorrectLatencyMs,
      automaticity,
      distinctModes: modes.size,
      distinctDays: days.size,
      nextReviewAt,
      lastSeenAt: last.occurredAt
    });
  }
  return result;
}

export function isDue(progress: CharacterProgress | undefined, now = new Date()) {
  return Boolean(progress?.nextReviewAt && new Date(progress.nextReviewAt) <= now);
}

export function confidenceToResult(confidence: AttemptEvent['confidence']): AttemptEvent['result'] {
  if (confidence === 'sure') return 'partial';
  if (confidence === 'unsure') return 'partial';
  return 'incorrect';
}
