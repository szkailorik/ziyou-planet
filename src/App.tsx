import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CHARACTER_BY_ID, CHARACTERS } from './data/enrichment';
import { clearAllData, db, exportBackup, importBackup, loadSettings, saveSettings } from './db';
import { confidenceToResult, isDue, progressFromAttempts } from './domain/mastery';
import type { AppSettings, AttemptEvent, BackupPayload, CharacterEntry, ChildAvatar, ChildProfile, Confidence, MasteryState } from './types';

type View = 'home' | 'scan' | 'review' | 'library' | 'report';
type ScanSession = { ids: number[]; index: number; size: number; startedAt: string };
type ChildSession = { childId: string; nickname: string; dailyMinutes: 5 | 10 | 15; sound: boolean };

const STATE_LABEL: Record<MasteryState, string> = {
  untested: '未测', introduced: '初次接触', forming: '正在形成', basic: '基本掌握', stable: '稳定掌握', due: '待复习'
};

function makeAttempt(
  settings: ChildSession,
  entry: CharacterEntry,
  mode: AttemptEvent['mode'],
  result: AttemptEvent['result'],
  latencyMs: number,
  confidence?: Confidence
): AttemptEvent {
  return {
    id: crypto.randomUUID(), childId: settings.childId, characterId: entry.id, mode, result,
    confidence, latencyMs, hintUsed: false, occurredAt: new Date().toISOString(), ruleVersion: 'v1'
  };
}

function speak(text: string, enabled: boolean) {
  if (!enabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.78;
  window.speechSynthesis.speak(utterance);
}

function downloadJson(payload: BackupPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `字游星球备份-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CharacterGlyph({ entry, small = false }: { entry: CharacterEntry; small?: boolean }) {
  return (
    <div className={`glyph-frame ${small ? 'glyph-frame--small' : ''}`} aria-label={`汉字：${entry.char}`}>
      <span className="guide guide--v" />
      <span className="guide guide--h" />
      <span className="glyph">{entry.char}</span>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [attempts, setAttempts] = useState<AttemptEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), db.attempts.toArray()]).then(([storedSettings, storedAttempts]) => {
      setSettings(storedSettings);
      setAttempts(storedAttempts);
      setLoading(false);
      navigator.storage?.persist?.().catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === 'hidden') setParentUnlocked(false);
    };
    document.addEventListener('visibilitychange', lockWhenHidden);
    return () => document.removeEventListener('visibilitychange', lockWhenHidden);
  }, []);

  const activeChild = useMemo(() => settings?.children.find((child) => child.id === settings.activeChildId) ?? settings?.children[0] ?? null, [settings]);
  const childSettings = useMemo<ChildSession | null>(() => activeChild && settings ? {
    childId: activeChild.id,
    nickname: activeChild.nickname,
    dailyMinutes: activeChild.dailyMinutes,
    sound: settings.sound
  } : null, [activeChild, settings]);
  const childAttempts = useMemo(() => activeChild ? attempts.filter((item) => item.childId === activeChild.id) : [], [attempts, activeChild]);
  const progress = useMemo(() => progressFromAttempts(childAttempts), [childAttempts]);
  const stats = useMemo(() => {
    const values = [...progress.values()];
    const latestSelfCheck = new Map<number, AttemptEvent>();
    childAttempts.filter((item) => item.mode === 'self-check').forEach((item) => {
      const current = latestSelfCheck.get(item.characterId);
      if (!current || current.occurredAt < item.occurredAt) latestSelfCheck.set(item.characterId, item);
    });
    const currentSelfChecks = [...latestSelfCheck.values()];
    return {
      scanned: values.length,
      stable: values.filter((item) => item.state === 'stable').length,
      basic: values.filter((item) => item.state === 'basic').length,
      due: values.filter((item) => isDue(item)).length,
      sure: currentSelfChecks.filter((item) => item.confidence === 'sure').length,
      unsure: currentSelfChecks.filter((item) => item.confidence === 'unsure').length,
      teach: currentSelfChecks.filter((item) => item.confidence === 'teach-me').length
    };
  }, [childAttempts, progress]);

  async function addAttempt(event: AttemptEvent) {
    await db.attempts.add(event);
    setAttempts((current) => [...current, event]);
  }

  async function switchChild(childId: string) {
    if (!settings || settings.activeChildId === childId || !settings.children.some((child) => child.id === childId)) return;
    const next = { ...settings, activeChildId: childId };
    setSettings(next);
    await saveSettings(next);
    setParentUnlocked(false);
    setFocusMode(false);
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(next: View) {
    if (next !== 'report') setParentUnlocked(false);
    setFocusMode(false);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading || !settings || !activeChild || !childSettings) {
    return <div className="loading"><div className="orbit-loader">字</div><p>正在打开字游星球…</p></div>;
  }

  return (
    <div className="app-shell">
      {!focusMode && <header className="topbar">
        <button className="brand" onClick={() => navigate('home')} aria-label="回到今天">
          <img src="/planet-mark.svg" alt="" />
          <span><strong>字游星球</strong><small>小学识字探险</small></span>
        </button>
        <ChildSwitcher settings={settings} onSwitch={(childId) => void switchChild(childId)} />
        <nav className="main-nav" aria-label="主导航">
          <NavButton active={view === 'home'} icon="☀" label="今天" onClick={() => navigate('home')} />
          <NavButton active={view === 'scan'} icon="◎" label="识字扫描" onClick={() => navigate('scan')} />
          <NavButton active={view === 'review'} icon="↻" label="复习乐园" onClick={() => navigate('review')} badge={stats.due} />
          <NavButton active={view === 'library'} icon="▦" label="我的字册" onClick={() => navigate('library')} />
        </nav>
        <button className="parent-button" onClick={() => navigate('report')}><span>◒</span> 家长中心</button>
      </header>}

      <main>
        {view === 'home' && <Home settings={childSettings} stats={stats} progress={progress} onNavigate={navigate} />}
        {view === 'scan' && <Scan settings={childSettings} attempts={childAttempts} progress={progress} addAttempt={addAttempt} onFocusChange={setFocusMode} onFinish={() => { setToast(`${activeChild.nickname} 的扫描已保存`); navigate('home'); }} />}
        {view === 'review' && <Review settings={childSettings} attempts={childAttempts} progress={progress} addAttempt={addAttempt} onFocusChange={setFocusMode} />}
        {view === 'library' && <Library progress={progress} />}
        {view === 'report' && (
          parentUnlocked
            ? <Report settings={settings} activeChild={activeChild} setSettings={async (next) => { setSettings(next); await saveSettings(next); }} attempts={childAttempts} setAttempts={setAttempts} progress={progress} stats={stats} setToast={setToast} lock={() => setParentUnlocked(false)} />
            : <ParentGate unlock={() => setParentUnlocked(true)} back={() => navigate('home')} />
        )}
      </main>

      {!focusMode && <footer className="footer"><span>3500 字课程字库 · 数据保存在这台设备</span><span>默认无广告 · 无账号 · 无 AI 对话</span></footer>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

const AVATAR_ICON: Record<ChildAvatar, string> = { rocket: '🚀', planet: '🪐', star: '⭐', book: '📖' };

function ChildSwitcher({ settings, onSwitch }: { settings: AppSettings; onSwitch: (childId: string) => void }) {
  return <div className="child-switcher" aria-label="选择学习档案">{settings.children.map((child) => <button type="button" aria-pressed={child.id === settings.activeChildId} className={child.id === settings.activeChildId ? 'child-chip child-chip--active' : 'child-chip'} key={child.id} onClick={() => onSwitch(child.id)}><span aria-hidden="true">{AVATAR_ICON[child.avatar]}</span>{child.nickname}</button>)}</div>;
}

function NavButton({ active, icon, label, onClick, badge = 0 }: { active: boolean; icon: string; label: string; onClick: () => void; badge?: number }) {
  return <button aria-current={active ? 'page' : undefined} className={active ? 'nav-button nav-button--active' : 'nav-button'} onClick={onClick}><span>{icon}</span>{label}{badge > 0 && <b>{badge}</b>}</button>;
}

function Home({ settings, stats, progress, onNavigate }: { settings: ChildSession; stats: ReturnType<typeof statsShape>; progress: ReturnType<typeof progressFromAttempts>; onNavigate: (view: View) => void }) {
  const forming = [...progress.values()].filter((item) => ['introduced', 'forming', 'due'].includes(item.state)).length;
  return (
    <div className="page home-page">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">你好，{settings.nickname} <span>✦</span></div>
          <h1>今天，完成一个<br /><em>{stats.due ? '到期复习任务' : '短短识字任务'}</em></h1>
          <p>先看字、再回想，答完才揭晓读音和生活里的线索。每一次认真回忆，都在让记忆更牢。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate(stats.scanned ? 'review' : 'scan')}>{stats.scanned ? '开始今日复习' : '开始识字扫描'} <span>→</span></button>
            <button className="text-button" onClick={() => onNavigate('scan')}>做一次快速扫描</button>
          </div>
        </div>
        <div className="planet-scene" aria-hidden="true">
          <span className="star star--1">✦</span><span className="star star--2">✦</span><span className="star star--3">✧</span>
          <div className="planet-ring" />
          <div className="planet-face"><span>字</span><i className="eye eye--l" /><i className="eye eye--r" /><i className="smile" /></div>
          <div className="float-card float-card--one">山</div><div className="float-card float-card--two">月</div>
        </div>
      </section>

      <section className="today-strip" aria-label="今日概况">
        <div><span className="stat-icon lavender">✓</span><p><strong>{stats.stable}</strong><small>稳定掌握</small></p></div>
        <div><span className="stat-icon mint">↗</span><p><strong>{forming}</strong><small>正在形成</small></p></div>
        <div><span className="stat-icon peach">↻</span><p><strong>{stats.due}</strong><small>今天待复习</small></p></div>
        <div className="strip-note"><span>真正“认识”</span><p>需要换题型、换语境、隔天还能认出。</p></div>
      </section>

      <div className="section-heading"><div><span className="eyebrow">今天的路线</span><h2>选一个短任务出发</h2></div><p>建议每天 {settings.dailyMinutes} 分钟</p></div>
      <section className="task-grid">
        <TaskCard tone="purple" icon="◎" kicker="记录当前熟悉度" title="熟悉度扫描" text="30、60 或 100 字快速查看，先记录熟悉度，再进入客观复核。" meta="约 5-12 分钟" action="开始扫描" onClick={() => onNavigate('scan')} />
        <TaskCard tone="green" icon="↻" kicker="到期优先" title="复习乐园" text={stats.due ? `有 ${stats.due} 个字到时间再见面了，听音、辨形、选读音。` : '今天没有到期字，也可以从最近见过的字里来一轮小挑战。'} meta="约 3-5 分钟" action="去复习" onClick={() => onNavigate('review')} />
        <TaskCard tone="orange" icon="▦" kicker="汉字收藏册" title="我的字册" text="按学习状态查找汉字，看看读音、词语和已经留下的证据。" meta={`${stats.scanned} 字已有记录`} action="打开字册" onClick={() => onNavigate('library')} />
      </section>

      <section className="route-card">
        <div className="route-title"><div><span className="eyebrow">识字地图</span><h2>从常用部件到阅读通行证</h2></div><button className="text-button" onClick={() => onNavigate('library')}>查看完整字库 →</button></div>
        <div className="route-line">
          <RouteStop current={stats.stable < 300} done={stats.stable >= 300} number="01" title="星光起点" detail="先让基础字变稳定" />
          <RouteStop current={stats.stable >= 300 && stats.stable < 1600} done={stats.stable >= 1600} number="02" title="日常小镇" detail="在生活词语里认字" />
          <RouteStop current={stats.stable >= 1600 && stats.stable < 2500} done={stats.stable >= 2500} number="03" title="阅读森林" detail="在新语境里再认出" />
          <RouteStop current={stats.stable >= 2500} done={stats.stable >= 3000} number="04" title="故事宇宙" detail="读懂更完整的故事" />
        </div>
        <p className="source-note">地图是产品学习路线，不冒充官方逐册字表；课程目标依据 2022 年版语文课标。</p>
      </section>
    </div>
  );
}

function statsShape() { return { scanned: 0, stable: 0, basic: 0, due: 0, sure: 0, unsure: 0, teach: 0 }; }

function TaskCard({ tone, icon, kicker, title, text, meta, action, onClick }: { tone: string; icon: string; kicker: string; title: string; text: string; meta: string; action: string; onClick: () => void }) {
  return <article className={`task-card task-card--${tone}`}><div className="task-icon">{icon}</div><span className="task-kicker">{kicker}</span><h3>{title}</h3><p>{text}</p><div className="task-footer"><small>{meta}</small><button onClick={onClick}>{action} →</button></div></article>;
}

function RouteStop({ current, done, number, title, detail }: { current: boolean; done: boolean; number: string; title: string; detail: string }) {
  return <div className={`route-stop ${current ? 'route-stop--current' : ''} ${done ? 'route-stop--done' : ''}`}><span>{done ? '✓' : number}</span><strong>{title}</strong><small>{detail}</small>{current && <b>你在这里</b>}</div>;
}

function Scan({ settings, attempts, progress, addAttempt, onFinish, onFocusChange }: { settings: ChildSession; attempts: AttemptEvent[]; progress: ReturnType<typeof progressFromAttempts>; addAttempt: (event: AttemptEvent) => Promise<void>; onFinish: () => void; onFocusChange: (active: boolean) => void }) {
  const [session, setSession] = useState<ScanSession | null>(null);
  const [answer, setAnswer] = useState<Confidence | null>(null);
  const [sessionCounts, setSessionCounts] = useState({ sure: 0, unsure: 0, teach: 0 });
  const startTime = useRef(Date.now());
  const answerLock = useRef(false);

  function start(size: number) {
    const untested = CHARACTERS.filter((entry) => !progress.has(entry.id));
    const seen = CHARACTERS.filter((entry) => progress.has(entry.id));
    const pool = [...untested, ...seen].slice(0, size).map((entry) => entry.id);
    setSession({ ids: pool, index: 0, size, startedAt: new Date().toISOString() });
    setSessionCounts({ sure: 0, unsure: 0, teach: 0 });
    setAnswer(null);
    answerLock.current = false;
    onFocusChange(true);
    startTime.current = Date.now();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!session || answer) return;
      if (event.key === '1') void respond('sure');
      if (event.key === '2') void respond('unsure');
      if (event.key === '3') void respond('teach-me');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!session) {
    return <div className="page narrow-page"><PageIntro eyebrow="熟悉度扫描" title="快速看看哪些字熟、哪些字生" text="这一步只记录熟悉度，不会把一次自评直接算成“稳定掌握”。答完后会显示读音、词语和生活线索。" />
      <div className="scan-options">
        <ScanOption size={30} title="轻松体验" text="适合第一次使用，约 4-5 分钟" recommended onClick={() => start(30)} />
        <ScanOption size={60} title="多看一些" text="记录更多熟悉度，约 8 分钟" onClick={() => start(60)} />
        <ScanOption size={100} title="完整一轮" text="得到更完整的熟悉度分布，约 12 分钟" onClick={() => start(100)} />
      </div>
      <div className="explain-card"><span>为什么不一次测完 3000 字？</span><p>长时间机械扫描会疲劳，也容易把“看着眼熟”误当成真正会读。更可靠的识字量需要分层抽样、客观题和隔日复测；首版先把快速扫描与最终结论明确分开。</p></div>
      {attempts.length > 0 && <button className="secondary-button centered" onClick={() => start(30)}>继续扫描尚未见过的字</button>}
    </div>;
  }

  if (session.index >= session.ids.length) {
    return <div className="page narrow-page"><div className="completion-card"><div className="completion-orbit">✦</div><span className="eyebrow">扫描完成</span><h1>你认真看了 {session.size} 个字</h1><p>这是本次熟悉度记录。接下来，系统会把“不确定”和“请教我”的字优先放进复习。</p><div className="completion-stats"><div><strong>{sessionCounts.sure}</strong><small>我会读</small></div><div><strong>{sessionCounts.unsure}</strong><small>不确定</small></div><div><strong>{sessionCounts.teach}</strong><small>请教我</small></div></div><button className="primary-button" onClick={onFinish}>回到今天 →</button><button className="text-button" onClick={() => { onFocusChange(false); setSession(null); }}>再选一轮</button></div></div>;
  }

  const entry = CHARACTER_BY_ID.get(session.ids[session.index])!;
  const pct = Math.round((session.index / session.size) * 100);

  async function respond(confidence: Confidence) {
    if (answer || answerLock.current) return;
    answerLock.current = true;
    setAnswer(confidence);
    try {
      await addAttempt(makeAttempt(settings, entry, 'self-check', confidenceToResult(confidence), Date.now() - startTime.current, confidence));
    } catch {
      answerLock.current = false;
      setAnswer(null);
      return;
    }
    setSessionCounts((current) => ({
      ...current,
      sure: current.sure + (confidence === 'sure' ? 1 : 0),
      unsure: current.unsure + (confidence === 'unsure' ? 1 : 0),
      teach: current.teach + (confidence === 'teach-me' ? 1 : 0)
    }));
  }

  function next() {
    answerLock.current = false;
    setAnswer(null);
    setSession((current) => {
      if (!current) return current;
      if (current.index + 1 >= current.ids.length) onFocusChange(false);
      return { ...current, index: current.index + 1 };
    });
    startTime.current = Date.now();
  }

  return <div className="focus-page">
    <div className="focus-top"><button className="quiet-button" onClick={() => { onFocusChange(false); setSession(null); }}>← 暂停</button><div className="focus-progress"><span><b>{session.index + 1}</b> / {session.size}</span><div><i style={{ width: `${pct}%` }} /></div></div><span className="focus-hint">不用着急，认真想一想</span></div>
    <div className="focus-layout">
      <section className="character-stage">
        <div className="character-label"><span>{entry.theme}</span><small>课标字表{entry.curriculumList === 1 ? '一' : '二'} · 作答后进入词语和句子</small></div>
        <CharacterGlyph entry={entry} />
        <p className="prompt-line">{answer ? `记住“${entry.char}”的样子，再看看右边的线索。` : '你会读这个字吗？'}</p>
      </section>
      <aside className="focus-side">
        {!answer ? <><div className="coach-card"><span className="coach-face">◉</span><div><strong>先自己回想</strong><p>能读出来，也知道它常在哪个词里，才选“我会读”。</p></div></div><div className="confidence-buttons"><button className="confidence sure" onClick={() => void respond('sure')}><span>✓</span><div><strong>我会读</strong><small>键盘 1</small></div></button><button className="confidence unsure" onClick={() => void respond('unsure')}><span>~</span><div><strong>我不确定</strong><small>键盘 2</small></div></button><button className="confidence teach" onClick={() => void respond('teach-me')}><span>✦</span><div><strong>请教教我</strong><small>键盘 3</small></div></button></div></> : <><Feedback entry={entry} confidence={answer} settings={settings} /><div className="next-card"><span>这一字的线索已经收好</span><p>{answer === 'sure' ? '之后还会用另一种题型复核。' : '它会更早回到复习队列。'}</p><button className="primary-button" onClick={next}>{session.index + 1 === session.size ? '完成扫描' : '下一个字'} →</button></div></>}
      </aside>
    </div>
  </div>;
}

function ScanOption({ size, title, text, recommended, onClick }: { size: number; title: string; text: string; recommended?: boolean; onClick: () => void }) {
  return <button className="scan-option" onClick={onClick}>{recommended && <b>推荐第一次</b>}<strong>{size}<small>字</small></strong><span>{title}</span><p>{text}</p><i>开始 →</i></button>;
}

function ContextBridge({ entry, compact = false }: { entry: CharacterEntry; compact?: boolean }) {
  const line = entry.classicLine ?? entry.example;
  return <div className={compact ? 'context-bridge context-bridge--compact' : 'context-bridge'} aria-label="从字到词再到句"><div className="context-step"><small>字</small><strong>{entry.char}</strong></div><span aria-hidden="true">→</span><div className="context-step context-step--words"><small>词</small><p>{entry.words.length ? entry.words.map((word) => <b key={word}>{word}</b>) : <em>词语审核中</em>}</p></div><span aria-hidden="true">→</span><div className="context-step context-step--line"><small>{entry.classicLine ? '经典句' : '生活句'}</small><p>{line}</p>{entry.classicSource && <cite>{entry.classicSource}</cite>}</div></div>;
}

function Feedback({ entry, confidence, settings }: { entry: CharacterEntry; confidence: Confidence; settings: ChildSession }) {
  return <div className="feedback-panel" role="status" aria-live="polite"><div className="feedback-head"><div><span>{confidence === 'sure' ? '答得很有信心' : confidence === 'unsure' ? '认真地说“不确定”也很棒' : '现在一起认识它'}</span><h2>{entry.pinyin}</h2></div><button className="sound-button" title="使用设备自带中文语音，音色与多音字效果可能因设备而异" onClick={() => speak(entry.char, settings.sound)} aria-label={`用设备语音播放${entry.char}`}>♪ 点读</button></div><ContextBridge entry={entry} /><div className="feedback-grid"><div><small>我在哪里见过</small><p>{entry.scene}</p></div>{entry.confusables.length > 0 && <div><small>别看错了</small><p>{entry.confusables.join('、')}</p></div>}</div><p className="evidence-note">先单字回想，答后连接词和句；换题型、换语境、隔天还能认出，才会成为“稳定掌握”。</p></div>;
}

function Review({ settings, attempts, progress, addAttempt, onFocusChange }: { settings: ChildSession; attempts: AttemptEvent[]; progress: ReturnType<typeof progressFromAttempts>; addAttempt: (event: AttemptEvent) => Promise<void>; onFocusChange: (active: boolean) => void }) {
  const candidateIds = useMemo(() => {
    const ids = [...progress.values()].filter((item) => item.state !== 'stable' || isDue(item)).sort((a, b) => (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '')).map((item) => item.characterId);
    return ids.filter((id) => CHARACTER_BY_ID.get(id)?.contentStatus === 'reviewed').slice(0, 12);
  }, [progress]);
  const [active, setActive] = useState(false);
  const [queueIds, setQueueIds] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const started = useRef(Date.now());
  const reviewLock = useRef(false);

  if (!active) {
    return <div className="page narrow-page"><PageIntro eyebrow="复习乐园" title="在快要忘记时，再见一次" text="这里优先安排“不确定、请教我”和到期的字。小挑战使用客观读音选择，为掌握度增加一条新证据。" />
      <div className="review-preview"><div className="review-stack">{candidateIds.slice(0, 4).map((id, i) => <span key={id} style={{ transform: `translate(${i * 12}px, ${i * 7}px) rotate(${i * 2 - 3}deg)` }}>{CHARACTER_BY_ID.get(id)?.char}</span>)}</div><div><span className="eyebrow">今日队列</span><h2>{candidateIds.length ? `${candidateIds.length} 个字准备好了` : '还没有可复习的审核字'}</h2><p>{candidateIds.length ? '每题只选读音；答完立即反馈，不设倒计时。' : '先完成一轮熟悉度扫描；只有读音内容已审核的字才会进入客观题。'}</p><button className="primary-button" disabled={!candidateIds.length} onClick={() => { setQueueIds([...candidateIds]); setActive(true); setIndex(0); reviewLock.current = false; onFocusChange(true); started.current = Date.now(); }}>{candidateIds.length ? '开始小挑战' : '暂无任务'} →</button></div></div>
      <div className="explain-card"><span>为什么要隔一段时间再测？</span><p>刚看过答案时答对，不一定已经记住。稍微隔开，再主动从记忆里取出来，才能提供更有价值的学习证据。</p></div>
    </div>;
  }

  if (index >= queueIds.length) {
    return <div className="page narrow-page"><div className="completion-card"><div className="completion-orbit">✓</div><span className="eyebrow">复习完成</span><h1>{correctCount} / {queueIds.length} 题答对</h1><p>答错的字不会被惩罚，只会更早回来和你再见面。</p><button className="primary-button" onClick={() => { setActive(false); setQueueIds([]); setIndex(0); setChoice(null); setCorrectCount(0); onFocusChange(false); }}>回到复习乐园</button></div></div>;
  }

  const entry = CHARACTER_BY_ID.get(queueIds[index])!;
  const choices = makePinyinChoices(entry);
  const answered = choice !== null;
  const correct = choice === entry.pinyin;

  async function choose(value: string) {
    if (answered || reviewLock.current) return;
    reviewLock.current = true;
    setChoice(value);
    const isCorrect = value === entry.pinyin;
    if (isCorrect) setCorrectCount((count) => count + 1);
    try {
      await addAttempt(makeAttempt(settings, entry, 'pronunciation-choice', isCorrect ? 'correct' : 'incorrect', Date.now() - started.current));
    } catch {
      reviewLock.current = false;
      setChoice(null);
    }
  }

  function next() {
    reviewLock.current = false;
    setChoice(null);
    setIndex((current) => {
      if (current + 1 >= queueIds.length) onFocusChange(false);
      return current + 1;
    });
    started.current = Date.now();
  }

  return <div className="focus-page review-focus"><div className="focus-top"><button className="quiet-button" onClick={() => { setActive(false); setQueueIds([]); onFocusChange(false); }}>← 暂停</button><div className="focus-progress"><span><b>{index + 1}</b> / {queueIds.length}</span><div><i style={{ width: `${(index / queueIds.length) * 100}%` }} /></div></div><span className="focus-hint">选出这个字的读音</span></div><div className="quiz-card"><CharacterGlyph entry={entry} small /><div className="pinyin-choices">{choices.map((value) => <button disabled={answered} aria-label={answered && value === entry.pinyin ? `${value}，正确答案` : value} key={value} className={answered ? value === entry.pinyin ? 'choice choice--right' : value === choice ? 'choice choice--wrong' : 'choice' : 'choice'} onClick={() => void choose(value)}>{value}{answered && value === entry.pinyin ? ' ✓' : answered && value === choice ? ' ×' : ''}</button>)}</div>{answered && <div role="status" aria-live="polite" className={correct ? 'quiz-feedback quiz-feedback--right' : 'quiz-feedback'}><strong>{correct ? '答对了！' : `差一点，它读 ${entry.pinyin}`}</strong><ContextBridge entry={entry} compact /><button className="sound-button" onClick={() => speak(entry.char, settings.sound)}>♪ 再听一遍</button><button className="primary-button" onClick={next}>下一题 →</button></div>}</div></div>;
}

function makePinyinChoices(entry: CharacterEntry) {
  const index = CHARACTERS.indexOf(entry);
  const candidates = [entry.pinyin];
  for (let offset = 1; candidates.length < 4 && offset < 40; offset += 1) {
    const value = CHARACTERS[(index + offset * 7) % CHARACTERS.length].pinyin;
    if (!candidates.includes(value)) candidates.push(value);
  }
  return candidates.map((value) => ({ value, sort: value === entry.pinyin ? (entry.id % 4) : ((entry.id + value.codePointAt(0)!) % 7) })).sort((a, b) => a.sort - b.sort).map((item) => item.value);
}

function Library({ progress }: { progress: ReturnType<typeof progressFromAttempts> }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'list1' | 'list2' | 'learned'>('all');
  const [visible, setVisible] = useState(180);
  const [selected, setSelected] = useState<CharacterEntry | null>(null);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);
  const matches = useMemo(() => CHARACTERS.filter((entry) => {
    const queryMatch = !query || entry.char.includes(query) || entry.pinyin.toLowerCase().includes(query.toLowerCase()) || entry.words.some((word) => word.includes(query));
    const filterMatch = filter === 'all' || (filter === 'list1' && entry.curriculumList === 1) || (filter === 'list2' && entry.curriculumList === 2) || (filter === 'learned' && progress.has(entry.id));
    return queryMatch && filterMatch;
  }), [query, filter, progress]);
  return <div className="page library-page"><PageIntro eyebrow="我的字册" title="3500 个课程常用字，都在这里" text="前 2500 个为课标字表一，后 1000 个为字表二。产品路线和掌握状态不是官方年级字表。" />
    <div className="library-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="搜索汉字、拼音或词语提示" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(180); }} placeholder="搜索汉字、拼音或词语提示" /></label><div className="filter-pills">{([['all', '全部 3500'], ['list1', '字表一 2500'], ['list2', '字表二 1000'], ['learned', '已有记录']] as const).map(([value, label]) => <button aria-pressed={filter === value} key={value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setVisible(180); }}>{label}</button>)}</div></div>
    <div className="library-summary"><span>找到 <b>{matches.length}</b> 个字</span><span><i className="dot dot--stable" />稳定掌握 <i className="dot dot--forming" />正在形成 <i className="dot" />未测</span></div>
    <div className="character-grid">{matches.slice(0, visible).map((entry) => { const item = progress.get(entry.id); return <button type="button" onClick={() => setSelected(entry)} aria-label={`${entry.char}，${entry.pinyin}，${item ? STATE_LABEL[item.state] : '未测'}`} className={`character-tile tile--${item?.state ?? 'untested'}`} key={entry.id}><div><strong>{entry.char}</strong><span>{entry.pinyin}</span></div><small>{item ? STATE_LABEL[item.state] : `字表${entry.curriculumList === 1 ? '一' : '二'}`}</small>{entry.contentStatus === 'reviewed' && <b title="词语与场景已审核">✓</b>}</button>; })}</div>
    {visible < matches.length && <button className="secondary-button centered" onClick={() => setVisible((count) => count + 180)}>再显示 180 个</button>}
    {selected && <div className="character-dialog-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="character-dialog" role="dialog" aria-modal="true" aria-labelledby="character-dialog-title" onClick={(event) => event.stopPropagation()}><button className="dialog-close" aria-label="关闭字详情" onClick={() => setSelected(null)}>×</button><div className="dialog-glyph">{selected.char}</div><div><span className="eyebrow">{selected.theme} · 课标字表{selected.curriculumList === 1 ? '一' : '二'} · {selected.contentStatus === 'reviewed' ? '内容已审核' : '基础条目'}</span><h2 id="character-dialog-title">{selected.char} <small>{selected.pinyin}</small></h2><ContextBridge entry={selected} compact /><p><strong>生活线索：</strong>{selected.scene}</p><p><strong>学习状态：</strong>{progress.get(selected.id) ? STATE_LABEL[progress.get(selected.id)!.state] : '未测'}</p><p className="source-note">公版古诗文会注明作者与篇名；教材原句须按版本和授权另行维护。基础条目的拼音只作检索提示，不进入客观读音判分。</p></div></section></div>}
  </div>;
}

function ParentGate({ unlock, back }: { unlock: () => void; back: () => void }) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);
  return <div className="page gate-page"><div className="gate-card"><div className="gate-icon">◒</div><span className="eyebrow">家长中心</span><h1>请家长来完成一个小问题</h1><p>儿童学习时不需要看到复杂统计、设置和数据操作。</p><label>3 + 4 = <input inputMode="numeric" value={answer} onChange={(event) => { setAnswer(event.target.value); setError(false); }} autoFocus /></label>{error && <small role="alert">再算一算，是一个一位数。</small>}<button className="primary-button" onClick={() => answer.trim() === '7' ? unlock() : setError(true)}>进入家长中心</button><button className="text-button" onClick={back}>返回儿童模式</button></div></div>;
}

function Report({ settings, activeChild, setSettings, attempts, setAttempts, progress, stats, setToast, lock }: { settings: AppSettings; activeChild: ChildProfile; setSettings: (settings: AppSettings) => Promise<void>; attempts: AttemptEvent[]; setAttempts: (attempts: AttemptEvent[]) => void; progress: ReturnType<typeof progressFromAttempts>; stats: ReturnType<typeof statsShape>; setToast: (text: string) => void; lock: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueList1 = [...progress.keys()].filter((id) => (CHARACTER_BY_ID.get(id)?.curriculumList ?? 2) === 1).length;
  const objective = attempts.filter((item) => item.mode !== 'self-check');
  const objectiveCorrect = objective.filter((item) => item.result === 'correct').length;
  const reliability = objective.length >= 20 ? '正在校准' : objective.length ? '证据较少' : '仅有熟悉度扫描';

  async function updateChild(childId: string, patch: Partial<Pick<ChildProfile, 'nickname' | 'dailyMinutes' | 'avatar'>>) {
    const children = settings.children.map((child) => child.id === childId ? { ...child, ...patch } : child);
    await setSettings({ ...settings, children });
  }

  async function addChild() {
    if (settings.children.length >= 8) return setToast('本机最多建立 8 个儿童档案');
    const avatars: ChildAvatar[] = ['star', 'book', 'rocket', 'planet'];
    const child: ChildProfile = { id: crypto.randomUUID(), nickname: `孩子${settings.children.length + 1}`, avatar: avatars[settings.children.length % avatars.length], dailyMinutes: 10, createdAt: new Date().toISOString() };
    await setSettings({ ...settings, activeChildId: child.id, children: [...settings.children, child] });
    setToast('新档案已建立');
  }

  async function removeChild(childId: string) {
    if (settings.children.length <= 1) return setToast('至少保留一个儿童档案');
    const child = settings.children.find((item) => item.id === childId);
    if (!child || !window.confirm(`确定删除 ${child.nickname} 的档案和全部学习记录吗？`)) return;
    await db.attempts.where('childId').equals(childId).delete();
    const children = settings.children.filter((item) => item.id !== childId);
    await setSettings({ ...settings, activeChildId: settings.activeChildId === childId ? children[0].id : settings.activeChildId, children });
    setAttempts(await db.attempts.toArray());
    setToast(`${child.nickname} 的档案已删除`);
  }

  async function handleExport() {
    downloadJson(await exportBackup(settings));
    setToast('备份文件已生成');
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('备份文件过大');
      if (!window.confirm('恢复备份会覆盖当前全部学习记录。确定继续吗？')) return;
      const payload = JSON.parse(await file.text()) as BackupPayload;
      await importBackup(payload);
      setAttempts(await db.attempts.toArray());
      await setSettings(payload.settings);
      setToast('备份已恢复');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '无法读取备份');
    } finally {
      event.target.value = '';
    }
  }

  async function handleClear() {
    if (!window.confirm('确定删除这台设备上的全部学习记录吗？请先导出备份。')) return;
    await clearAllData();
    const fresh = await loadSettings();
    setAttempts([]);
    await setSettings(fresh);
    setToast('本地学习记录已清除');
  }

  return <div className="page report-page"><div className="report-title"><div><span className="eyebrow">家长中心 · 当前档案</span><h1>{activeChild.nickname} 的学习报告</h1><p>每个孩子的扫描、复习队列和掌握证据完全分开。</p></div><button className="quiet-button" onClick={lock}>锁定家长中心</button></div>
    <section className="report-hero"><div><span className="report-label">当前可确认的稳定掌握</span><strong>{stats.stable}<small> 字</small></strong><p>已扫描 {stats.scanned} 字 · 基本掌握 {stats.basic} 字</p></div><div className="reliability"><span>结论可靠度</span><strong>{reliability}</strong><p>{objective.length ? `已有 ${objective.length} 次客观复核，正确 ${objectiveCorrect} 次。` : '目前只有主观熟悉度记录，不能据此给出精确识字量。'}</p></div></section>
    <section className="metric-grid"><Metric icon="✓" tone="green" label="我会读（自报）" value={stats.sure} note="等待客观复核" /><Metric icon="~" tone="yellow" label="我不确定" value={stats.unsure} note="优先短期复习" /><Metric icon="✦" tone="red" label="请教教我" value={stats.teach} note="进入学习队列" /><Metric icon="↻" tone="purple" label="现在到期" value={stats.due} note="建议今天再见面" /></section>
    <div className="report-columns"><section className="panel"><div className="panel-title"><h2>课程层级覆盖</h2><span>不是同龄排名</span></div><Coverage label="课标字表一" detail={`${uniqueList1} / 2500 已有记录`} value={uniqueList1 / 2500} tone="purple" /><Coverage label="课标字表二" detail={`${stats.scanned - uniqueList1} / 1000 已有记录`} value={(stats.scanned - uniqueList1) / 1000} tone="orange" /><Coverage label="小学约 3000 字目标" detail={`${stats.stable} 字达到稳定证据`} value={stats.stable / 3000} tone="green" /><p className="source-note">“已有记录”不等于“已掌握”；稳定掌握需要客观题与跨日证据。</p></section>
      <section className="panel"><div className="panel-title"><h2>下一步建议</h2><span>确定性规则生成</span></div><div className="advice-list"><div><span>01</span><p><strong>{stats.due ? `先复习 ${stats.due} 个到期字` : '完成第一轮客观复核'}</strong><small>每次 3-5 分钟，不用一次做完。</small></p></div><div><span>02</span><p><strong>优先处理“不确定”和“请教我”</strong><small>看读音、词语，再在另一题型中主动回忆。</small></p></div><div><span>03</span><p><strong>不要只追求扫描总量</strong><small>能在新词和隔天复测中认出，才是真正变稳。</small></p></div></div></section></div>
    <section className="profiles-panel"><div className="panel-title"><div><span className="eyebrow">家庭档案</span><h2>Kai、Lorik 和其他孩子</h2></div><button className="secondary-button" onClick={() => void addChild()}>＋ 添加档案</button></div><div className="profile-editor-grid">{settings.children.map((child) => <article className={child.id === settings.activeChildId ? 'profile-editor profile-editor--active' : 'profile-editor'} key={child.id}><button className="profile-select" onClick={() => void setSettings({ ...settings, activeChildId: child.id })} aria-pressed={child.id === settings.activeChildId}><span>{AVATAR_ICON[child.avatar]}</span><strong>{child.id === settings.activeChildId ? '当前学习' : '切换到此档案'}</strong></button><label>昵称<input value={child.nickname} onChange={(event) => void updateChild(child.id, { nickname: event.target.value.slice(0, 12) || '孩子' })} /></label><label>每日时长<select value={child.dailyMinutes} onChange={(event) => void updateChild(child.id, { dailyMinutes: Number(event.target.value) as 5 | 10 | 15 })}><option value="5">5 分钟</option><option value="10">10 分钟</option><option value="15">15 分钟</option></select></label><button className="profile-delete" disabled={settings.children.length <= 1} onClick={() => void removeChild(child.id)}>删除档案</button></article>)}</div></section>
    <section className="settings-panel"><div><h2>本机设置与数据</h2><p>备份包含全部儿童档案；默认不上传学习记录，AI 不影响核心流程。</p></div><label className="switch-label"><input type="checkbox" checked={settings.sound} onChange={(event) => void setSettings({ ...settings, sound: event.target.checked })} />启用设备点读声音</label><div className="data-actions"><button onClick={() => void handleExport()}>导出全家备份</button><button onClick={() => inputRef.current?.click()}>恢复全家备份</button><button className="danger-button" onClick={() => void handleClear()}>删除全部数据</button><input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => void handleImport(event)} /></div></section>
  </div>;
}

function Metric({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: number; note: string }) {
  return <div className={`metric metric--${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></div>;
}

function Coverage({ label, detail, value, tone }: { label: string; detail: string; value: number; tone: string }) {
  const pct = Math.min(100, Math.round(value * 100));
  return <div className="coverage"><div><strong>{label}</strong><span>{detail}</span></div><div className="coverage-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i className={`coverage-${tone}`} style={{ width: `${pct}%` }} /></div><small>{pct}%</small></div>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>;
}
