import { describe, expect, it } from 'vitest';
import { PRIMARY_POEMS } from '../data/primary-poems';
import { createPoetryQuestionBank, createPoetryQuizSession, POETRY_QUIZ_MODES } from './poetry-quiz';

function seededRandom(seed = 42) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('poetry choice training', () => {
  const bank = createPoetryQuestionBank(PRIMARY_POEMS);

  it('builds a broad question bank across all 75 poems and seven common question types', () => {
    expect(bank.length).toBeGreaterThan(550);
    expect(new Set(bank.map((question) => question.poemSlug)).size).toBe(75);
    expect(new Set(bank.map((question) => question.kind))).toEqual(new Set(['title', 'next-line', 'author', 'dynasty', 'glossary', 'meaning', 'pitfall']));
  });

  it('keeps every question fully choice-based with one valid answer and four unique options', () => {
    for (const question of bank) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.answer);
      expect(question.prompt.length).toBeGreaterThan(5);
      expect(question.explanation.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('creates short, diverse sessions for every training mode', () => {
    for (const mode of Object.keys(POETRY_QUIZ_MODES) as Array<keyof typeof POETRY_QUIZ_MODES>) {
      const session = createPoetryQuizSession(bank, mode, seededRandom());
      expect(session).toHaveLength(POETRY_QUIZ_MODES[mode].count);
      expect(new Set(session.map((question) => question.poemSlug)).size).toBe(session.length);
      expect(session.every((question) => POETRY_QUIZ_MODES[mode].kinds.includes(question.kind))).toBe(true);
    }
  });
});
