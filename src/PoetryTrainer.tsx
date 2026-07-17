import { useEffect, useMemo, useRef, useState } from 'react';
import { PRIMARY_POEMS } from './data/primary-poems';
import {
  createPoetryQuestionBank,
  createPoetryQuizSession,
  POETRY_KIND_LABELS,
  POETRY_QUIZ_MODES,
  type PoetryQuestion,
  type PoetryQuestionKind,
  type PoetryQuizMode
} from './domain/poetry-quiz';

type AnswerRecord = {
  question: PoetryQuestion;
  selected: string;
  correct: boolean;
};

export default function PoetryTrainer({ learnerName, onBack }: { learnerName: string; onBack: () => void }) {
  const bank = useMemo(() => createPoetryQuestionBank(PRIMARY_POEMS), []);
  const [screen, setScreen] = useState<'setup' | 'quiz' | 'result'>('setup');
  const [mode, setMode] = useState<PoetryQuizMode>('quick');
  const [questions, setQuestions] = useState<PoetryQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const autoNextTimer = useRef<number | null>(null);

  function clearAutoNext() {
    if (autoNextTimer.current !== null) window.clearTimeout(autoNextTimer.current);
    autoNextTimer.current = null;
  }

  useEffect(() => clearAutoNext, []);

  function begin(nextMode: PoetryQuizMode, override?: PoetryQuestion[]) {
    clearAutoNext();
    setMode(nextMode);
    setQuestions(override?.length ? override : createPoetryQuizSession(bank, nextMode));
    setIndex(0);
    setSelected(null);
    setRecords([]);
    setScreen('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function advance() {
    clearAutoNext();
    if (index + 1 >= questions.length) {
      setScreen('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
  }

  function choose(option: string) {
    if (selected || !questions[index]) return;
    const question = questions[index];
    const correct = option === question.answer;
    setSelected(option);
    setRecords((current) => [...current, { question, selected: option, correct }]);
    if (correct) autoNextTimer.current = window.setTimeout(advance, 850);
  }

  if (screen === 'setup') {
    return <div className="page poetry-trainer-page">
      <button className="quiet-button poetry-trainer-back" onClick={onBack}>← 返回诗词馆</button>
      <section className="poetry-trainer-hero">
        <div><span className="eyebrow">75篇古诗词 · 全选择题</span><h1>{learnerName} 的<br />诗词闯关场</h1><p>不用键盘输入，点一下就作答。答对自动前进，答错马上讲清楚，练的是中国小学最常见的诗句、作者、词义和诗意考点。</p></div>
        <div className="poetry-trainer-badge" aria-hidden="true"><strong>选</strong><span>读 · 想 · 点</span></div>
      </section>
      <section className="poetry-mode-grid" aria-label="选择诗词训练模式">
        {(Object.entries(POETRY_QUIZ_MODES) as Array<[PoetryQuizMode, typeof POETRY_QUIZ_MODES[PoetryQuizMode]]>).map(([value, config], modeIndex) => <button key={value} className={`poetry-mode-card poetry-mode-card--${modeIndex + 1}`} onClick={() => begin(value)}>
          <span>{modeIndex === 0 ? '快' : modeIndex === 1 ? '背' : modeIndex === 2 ? '懂' : '综'}</span>
          <small>{config.count} 道选择题</small>
          <strong>{config.title}</strong>
          <p>{config.description}</p>
          <b>开始 →</b>
        </button>)}
      </section>
      <p className="poetry-quiz-boundary">训练结果只用于本次薄弱分析，不计入识字掌握分；不同地区题型有差异，本系统不作押题。</p>
    </div>;
  }

  if (screen === 'result') {
    const correctCount = records.filter((record) => record.correct).length;
    const wrongRecords = records.filter((record) => !record.correct);
    const score = records.length ? Math.round(correctCount / records.length * 100) : 0;
    const kindStats = records.reduce((map, record) => {
      const current = map.get(record.question.kind) ?? { correct: 0, total: 0 };
      current.total += 1;
      if (record.correct) current.correct += 1;
      map.set(record.question.kind, current);
      return map;
    }, new Map<PoetryQuestionKind, { correct: number; total: number }>());
    return <div className="page poetry-trainer-page">
      <section className="poetry-result-hero">
        <span className="eyebrow">本轮完成</span><h1>{score}<small>分</small></h1><strong>{score >= 90 ? '诗词小状元，真稳！' : score >= 70 ? '基础不错，再补几个薄弱点。' : '已经找到薄弱点，错题最有价值。'}</strong><p>{correctCount} 题答对 · {wrongRecords.length} 题需要再看</p>
      </section>
      <section className="poetry-result-grid" aria-label="诗词题型报告">
        {[...kindStats.entries()].map(([kind, stat]) => <article key={kind}><span>{POETRY_KIND_LABELS[kind]}</span><strong>{stat.correct}/{stat.total}</strong><div><i style={{ width: `${stat.correct / stat.total * 100}%` }} /></div></article>)}
      </section>
      {wrongRecords.length > 0 && <section className="poetry-wrong-list"><div><span className="eyebrow">本轮错题</span><h2>优先补这 {wrongRecords.length} 个点</h2></div>{wrongRecords.map((record) => <article key={record.question.id}><span>{record.question.kindLabel}</span><strong>《{record.question.poemTitle}》</strong><p>{record.question.explanation}</p></article>)}</section>}
      <div className="poetry-result-actions">
        {wrongRecords.length > 0 && <button className="primary-button" onClick={() => begin(mode, wrongRecords.map((record) => record.question))}>只练这轮错题 →</button>}
        <button className="secondary-button" onClick={() => begin(mode)}>同模式再来一组</button>
        <button className="text-button" onClick={() => setScreen('setup')}>换一种模式</button>
        <button className="text-button" onClick={onBack}>返回诗词馆</button>
      </div>
    </div>;
  }

  const question = questions[index];
  if (!question) return null;
  const answered = selected !== null;
  const correct = selected === question.answer;
  return <div className="poetry-quiz-screen">
    <header className="poetry-quiz-top">
      <button className="quiet-button" onClick={() => { clearAutoNext(); setScreen('setup'); }}>← 暂停</button>
      <div><span><b>{index + 1}</b> / {questions.length}</span><div><i style={{ width: `${(index + (answered ? 1 : 0)) / questions.length * 100}%` }} /></div></div>
      <small>{POETRY_QUIZ_MODES[mode].title}</small>
    </header>
    <main className="poetry-question-card">
      <span className="poetry-question-kind">{question.kindLabel}</span>
      <h1>{question.prompt}</h1>
      {question.quote && <blockquote>{question.quote}</blockquote>}
      <div className="poetry-choice-grid">{question.options.map((option, optionIndex) => <button key={option} disabled={answered} className={answered ? option === question.answer ? 'poetry-choice poetry-choice--right' : option === selected ? 'poetry-choice poetry-choice--wrong' : 'poetry-choice' : 'poetry-choice'} onClick={() => choose(option)}><span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b>{answered && option === question.answer && <i>✓</i>}{answered && option === selected && option !== question.answer && <i>×</i>}</button>)}</div>
      {answered && <section role="status" aria-live="polite" className={correct ? 'poetry-answer poetry-answer--right' : 'poetry-answer'}><span aria-hidden="true">{correct ? '✓' : '!'}</span><div><strong>{correct ? '答对了，马上进入下一题' : '这题先弄懂，再继续'}</strong><p>{question.explanation}</p></div>{!correct && <button className="primary-button" onClick={advance}>看懂了，下一题 →</button>}</section>}
    </main>
  </div>;
}
