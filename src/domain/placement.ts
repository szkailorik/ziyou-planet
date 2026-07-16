import type { AttemptEvent, CharacterEntry, CharacterProgress, Confidence } from '../types';

const LIST_ONE_SIZE = 2500;
const LIST_TWO_SIZE = 1000;
const DIAGNOSTIC_POOL_PER_LIST = { 1: 240, 2: 120 } as const;

export type LiteracyEstimate = {
  estimate: number;
  lower: number;
  upper: number;
  sampleSize: number;
  sure: number;
  reliability: '等待定位' | '初步范围' | '范围渐稳' | '较有把握';
};

function rank(id: number) {
  let value = id ^ 0x9e3779b9;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function ranked(entries: CharacterEntry[], list: 1 | 2) {
  return entries.filter((entry) => entry.curriculumList === list).sort((a, b) => rank(a.id) - rank(b.id));
}

function latestSelfChecks(attempts: AttemptEvent[]) {
  const latest = new Map<number, AttemptEvent>();
  for (const attempt of attempts) {
    if (attempt.mode !== 'self-check') continue;
    const current = latest.get(attempt.characterId);
    if (!current || current.occurredAt < attempt.occurredAt) latest.set(attempt.characterId, attempt);
  }
  return latest;
}

function interleave(listOne: number[], listTwo: number[]) {
  const result: number[] = [];
  const length = Math.max(Math.ceil(listOne.length / 2), listTwo.length);
  for (let index = 0; index < length; index += 1) {
    const first = listOne[index * 2];
    const second = listOne[index * 2 + 1];
    const third = listTwo[index];
    if (first !== undefined) result.push(first);
    if (second !== undefined) result.push(second);
    if (third !== undefined) result.push(third);
  }
  return result;
}

export function placementSampleIds(entries: CharacterEntry[], attempts: AttemptEvent[], size = 36) {
  const seen = new Set(latestSelfChecks(attempts).keys());
  const listOneTarget = Math.round(size * 2 / 3);
  const listTwoTarget = size - listOneTarget;
  const one = ranked(entries, 1).slice(0, DIAGNOSTIC_POOL_PER_LIST[1]).filter((entry) => !seen.has(entry.id)).slice(0, listOneTarget).map((entry) => entry.id);
  const two = ranked(entries, 2).slice(0, DIAGNOSTIC_POOL_PER_LIST[2]).filter((entry) => !seen.has(entry.id)).slice(0, listTwoTarget).map((entry) => entry.id);
  return interleave(one, two).slice(0, size);
}

export function coverageSampleIds(entries: CharacterEntry[], attempts: AttemptEvent[], size = 60) {
  const seen = new Set(latestSelfChecks(attempts).keys());
  const listOneTarget = Math.round(size * 5 / 7);
  const listTwoTarget = size - listOneTarget;
  const one = ranked(entries, 1).filter((entry) => !seen.has(entry.id)).slice(0, listOneTarget).map((entry) => entry.id);
  const two = ranked(entries, 2).filter((entry) => !seen.has(entry.id)).slice(0, listTwoTarget).map((entry) => entry.id);
  return interleave(one, two).slice(0, size);
}

function weaknessScore(event: AttemptEvent, progress?: CharacterProgress) {
  if (event.mode === 'self-check' && event.confidence === 'teach-me') return 0;
  if (event.mode !== 'self-check' && event.result === 'incorrect') return 1;
  if (event.mode === 'self-check' && event.confidence === 'unsure') return 2;
  if (progress?.state === 'due') return 3;
  if (progress?.state === 'forming') return 4;
  return 9;
}

export function weaknessSampleIds(attempts: AttemptEvent[], progress: Map<number, CharacterProgress>, size = 20) {
  const latest = new Map<number, AttemptEvent>();
  for (const attempt of attempts) {
    const current = latest.get(attempt.characterId);
    if (!current || current.occurredAt < attempt.occurredAt) latest.set(attempt.characterId, attempt);
  }
  return [...latest.values()]
    .map((event) => ({ event, score: weaknessScore(event, progress.get(event.characterId)) }))
    .filter((item) => item.score < 9)
    .sort((a, b) => a.score - b.score || a.event.occurredAt.localeCompare(b.event.occurredAt))
    .slice(0, size)
    .map((item) => item.event.characterId);
}

function wilson(successes: number, total: number) {
  if (!total) return { lower: 0, upper: 1, center: 0.5 };
  const z = 1.96;
  const proportion = successes / total;
  const denominator = 1 + z * z / total;
  const center = (proportion + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((proportion * (1 - proportion) + z * z / (4 * total)) / total) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), center };
}

function roundHundred(value: number, direction: 'down' | 'up' | 'near') {
  if (direction === 'down') return Math.max(0, Math.floor(value / 100) * 100);
  if (direction === 'up') return Math.min(3500, Math.ceil(value / 100) * 100);
  return Math.max(0, Math.min(3500, Math.round(value / 100) * 100));
}

export function estimateLiteracy(entries: CharacterEntry[], attempts: AttemptEvent[]): LiteracyEstimate {
  const latest = latestSelfChecks(attempts);
  const pools = {
    1: new Set(ranked(entries, 1).slice(0, DIAGNOSTIC_POOL_PER_LIST[1]).map((entry) => entry.id)),
    2: new Set(ranked(entries, 2).slice(0, DIAGNOSTIC_POOL_PER_LIST[2]).map((entry) => entry.id))
  };
  const counts = { 1: { total: 0, sure: 0 }, 2: { total: 0, sure: 0 } };
  for (const [id, attempt] of latest) {
    const list = pools[1].has(id) ? 1 : pools[2].has(id) ? 2 : undefined;
    if (!list) continue;
    counts[list].total += 1;
    if (attempt.confidence === 'sure') counts[list].sure += 1;
  }
  const one = wilson(counts[1].sure, counts[1].total);
  const two = wilson(counts[2].sure, counts[2].total);
  const lower = one.lower * LIST_ONE_SIZE + two.lower * LIST_TWO_SIZE;
  const upper = one.upper * LIST_ONE_SIZE + two.upper * LIST_TWO_SIZE;
  const estimate = one.center * LIST_ONE_SIZE + two.center * LIST_TWO_SIZE;
  const sampleSize = counts[1].total + counts[2].total;
  const reliability: LiteracyEstimate['reliability'] = sampleSize < 24 ? '等待定位' : sampleSize < 48 ? '初步范围' : sampleSize < 84 ? '范围渐稳' : '较有把握';
  return {
    estimate: roundHundred(estimate, 'near'),
    lower: roundHundred(lower, 'down'),
    upper: roundHundred(upper, 'up'),
    sampleSize,
    sure: counts[1].sure + counts[2].sure,
    reliability
  };
}

export function latestConfidence(attempts: AttemptEvent[], characterId: number): Confidence | undefined {
  return latestSelfChecks(attempts).get(characterId)?.confidence;
}
