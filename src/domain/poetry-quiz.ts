import type { PrimaryPoem } from '../data/primary-poems';

export type PoetryQuestionKind = 'title' | 'next-line' | 'author' | 'dynasty' | 'glossary' | 'meaning' | 'pitfall';
export type PoetryQuizMode = 'quick' | 'recitation' | 'understanding' | 'challenge';

export type PoetryQuestion = {
  id: string;
  poemSlug: string;
  poemTitle: string;
  kind: PoetryQuestionKind;
  kindLabel: string;
  prompt: string;
  quote?: string;
  options: string[];
  answer: string;
  explanation: string;
};

export const POETRY_QUIZ_MODES: Record<PoetryQuizMode, { title: string; description: string; count: number; kinds: PoetryQuestionKind[] }> = {
  quick: { title: '10题快速练', description: '诗句、作者、词义混合抽题，约 3 分钟。', count: 10, kinds: ['title', 'next-line', 'author', 'glossary', 'meaning', 'pitfall'] },
  recitation: { title: '诗句背诵专项', description: '看上句选下句、看名句选诗名，强化积累。', count: 10, kinds: ['title', 'next-line', 'author', 'dynasty'] },
  understanding: { title: '词义理解专项', description: '重点古词、诗意和易错辨析，不做成人化过度分析。', count: 10, kinds: ['glossary', 'meaning', 'pitfall'] },
  challenge: { title: '20题综合挑战', description: '覆盖七类常见题型，完成后生成薄弱报告。', count: 20, kinds: ['title', 'next-line', 'author', 'dynasty', 'glossary', 'meaning', 'pitfall'] }
};

export const POETRY_KIND_LABELS: Record<PoetryQuestionKind, string> = {
  title: '诗名识别',
  'next-line': '诗句补全',
  author: '作者来源',
  dynasty: '朝代常识',
  glossary: '重点词义',
  meaning: '诗意理解',
  pitfall: '易错辨析'
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}

function makeOptions(answer: string, pool: string[], id: string) {
  const candidates = unique(pool).filter((item) => item !== answer);
  const offset = candidates.length ? hash(id) % candidates.length : 0;
  const distractors: string[] = [];
  for (let step = 0; step < candidates.length && distractors.length < 3; step += 1) {
    const value = candidates[(offset + step * 7) % candidates.length];
    if (!distractors.includes(value)) distractors.push(value);
  }
  const options = [answer, ...distractors];
  const shift = hash(`${id}:position`) % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
}

export function createPoetryQuestionBank(poems: PrimaryPoem[]): PoetryQuestion[] {
  const titles = poems.map((poem) => poem.title);
  const authors = unique(poems.map((poem) => poem.author));
  const dynasties = unique(poems.map((poem) => poem.dynasty));
  const lines = poems.flatMap((poem) => poem.lines);
  const meanings = poems.map((poem) => poem.interpretation);
  const glossaryMeanings = poems.flatMap((poem) => poem.learningGuide.glossary.map((item) => item.meaning));
  const pitfalls = poems.map((poem) => poem.examPoint.pitfall);
  const questions: PoetryQuestion[] = [];

  const add = (poem: PrimaryPoem, kind: PoetryQuestionKind, idSuffix: string, prompt: string, answer: string, pool: string[], explanation: string, quote?: string) => {
    const id = `${poem.slug}:${kind}:${idSuffix}`;
    questions.push({
      id,
      poemSlug: poem.slug,
      poemTitle: poem.title,
      kind,
      kindLabel: POETRY_KIND_LABELS[kind],
      prompt,
      quote,
      options: makeOptions(answer, pool, id),
      answer,
      explanation
    });
  };

  for (const poem of poems) {
    add(poem, 'title', 'main', '这句诗出自哪一篇？', poem.title, titles, `${poem.dynasty} · ${poem.author}《${poem.title}》`, poem.lines[0]);
    add(poem, 'author', 'main', `《${poem.title}》的作者或作品来源是谁？`, poem.author, authors, `${poem.dynasty} · ${poem.author}《${poem.title}》`);
    add(poem, 'dynasty', 'main', `《${poem.title}》属于哪个朝代或时期？`, poem.dynasty, dynasties, `${poem.title}：${poem.dynasty} · ${poem.author}`);
    add(poem, 'meaning', 'main', `下面哪一项最符合《${poem.title}》的意思？`, poem.interpretation, meanings, `这首诗讲的是：${poem.interpretation}`);
    add(poem, 'pitfall', 'main', `关于《${poem.title}》，哪一项说法正确？`, poem.examPoint.pitfall, pitfalls, `易错提醒：${poem.examPoint.pitfall}`);

    poem.lines.slice(0, -1).forEach((line, index) => {
      const nextLine = poem.lines[index + 1];
      add(poem, 'next-line', String(index), '请选择正确的下一句。', nextLine, lines, `完整顺序：${line} ${nextLine}`, line);
    });

    poem.learningGuide.glossary.forEach((item, index) => {
      add(poem, 'glossary', String(index), `《${poem.title}》中“${item.term}”是什么意思？`, item.meaning, glossaryMeanings, `${item.term}：${item.meaning}`);
    });
  }

  return questions;
}

function shuffled<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createPoetryQuizSession(bank: PoetryQuestion[], mode: PoetryQuizMode, random: () => number = Math.random) {
  const config = POETRY_QUIZ_MODES[mode];
  const eligible = bank.filter((question) => config.kinds.includes(question.kind));
  const selected: PoetryQuestion[] = [];
  const poemUse = new Map<string, number>();
  for (const question of shuffled(eligible, random)) {
    if ((poemUse.get(question.poemSlug) ?? 0) >= 1 && selected.length < Math.min(config.count, PRIMARY_DIVERSITY_TARGET)) continue;
    selected.push(question);
    poemUse.set(question.poemSlug, (poemUse.get(question.poemSlug) ?? 0) + 1);
    if (selected.length === config.count) break;
  }
  if (selected.length < config.count) {
    for (const question of shuffled(eligible, random)) {
      if (selected.some((item) => item.id === question.id)) continue;
      selected.push(question);
      if (selected.length === config.count) break;
    }
  }
  return selected;
}

const PRIMARY_DIVERSITY_TARGET = 75;
