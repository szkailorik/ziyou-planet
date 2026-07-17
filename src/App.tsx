import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CHARACTER_BY_ID, CHARACTERS } from './data/enrichment';
import { PRIMARY_POEMS, type PrimaryPoem } from './data/primary-poems';
import { clearAllData, db, exportBackup, hasParentPin, importBackup, loadSettings, loadSyncMeta, migrateSettings, replaceFromCloud, saveSettings, setParentPin, verifyParentPin } from './db';
import { confidenceToResult, progressFromAttempts } from './domain/mastery';
import { coverageSampleIds, estimateLiteracy, placementSampleIds, weaknessSampleIds } from './domain/placement';
import { makeContextChoices, makeContextPrompt, makePinyinChoices, reviewCandidateIds, reviewModeFor, type ObjectiveReviewMode } from './domain/review';
import QwenSpeechButton, { stopQwenSpeech } from './QwenSpeechButton';
import { createCloudFamily, createDeviceInvite, getCloudStatus, joinCloudFamily, leaveCloudFamily, syncCloudState, type CloudSnapshot } from './sync';
import type { AppSettings, AttemptEvent, BackupPayload, CharacterEntry, ChildAvatar, ChildProfile, Confidence, MasteryState } from './types';

type View = 'home' | 'scan' | 'review' | 'library' | 'poetry' | 'report';
type ScanKind = 'placement' | 'coverage' | 'weakness';
type ScanSession = { ids: number[]; index: number; size: number; kind: ScanKind; startedAt: string };
type ChildSession = { childId: string; nickname: string; dailyMinutes: 5 | 10 | 15; sound: boolean; englishBridge: boolean };
type CloudUiState = { status: 'checking' | 'disconnected' | 'syncing' | 'connected' | 'error'; lastSyncAt?: string; message?: string };
type CloudActions = {
  create: (pin: string) => Promise<string>;
  join: (syncCode: string, pin: string) => Promise<void>;
  syncNow: () => Promise<void>;
  leave: () => Promise<void>;
  createInvite: (pin: string) => Promise<string>;
};

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
  const [parentPinConfigured, setParentPinConfigured] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [cloud, setCloud] = useState<CloudUiState>({ status: 'checking' });
  const syncInFlight = useRef(false);
  const lastAutoSyncKey = useRef('');

  useEffect(() => {
    Promise.all([loadSettings(), db.attempts.toArray(), hasParentPin()]).then(([storedSettings, storedAttempts, pinConfigured]) => {
      setSettings(storedSettings);
      setAttempts(storedAttempts);
      setParentPinConfigured(pinConfigured);
      setLoading(false);
      navigator.storage?.persist?.().catch(() => undefined);
      getCloudStatus().then((status) => {
        setCloud(status.connected ? { status: 'connected' } : { status: 'disconnected' });
      }).catch((error) => {
        setCloud({ status: 'error', message: error instanceof Error ? error.message : '云同步状态暂时不可用' });
      });
    });
  }, []);

  useEffect(() => {
    if (loading || !settings || cloud.status !== 'connected') return;
    const key = `${JSON.stringify(settings)}|${attempts.length}|${attempts.at(-1)?.id ?? ''}`;
    if (key === lastAutoSyncKey.current) return;
    lastAutoSyncKey.current = key;
    const timer = window.setTimeout(() => void performCloudSync(settings, attempts), 1200);
    return () => window.clearTimeout(timer);
  }, [attempts, cloud.status, loading, settings]);

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
    sound: settings.sound,
    englishBridge: settings.englishBridge
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
      due: values.filter((item) => item.state === 'due').length,
      sure: currentSelfChecks.filter((item) => item.confidence === 'sure').length,
      unsure: currentSelfChecks.filter((item) => item.confidence === 'unsure').length,
      teach: currentSelfChecks.filter((item) => item.confidence === 'teach-me').length
    };
  }, [childAttempts, progress]);

  async function addAttempt(event: AttemptEvent) {
    await db.attempts.add(event);
    setAttempts((current) => [...current, event]);
  }

  async function applyCloudSnapshot(snapshot: CloudSnapshot) {
    await replaceFromCloud(snapshot.backup, snapshot.settingsUpdatedAt, snapshot.syncedAt);
    const normalizedSettings = migrateSettings(snapshot.backup.settings);
    setSettings((current) => JSON.stringify(current) === JSON.stringify(normalizedSettings) ? current : normalizedSettings);
    setAttempts((current) => {
      if (current.length === snapshot.backup.attempts.length) {
        const ids = new Set(current.map((item) => item.id));
        if (snapshot.backup.attempts.every((item) => ids.has(item.id))) return current;
      }
      return snapshot.backup.attempts;
    });
  }

  async function performCloudSync(nextSettings = settings, nextAttempts = attempts) {
    if (!nextSettings || syncInFlight.current) return;
    syncInFlight.current = true;
    setCloud((current) => ({ ...current, status: 'syncing', message: undefined }));
    try {
      const [backup, meta] = await Promise.all([exportBackup(nextSettings), loadSyncMeta()]);
      backup.attempts = nextAttempts;
      const { state } = await syncCloudState(backup, meta.settingsUpdatedAt);
      await applyCloudSnapshot(state);
      setCloud({ status: 'connected', lastSyncAt: state.syncedAt });
    } catch (error) {
      setCloud((current) => ({ status: 'error', lastSyncAt: current.lastSyncAt, message: error instanceof Error ? error.message : '云同步失败，本地记录仍已保存' }));
    } finally {
      syncInFlight.current = false;
    }
  }

  const cloudActions: CloudActions = {
    create: async (pin) => {
      if (!settings) throw new Error('本地数据尚未加载');
      setCloud({ status: 'syncing' });
      try {
        const [backup, meta] = await Promise.all([exportBackup(settings), loadSyncMeta()]);
        const result = await createCloudFamily(pin, backup, meta.settingsUpdatedAt);
        await applyCloudSnapshot(result.state);
        setCloud({ status: 'connected', lastSyncAt: result.state.syncedAt });
        return result.syncCode;
      } catch (error) {
        setCloud({ status: 'disconnected' });
        throw error;
      }
    },
    join: async (syncCode, pin) => {
      setCloud({ status: 'syncing' });
      try {
        const result = await joinCloudFamily(syncCode, pin);
        await applyCloudSnapshot(result.state);
        setCloud({ status: 'connected', lastSyncAt: result.state.syncedAt });
      } catch (error) {
        setCloud({ status: 'disconnected' });
        throw error;
      }
    },
    syncNow: async () => {
      if (!settings) throw new Error('本地数据尚未加载');
      await performCloudSync(settings, attempts);
    },
    leave: async () => {
      await leaveCloudFamily();
      setCloud({ status: 'disconnected' });
    },
    createInvite: async (pin) => (await createDeviceInvite(pin)).syncCode
  };

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
          <NavButton active={view === 'poetry'} icon="诗" label="诗词馆" onClick={() => navigate('poetry')} />
        </nav>
        <button className="parent-button" onClick={() => navigate('report')}><span>◒</span> 家长中心</button>
      </header>}

      <main>
        {view === 'home' && <Home settings={childSettings} stats={stats} progress={progress} onNavigate={navigate} />}
        {view === 'scan' && <Scan settings={childSettings} attempts={childAttempts} progress={progress} addAttempt={addAttempt} onFocusChange={setFocusMode} onFinish={() => { setToast(`${activeChild.nickname} 的扫描已保存`); navigate('home'); }} />}
        {view === 'review' && <Review settings={childSettings} attempts={childAttempts} progress={progress} addAttempt={addAttempt} onFocusChange={setFocusMode} />}
        {view === 'library' && <Library progress={progress} showEnglish={settings.englishBridge} />}
        {view === 'poetry' && <PoetryLibrary />}
        {view === 'report' && (
          parentUnlocked
            ? <Report settings={settings} activeChild={activeChild} setSettings={async (next) => { setSettings(next); await saveSettings(next); }} attempts={childAttempts} setAttempts={setAttempts} progress={progress} stats={stats} setToast={setToast} lock={() => setParentUnlocked(false)} onDataCleared={() => { setParentPinConfigured(false); setParentUnlocked(false); }} cloud={cloud} cloudActions={cloudActions} />
            : <ParentGate configured={parentPinConfigured} unlock={() => setParentUnlocked(true)} back={() => navigate('home')} setup={async (pin) => { await setParentPin(pin); setParentPinConfigured(true); setParentUnlocked(true); }} verify={verifyParentPin} />
        )}
      </main>

      {!focusMode && <footer className="footer"><span>3500 字课程字库 · 本地优先{cloud.status === 'connected' || cloud.status === 'syncing' ? '并已开启家庭云同步' : '保存'}</span><span>默认无广告 · 无 AI 对话</span></footer>}
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
  const reviewCount = reviewCandidateIds(progress, CHARACTERS).length;
  const hasReview = reviewCount > 0;
  return (
    <div className="page home-page">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">你好，{settings.nickname} <span>✦</span></div>
          <h1>今天，完成一个<br /><em>{hasReview ? '精准复习任务' : '短短识字任务'}</em></h1>
          <p>先看字、再回想，答完才揭晓读音和生活里的线索。每一次认真回忆，都在让记忆更牢。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate(hasReview ? 'review' : 'scan')}>{hasReview ? `复习 ${reviewCount} 个薄弱字` : '继续识字定位'} <span>→</span></button>
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
        <TaskCard tone="purple" icon="◎" kicker="分层抽样定位" title="识字雷达" text="跨难度抽取代表字，跳过已经会的，尽快找到真正薄弱的范围。" meta="每轮约 3-5 分钟" action="开始定位" onClick={() => onNavigate('scan')} />
        <TaskCard tone="green" icon="↻" kicker={hasReview ? '缺什么就练什么' : '等待定位结果'} title="复习乐园" text={hasReview ? `${reviewCount} 个字准备好了：先辨读音，再放进生活词句里认，补齐真正掌握所缺的证据。` : '目前没有可判分的薄弱字。先做一次识字雷达，系统会把真正值得练的字送到这里。'} meta={hasReview ? '约 3-5 分钟' : '不会进入空任务'} action={hasReview ? '去复习' : '先去定位'} onClick={() => onNavigate(hasReview ? 'review' : 'scan')} />
        <TaskCard tone="orange" icon="▦" kicker="汉字收藏册" title="我的字册" text="按学习状态查找汉字，看看读音、词语和已经留下的证据。" meta={`${stats.scanned} 字已有记录`} action="打开字册" onClick={() => onNavigate('library')} />
      </section>

      <section className="poetry-invite">
        <div><span className="poetry-invite-mark" aria-hidden="true">诗</span><p><span className="eyebrow">小学诗词馆 · 75 篇</span><strong>看一幅画，走进一句诗</strong><small>完整诗文、儿童释义、朝代背景和考据画面都在这里；自由探索，不计入识字分数。</small></p></div>
        <button className="primary-button" onClick={() => onNavigate('poetry')}>进入诗词馆 <span>→</span></button>
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

  const estimate = estimateLiteracy(CHARACTERS, attempts);
  const placementIds = placementSampleIds(CHARACTERS, attempts, estimate.sampleSize < 24 ? 36 : 24);
  const coverageIds = coverageSampleIds(CHARACTERS, attempts, 60);
  const weaknessIds = weaknessSampleIds(attempts, progress, 20);

  function start(ids: number[], kind: ScanKind) {
    if (!ids.length) return;
    setSession({ ids, index: 0, size: ids.length, kind, startedAt: new Date().toISOString() });
    setSessionCounts({ sure: 0, unsure: 0, teach: 0 });
    setAnswer(null);
    answerLock.current = false;
    onFocusChange(true);
    startTime.current = Date.now();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!session || event.repeat) return;
      if (answer) {
        if (answer !== 'sure' && !answerLock.current && event.key === 'Enter') {
          event.preventDefault();
          next();
        }
        return;
      }
      if (event.key === '1') void respond('sure');
      if (event.key === '2') void respond('unsure');
      if (event.key === '3') void respond('teach-me');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!session) {
    return <div className="page narrow-page"><PageIntro eyebrow="分层识字雷达" title="跳过已经会的，快速找到薄弱区" text="系统从课标字表一、二分层抽取代表字，不再从简单字顺序往后扫；每轮只做一小批，逐步缩小识字范围。" />
      {estimate.sampleSize >= 24 && <section className="placement-summary"><div><span>当前熟悉度范围</span><strong>{estimate.lower}—{estimate.upper}<small> 字</small></strong><p>中心估计约 {estimate.estimate} 字 · {estimate.reliability}</p></div><div><span>定位样本</span><strong>{estimate.sampleSize}<small> 字</small></strong><p>再测不同位置的字，范围会继续收窄</p></div></section>}
      <div className="scan-options">
        <ScanOption size={placementIds.length} title={estimate.sampleSize < 24 ? '快速定位' : '缩小范围'} text={estimate.sampleSize < 24 ? '跨难度抽样，约 4-5 分钟' : '在不同层级追加样本，约 3 分钟'} recommended onClick={() => start(placementIds, 'placement')} />
        <ScanOption size={weaknessIds.length || 20} title="薄弱字雷达" text={weaknessIds.length ? `优先重看 ${weaknessIds.length} 个不确定、错误或到期字` : '完成定位后，这里会自动聚集真正薄弱的字'} disabled={!weaknessIds.length} onClick={() => start(weaknessIds, 'weakness')} />
        <ScanOption size={coverageIds.length} title="扩大覆盖" text="分层抽取 60 个尚未测过的字，适合识字基础较好的孩子" onClick={() => start(coverageIds, 'coverage')} />
      </div>
      <div className="explain-card"><span>什么时候需要把 3500 个字全部扫完？</span><p>一般不需要一次逐字测完。先用分层样本得到范围，再追加边界样本；训练只集中在“不确定、答错、到期”的字。只有家长需要逐字盘点时，才用“扩大覆盖”分多天完成全库。</p></div>
    </div>;
  }

  if (session.index >= session.ids.length) {
    const updatedEstimate = estimateLiteracy(CHARACTERS, attempts);
    const needsPractice = sessionCounts.unsure + sessionCounts.teach;
    return <div className="page narrow-page"><div className="completion-card"><div className="completion-orbit">✦</div><span className="eyebrow">{session.kind === 'weakness' ? '薄弱字检查完成' : '定位完成'}</span><h1>找到 {needsPractice} 个值得练的字</h1><p>{sessionCounts.sure ? `已经会读的 ${sessionCounts.sure} 个字直接跳过，不浪费练习时间。` : ''}{session.kind === 'weakness' ? '真正薄弱的字会更早进入复习。' : updatedEstimate.sampleSize >= 24 ? `当前熟悉度大约落在 ${updatedEstimate.lower}—${updatedEstimate.upper} 字；继续分层抽样会让范围更可靠。` : '再完成一轮快速定位，就能看到更可靠的识字范围。'}</p><div className="completion-stats"><div><strong>{sessionCounts.sure}</strong><small>已会 · 跳过</small></div><div><strong>{sessionCounts.unsure}</strong><small>还需确认</small></div><div><strong>{sessionCounts.teach}</strong><small>优先学习</small></div></div><button className="primary-button" onClick={() => { onFocusChange(false); setSession(null); }}>{session.kind === 'weakness' ? '查看新的薄弱队列' : '继续缩小范围'} →</button><button className="text-button" onClick={onFinish}>先回到今天</button></div></div>;
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
    answerLock.current = false;
    setSessionCounts((current) => ({
      ...current,
      sure: current.sure + (confidence === 'sure' ? 1 : 0),
      unsure: current.unsure + (confidence === 'unsure' ? 1 : 0),
      teach: current.teach + (confidence === 'teach-me' ? 1 : 0)
    }));
    if (confidence === 'sure') next();
  }

  function next() {
    if (answerLock.current) return;
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
        <div className="character-label"><span>{session.kind === 'weakness' ? '薄弱字复查' : entry.theme}</span><small>课标字表{entry.curriculumList === 1 ? '一' : '二'} · 分层定位样本</small></div>
        <CharacterGlyph entry={entry} />
        <p className="prompt-line">{answer ? `记住“${entry.char}”的样子，再看看右边的线索。` : '你会读这个字吗？'}</p>
      </section>
      <aside className="focus-side">
        {!answer ? <><div className="coach-card"><span className="coach-face">◉</span><div><strong>先自己回想</strong><p>选“我会读”会立即进入下一字；不确定时会先显示学习线索。</p></div></div><div className="confidence-buttons"><button className="confidence sure" aria-keyshortcuts="1" onClick={() => void respond('sure')}><span>✓</span><div><strong>我会读</strong><small>自动下一字 · 键盘 1</small></div></button><button className="confidence unsure" aria-keyshortcuts="2" onClick={() => void respond('unsure')}><span>~</span><div><strong>我不确定</strong><small>键盘 2</small></div></button><button className="confidence teach" aria-keyshortcuts="3" onClick={() => void respond('teach-me')}><span>✦</span><div><strong>请教教我</strong><small>键盘 3</small></div></button></div></> : <><div className="next-card next-card--scan"><div><span>线索已经收好</span><p>这个字会优先复习。</p></div><button className="primary-button" aria-keyshortcuts="Enter" onClick={next}>{session.index + 1 === session.size ? '完成扫描' : '下一个字'}（Enter）→</button></div><Feedback entry={entry} confidence={answer} settings={settings} /></>}
      </aside>
    </div>
  </div>;
}

function ScanOption({ size, title, text, recommended, disabled = false, onClick }: { size: number; title: string; text: string; recommended?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className="scan-option" disabled={disabled} onClick={onClick}>{recommended && <b>推荐</b>}<strong>{size}<small>字</small></strong><span>{title}</span><p>{text}</p><i>{disabled ? '等待定位结果' : '开始 →'}</i></button>;
}

function ContextBridge({ entry, compact = false, showEnglish = false }: { entry: CharacterEntry; compact?: boolean; showEnglish?: boolean }) {
  return <><div className={compact ? 'context-bridge context-bridge--compact' : 'context-bridge'} aria-label="从字到词再到生活句"><div className="context-step"><small>字</small><strong>{entry.char}</strong></div><span aria-hidden="true">→</span><div className="context-step context-step--words"><small>词</small><p>{entry.words.length ? entry.words.map((word) => <b key={word}>{word}</b>) : <em>词语审核中</em>}</p></div><span aria-hidden="true">→</span><div className="context-step context-step--line"><small>生活句</small><p>{entry.example}</p></div></div>
    {showEnglish && entry.englishBridges.length > 0 && <div className="english-bridge"><span>EN</span><div><small>答后语义桥 · 不参与中文评分</small><p>{entry.englishBridges.map((bridge) => <b key={`${bridge.zh}-${bridge.en}`}>{bridge.zh} <i>→</i> {bridge.en}</b>)}</p></div></div>}
    {entry.characterFamily && <div className="family-bridge"><span>字族</span><div><small>结构迁移 · 不是读音答案</small><p>{entry.characterFamily.members.map((char) => <b className={char === entry.char ? 'current' : ''} key={char}>{char}</b>)}</p><em>{entry.characterFamily.note}</em></div></div>}
    <CulturalBridge entry={entry} />
  </>;
}

function CulturalBridge({ entry }: { entry: CharacterEntry }) {
  if (!entry.idiom && !entry.classic) return null;
  const labels = [entry.idiom && '成语', entry.classic && '古诗名句'].filter(Boolean).join(' + ');
  return <details className="cultural-bridge"><summary><span>文化彩蛋</span><div><strong>{labels}</strong><small>答后选看 · 不计分、不要求背诵</small></div><i aria-hidden="true">＋</i></summary><div className="cultural-content">
    {entry.idiom && <article className="culture-item culture-item--idiom"><span>成语</span><div><h3>{entry.idiom.text}</h3><p>{entry.idiom.meaning}</p><small>怎么用：{entry.idiom.example}</small></div></article>}
    {entry.classic && <article className="culture-item culture-item--classic"><span>名句</span><div>{entry.classic.image && <figure className="classic-scene"><img src={entry.classic.image} alt={entry.classic.imageAlt ?? `${entry.classic.title}情境复原图`} loading="lazy" decoding="async" /><figcaption>原创情境复原图 · 不是历史照片或作者肖像</figcaption></figure>}<blockquote>{entry.classic.line}</blockquote><cite>{entry.classic.dynasty} · {entry.classic.author}《{entry.classic.title}》</cite><p>{entry.classic.note}</p><details className="research-note"><summary>时代与画面考据 <b>{entry.classic.evidenceLevel}</b></summary><p><strong>我们能确定：</strong>{entry.classic.historicalContext}</p><p><strong>画面怎么处理：</strong>{entry.classic.visualBasis}</p></details></div></article>}
  </div></details>;
}

function Feedback({ entry, confidence, settings }: { entry: CharacterEntry; confidence: Confidence; settings: ChildSession }) {
  return <div className="feedback-panel" role="status" aria-live="polite"><div className="feedback-head"><div><span>{confidence === 'sure' ? '答得很有信心' : confidence === 'unsure' ? '认真地说“不确定”也很棒' : '现在一起认识它'}</span><h2>{entry.pinyin}</h2></div><QwenSpeechButton request={{ kind: 'character', character: entry.char }} enabled={settings.sound} className="sound-button" readyLabel="点读" playingLabel="停止" preparingLabel="准备中…" ariaLabel={`用阿里云 Qwen3-TTS 播放${entry.char}`} fallbackText={entry.char} fallbackRate={0.78} /></div><ContextBridge entry={entry} showEnglish={settings.englishBridge} /><div className="feedback-grid"><div><small>我在哪里见过</small><p>{entry.scene}</p></div>{entry.confusables.length > 0 && <div><small>别看错了</small><p>{entry.confusables.join('、')}</p></div>}</div><p className="evidence-note">先单字回想，答后连接词和句；换题型、换语境、隔天还能认出，才会成为“稳定掌握”。</p></div>;
}

function Review({ settings, attempts, progress, addAttempt, onFocusChange }: { settings: ChildSession; attempts: AttemptEvent[]; progress: ReturnType<typeof progressFromAttempts>; addAttempt: (event: AttemptEvent) => Promise<void>; onFocusChange: (active: boolean) => void }) {
  const candidateIds = useMemo(() => reviewCandidateIds(progress, CHARACTERS), [progress]);
  const [active, setActive] = useState(false);
  const [queueIds, setQueueIds] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [taskMode, setTaskMode] = useState<ObjectiveReviewMode>('pronunciation-choice');
  const [correctCount, setCorrectCount] = useState(0);
  const started = useRef(Date.now());
  const reviewLock = useRef(false);
  const autoNextTimer = useRef<number | null>(null);

  function clearAutoNext() {
    if (autoNextTimer.current !== null) window.clearTimeout(autoNextTimer.current);
    autoNextTimer.current = null;
  }

  useEffect(() => () => clearAutoNext(), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (choice !== null) {
        if (!reviewLock.current && event.key === 'Enter') {
          event.preventDefault();
          next();
        }
        return;
      }
      const optionIndex = Number(event.key) - 1;
      if (optionIndex < 0 || optionIndex > 3) return;
      const currentEntry = CHARACTER_BY_ID.get(queueIds[index]);
      const options = currentEntry ? (taskMode === 'context-choice' ? makeContextChoices(CHARACTERS, currentEntry) : makePinyinChoices(CHARACTERS, currentEntry)) : [];
      const option = options[optionIndex];
      if (option) void choose(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!active) {
    return <div className="page narrow-page"><PageIntro eyebrow="复习乐园" title="缺哪条证据，就练哪一种认字" text="先确认能从字形想起读音，再换到生活词句中认出；系统只安排还没真正稳定的字。" />
      <div className="review-preview"><div className="review-stack">{candidateIds.slice(0, 4).map((id, i) => <span key={id} style={{ transform: `translate(${i * 12}px, ${i * 7}px) rotate(${i * 2 - 3}deg)` }}>{CHARACTER_BY_ID.get(id)?.char}</span>)}</div><div><span className="eyebrow">今日队列</span><h2>{candidateIds.length ? `${candidateIds.length} 个字准备好了` : '还没有可复习的审核字'}</h2><p>{candidateIds.length ? '读音题和词句填空会按掌握证据自动切换；答对后自动进入下一题。' : '先完成一轮熟悉度扫描；只有词句与读音内容已审核的字才会进入客观题。'}</p><button className="primary-button" disabled={!candidateIds.length} onClick={() => { const ids = [...candidateIds]; setQueueIds(ids); setActive(true); setIndex(0); setTaskMode(reviewModeFor(ids[0], attempts)); reviewLock.current = false; onFocusChange(true); started.current = Date.now(); }}>{candidateIds.length ? '开始小挑战' : '暂无任务'} →</button></div></div>
      <div className="explain-card"><span>为什么要隔一段时间再测？</span><p>刚看过答案时答对，不一定已经记住。稍微隔开，再主动从记忆里取出来，才能提供更有价值的学习证据。</p></div>
    </div>;
  }

  if (index >= queueIds.length) {
    return <div className="page narrow-page"><div className="completion-card"><div className="completion-orbit">✓</div><span className="eyebrow">复习完成</span><h1>{correctCount} / {queueIds.length} 题答对</h1><p>答错的字不会被惩罚，只会更早回来和你再见面。</p><button className="primary-button" onClick={() => { setActive(false); setQueueIds([]); setIndex(0); setChoice(null); setCorrectCount(0); onFocusChange(false); }}>回到复习乐园</button></div></div>;
  }

  const entry = CHARACTER_BY_ID.get(queueIds[index])!;
  const choices = taskMode === 'context-choice' ? makeContextChoices(CHARACTERS, entry) : makePinyinChoices(CHARACTERS, entry);
  const correctValue = taskMode === 'context-choice' ? entry.char : entry.pinyin;
  const contextPrompt = taskMode === 'context-choice' ? makeContextPrompt(entry) : '';
  const answered = choice !== null;
  const correct = choice === correctValue;

  async function choose(value: string) {
    if (answered || reviewLock.current) return;
    reviewLock.current = true;
    setChoice(value);
    const isCorrect = value === correctValue;
    if (isCorrect) setCorrectCount((count) => count + 1);
    try {
      await addAttempt(makeAttempt(settings, entry, taskMode, isCorrect ? 'correct' : 'incorrect', Date.now() - started.current));
    } catch {
      reviewLock.current = false;
      setChoice(null);
      return;
    }
    reviewLock.current = false;
    if (isCorrect) autoNextTimer.current = window.setTimeout(next, 1250);
  }

  function next() {
    if (reviewLock.current) return;
    clearAutoNext();
    reviewLock.current = false;
    setChoice(null);
    setIndex((current) => {
      const nextIndex = current + 1;
      if (nextIndex >= queueIds.length) onFocusChange(false);
      else setTaskMode(reviewModeFor(queueIds[nextIndex], attempts));
      return nextIndex;
    });
    started.current = Date.now();
  }

    return <div className="focus-page review-focus"><div className="focus-top"><button className="quiet-button" onClick={() => { clearAutoNext(); setActive(false); setQueueIds([]); onFocusChange(false); }}>← 暂停</button><div className="focus-progress"><span><b>{index + 1}</b> / {queueIds.length}</span><div><i style={{ width: `${(index / queueIds.length) * 100}%` }} /></div></div><span className="focus-hint">{taskMode === 'context-choice' ? '把合适的字放回句子 · 键盘 1—4' : '选出这个字的读音 · 键盘 1—4'}</span></div><div className={`quiz-card ${taskMode === 'context-choice' ? 'quiz-card--context' : ''}`}>{taskMode === 'context-choice' ? <div className="context-mission" aria-label="词句小侦探：先读完整句子，再选择合适的字"><span aria-hidden="true">句</span><strong>词句小侦探</strong><p>先读完整句子，再看哪个字放进去最合适。答案会在作答后揭晓。</p></div> : <CharacterGlyph entry={entry} small />}<div className="quiz-question"><span className="quiz-question-label">{taskMode === 'context-choice' ? '哪个字放进去最合适？' : '这个字怎么读？'}</span>{taskMode === 'context-choice' && <p className="context-question"><span>{contextPrompt.split('＿').map((part, partIndex, all) => <span key={`${part}-${partIndex}`}>{part}{partIndex < all.length - 1 && <b>＿</b>}</span>)}</span></p>}<div className="pinyin-choices">{choices.map((value, optionIndex) => <button disabled={answered} aria-keyshortcuts={String(optionIndex + 1)} aria-label={answered && value === correctValue ? `${value}，正确答案` : value} key={value} className={answered ? value === correctValue ? 'choice choice--right' : value === choice ? 'choice choice--wrong' : 'choice' : 'choice'} onClick={() => void choose(value)}>{value}{answered && value === correctValue ? ' ✓' : answered && value === choice ? ' ×' : ''}</button>)}</div></div>{answered && <div role="status" aria-live="polite" className={correct ? 'quiz-feedback quiz-feedback--right' : 'quiz-feedback'}><strong>{correct ? (taskMode === 'context-choice' ? '认出来了，放回句子正合适！' : '读音认对了！') : taskMode === 'context-choice' ? `差一点，句子里应该放“${entry.char}”` : `差一点，它读 ${entry.pinyin}`}</strong><ContextBridge entry={entry} compact showEnglish={settings.englishBridge} /><QwenSpeechButton request={{ kind: 'character', character: entry.char }} enabled={settings.sound} className="sound-button" readyLabel="再听一遍" playingLabel="停止" preparingLabel="准备中…" ariaLabel={`用阿里云 Qwen3-TTS 再播放一次${entry.char}`} fallbackText={entry.char} fallbackRate={0.78} />{correct ? <small className="auto-next-note">马上自动进入下一题…</small> : <button className="primary-button" aria-keyshortcuts="Enter" onClick={next}>继续下一题（Enter）→</button>}</div>}</div></div>;
}

function Library({ progress, showEnglish }: { progress: ReturnType<typeof progressFromAttempts>; showEnglish: boolean }) {
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
    const queryMatch = !query || entry.char.includes(query) || entry.pinyin.toLowerCase().includes(query.toLowerCase()) || entry.words.some((word) => word.includes(query)) || entry.idiom?.text.includes(query) || entry.classic?.line.includes(query) || entry.classic?.title.includes(query) || entry.classic?.author.includes(query) || (showEnglish && entry.englishBridges.some((bridge) => bridge.en.toLowerCase().includes(query.toLowerCase())));
    const filterMatch = filter === 'all' || (filter === 'list1' && entry.curriculumList === 1) || (filter === 'list2' && entry.curriculumList === 2) || (filter === 'learned' && progress.has(entry.id));
    return queryMatch && filterMatch;
  }), [query, filter, progress, showEnglish]);
  return <div className="page library-page"><PageIntro eyebrow="我的字册" title="3500 个课程常用字，都在这里" text="前 2500 个为课标字表一，后 1000 个为字表二。产品路线和掌握状态不是官方年级字表。" />
    <div className="library-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="搜索汉字、拼音、词语、成语或古诗" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(180); }} placeholder="搜索汉字、拼音、词语、成语或古诗" /></label><div className="filter-pills">{([['all', '全部 3500'], ['list1', '字表一 2500'], ['list2', '字表二 1000'], ['learned', '已有记录']] as const).map(([value, label]) => <button aria-pressed={filter === value} key={value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setVisible(180); }}>{label}</button>)}</div></div>
    <div className="library-summary"><span>找到 <b>{matches.length}</b> 个字</span><span><i className="dot dot--stable" />稳定掌握 <i className="dot dot--forming" />正在形成 <i className="dot" />未测</span></div>
    <div className="character-grid">{matches.slice(0, visible).map((entry) => { const item = progress.get(entry.id); return <button type="button" onClick={() => setSelected(entry)} aria-label={`${entry.char}，${entry.pinyin}，${item ? STATE_LABEL[item.state] : '未测'}`} className={`character-tile tile--${item?.state ?? 'untested'}`} key={entry.id}><div><strong>{entry.char}</strong><span>{entry.pinyin}</span></div><small>{item ? STATE_LABEL[item.state] : `字表${entry.curriculumList === 1 ? '一' : '二'}`}</small>{entry.contentStatus === 'reviewed' && <b title="词语与场景已审核">✓</b>}</button>; })}</div>
    {visible < matches.length && <button className="secondary-button centered" onClick={() => setVisible((count) => count + 180)}>再显示 180 个</button>}
    {selected && <div className="character-dialog-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="character-dialog" role="dialog" aria-modal="true" aria-labelledby="character-dialog-title" onClick={(event) => event.stopPropagation()}><button className="dialog-close" aria-label="关闭字详情" onClick={() => setSelected(null)}>×</button><div className="dialog-glyph">{selected.char}</div><div><span className="eyebrow">{selected.theme} · 课标字表{selected.curriculumList === 1 ? '一' : '二'} · {selected.contentStatus === 'reviewed' ? '内容已审核' : '基础条目'}</span><h2 id="character-dialog-title">{selected.char} <small>{selected.pinyin}</small></h2><ContextBridge entry={selected} compact showEnglish={showEnglish} /><p><strong>生活线索：</strong>{selected.scene}</p><p><strong>学习状态：</strong>{progress.get(selected.id) ? STATE_LABEL[progress.get(selected.id)!.state] : '未测'}</p><p className="source-note">公版古诗文会注明作者与篇名；教材原句须按版本和授权另行维护。基础条目的拼音只作检索提示，不进入客观读音判分。</p></div></section></div>}
  </div>;
}

type PoetryEra = 'all' | 'early' | 'tang' | 'song' | 'late';

const POETRY_ERAS: { value: PoetryEra; label: string; match: (poem: PrimaryPoem) => boolean }[] = [
  { value: 'all', label: '全部 75', match: () => true },
  { value: 'early', label: '汉魏北朝', match: (poem) => ['汉', '北朝'].includes(poem.dynasty) },
  { value: 'tang', label: '唐', match: (poem) => poem.dynasty === '唐' },
  { value: 'song', label: '宋', match: (poem) => poem.dynasty === '宋' },
  { value: 'late', label: '元明清', match: (poem) => ['元', '明', '清'].includes(poem.dynasty) }
];

function PoetryLibrary() {
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<PoetryEra>('all');
  const [visible, setVisible] = useState(12);
  const [selected, setSelected] = useState<PrimaryPoem | null>(null);
  function stopNarration() {
    stopQwenSpeech();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  useEffect(() => () => {
    stopQwenSpeech();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { stopNarration(); setSelected(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const selectedEra = POETRY_ERAS.find((item) => item.value === era)!;
    return PRIMARY_POEMS.filter((poem) => {
      const haystack = [poem.title, poem.author, poem.dynasty, ...poem.lines, poem.interpretation, poem.mood].join(' ').toLowerCase();
      return selectedEra.match(poem) && (!normalized || haystack.includes(normalized));
    });
  }, [era, query]);
  const poemCharacters = selected ? [...new Set(selected.lines.join('').split('').filter((char) => CHARACTER_BY_ID.has(CHARACTERS.find((entry) => entry.char === char)?.id ?? -1)))].slice(0, 18) : [];

  return <div className="page poetry-page">
    <section className="poetry-hero">
      <div><span className="eyebrow">小学诗词馆</span><h1>75 篇诗词，<br />75 个可以走进去的世界</h1><p>依据义务教育语文课程标准小学阶段推荐篇目整理。画面帮助理解诗意，但不会替代朗读，也不计入识字掌握分。</p></div>
      <div className="poetry-hero-seal" aria-hidden="true"><span>诗</span><small>从画入境<br />从句识字</small></div>
    </section>
    <div className="library-toolbar poetry-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="搜索诗名、作者或诗句" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(12); }} placeholder="搜诗名、作者或一句诗" /></label><div className="filter-pills">{POETRY_ERAS.map((item) => <button aria-pressed={era === item.value} key={item.value} className={era === item.value ? 'active' : ''} onClick={() => { setEra(item.value); setVisible(12); }}>{item.label}</button>)}</div></div>
    <div className="poetry-summary"><span>找到 <b>{matches.length}</b> 篇</span><span>图片为依据诗意与时代资料创作的情境复原，不是历史照片</span></div>
    <section className="poem-grid" aria-label="小学诗词篇目">
      {matches.slice(0, visible).map((poem) => <button type="button" className="poem-card" key={poem.slug} onClick={() => setSelected(poem)}>
        <img src={poem.image} alt={poem.imageAlt} loading="lazy" decoding="async" />
        <span className="poem-evidence">{poem.evidenceLevel}</span>
        <div><small>{poem.dynasty} · {poem.author}</small><h2>{poem.title}</h2><p>{poem.lines[0]}</p><span>{poem.mood}</span></div>
      </button>)}
    </section>
    {matches.length === 0 && <div className="poetry-empty"><strong>还没有找到这首诗</strong><p>可以试试诗名、作者，或输入你记得的一句。</p></div>}
    {visible < matches.length && <button className="secondary-button centered" onClick={() => setVisible((count) => count + 12)}>再展开 12 篇</button>}
    <p className="source-note poetry-source">范围采用课程标准小学 1—6 年级推荐背诵的 75 篇古诗文；文本异文、作者归属与场景争议会在条目中保留说明。</p>
    {selected && <div className="poem-dialog-backdrop" role="presentation" onClick={() => { stopNarration(); setSelected(null); }}><article className="poem-dialog" role="dialog" aria-modal="true" aria-labelledby="poem-dialog-title" onClick={(event) => event.stopPropagation()}>
      <button className="dialog-close" aria-label="关闭诗词详情" onClick={() => { stopNarration(); setSelected(null); }}>×</button>
      <section className="poem-dialog-opening">
        <div className="poem-dialog-visual">
          <figure><img className="poem-dialog-image" src={selected.image} alt={selected.imageAlt} /><figcaption>原创诗意情境图 · {selected.evidenceLevel}</figcaption></figure>
          <section className="poem-meaning"><span aria-hidden="true">看懂</span><div><strong>这幅画和诗在说什么？</strong><p>{selected.interpretation}</p></div></section>
        </div>
        <div className="poem-dialog-copy"><span className="eyebrow">第 {selected.id} / 75 篇 · {selected.dynasty}</span><h2 id="poem-dialog-title">{selected.title}</h2><div className="poem-heading-row"><p className="poem-byline">{selected.author}</p><QwenSpeechButton key={selected.slug} request={{ kind: 'poem', slug: selected.slug }} enabled className="poem-audio-button" readyLabel="听完整朗读" playingLabel="停止朗读" preparingLabel="朗读准备中…" ariaLabel={`使用阿里云 Qwen3-TTS 朗读${selected.title}`} fallbackText={[`《${selected.title}》`, `${selected.dynasty}，${selected.author}`, ...selected.lines].join('。\n')} fallbackRate={0.84} /></div>
          <div className="poem-lines">{selected.lines.map((line) => <p key={line}>{line}</p>)}</div>
          <p className="poem-audio-note">使用阿里云 Qwen3‑TTS 自然普通话朗读；断网时自动使用设备语音，更换诗篇或关闭页面会停止。</p>
        </div>
      </section>
      <div className="poem-dialog-details">
        <section className="poem-author-card"><span aria-hidden="true">{selected.authorProfile.kind === '作者' ? '人' : '源'}</span><div><strong>{selected.authorProfile.kind === '作者' ? `认识作者 · ${selected.author}` : `认识作品来源 · ${selected.author}`}</strong><p>{selected.authorProfile.identity}</p><p>{selected.authorProfile.knownFor}</p><small>{selected.authorProfile.memoryPoint}</small></div></section>
        <dl className="poem-research"><div><dt>诗的气质</dt><dd>{selected.mood}</dd></div><div><dt>时代与考据边界</dt><dd>{selected.historicalContext}</dd></div><div><dt>画面为什么这样画</dt><dd>{selected.visualBasis}</dd></div></dl>
        <section className="poem-characters"><strong>诗中可以认一认</strong><div>{poemCharacters.map((char) => <span key={char}>{char}</span>)}</div><small>这里只做语境提示，不作为“已经认识”的证据。</small></section>
      </div>
    </article></div>}
  </div>;
}

function ParentGate({ configured, unlock, back, setup, verify }: { configured: boolean; unlock: () => void; back: () => void; setup: (pin: string) => Promise<void>; verify: (pin: string) => Promise<{ ok: boolean; lockedUntil?: string; attemptsRemaining?: number }> }) {
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState('');
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!lockedUntil || Date.parse(lockedUntil) <= Date.now()) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  const lockedSeconds = lockedUntil ? Math.max(0, Math.ceil((Date.parse(lockedUntil) - clock) / 1000)) : 0;
  async function submit() {
    setError(''); setBusy(true);
    try {
      if (pin.length !== 6) throw new Error('请输入 6 位数字 PIN');
      if (!configured) {
        if (pin !== pinAgain) throw new Error('两次 PIN 不一致');
        await setup(pin);
        return;
      }
      const result = await verify(pin);
      if (result.ok) return unlock();
      if (result.lockedUntil) {
        setLockedUntil(result.lockedUntil); setClock(Date.now());
        throw new Error('错误次数过多，家长入口已暂时锁定');
      }
      throw new Error(`PIN 不正确${result.attemptsRemaining !== undefined ? `，还可尝试 ${result.attemptsRemaining} 次` : ''}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法验证 PIN');
    } finally { setBusy(false); }
  }
  return <div className="page gate-page"><form className="gate-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}><div className="gate-icon">◒</div><span className="eyebrow">家长中心</span><h1>{configured ? '输入家长 PIN' : '先设置家长 PIN'}</h1><p>{configured ? '报告、家庭档案和数据操作只对家长开放。' : '用 6 位数字保护报告和数据操作；请避开生日、连续数字和重复数字。'}</p><label className="pin-label">{configured ? '家长 PIN' : '设置 PIN'}<input inputMode="numeric" autoComplete={configured ? 'current-password' : 'new-password'} maxLength={6} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setError(''); }} autoFocus placeholder="••••••" /></label>{!configured && <label className="pin-label">再次输入<input inputMode="numeric" autoComplete="new-password" maxLength={6} value={pinAgain} onChange={(event) => { setPinAgain(event.target.value.replace(/\D/g, '')); setError(''); }} placeholder="••••••" /></label>}{error && <small role="alert">{lockedSeconds ? `${error}（${lockedSeconds} 秒）` : error}</small>}<button type="submit" className="primary-button" disabled={busy || lockedSeconds > 0}>{busy ? '正在验证…' : configured ? '进入家长中心' : '设置并进入'}</button><button type="button" className="text-button" onClick={back}>返回儿童模式</button></form></div>;
}

function Report({ settings, activeChild, setSettings, attempts, setAttempts, progress, stats, setToast, lock, onDataCleared, cloud, cloudActions }: { settings: AppSettings; activeChild: ChildProfile; setSettings: (settings: AppSettings) => Promise<void>; attempts: AttemptEvent[]; setAttempts: (attempts: AttemptEvent[]) => void; progress: ReturnType<typeof progressFromAttempts>; stats: ReturnType<typeof statsShape>; setToast: (text: string) => void; lock: () => void; onDataCleared: () => void; cloud: CloudUiState; cloudActions: CloudActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const literacyEstimate = estimateLiteracy(CHARACTERS, attempts);
  const uniqueList1 = [...progress.keys()].filter((id) => (CHARACTER_BY_ID.get(id)?.curriculumList ?? 2) === 1).length;
  const objective = attempts.filter((item) => item.mode !== 'self-check');
  const objectiveCorrect = objective.filter((item) => item.result === 'correct').length;
  const correctLatencies = objective.filter((item) => item.result === 'correct' && !item.hintUsed).slice(-100).map((item) => item.latencyMs).sort((a, b) => a - b);
  const medianLatency = correctLatencies.length ? Math.round(correctLatencies.length % 2 ? correctLatencies[Math.floor(correctLatencies.length / 2)] : (correctLatencies[correctLatencies.length / 2 - 1] + correctLatencies[correctLatencies.length / 2]) / 2) : undefined;
  const automaticCount = [...progress.values()].filter((item) => item.automaticity === 'automatic').length;
  const developingCount = [...progress.values()].filter((item) => item.automaticity === 'developing').length;
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
      await setSettings(await loadSettings());
      setToast('备份已恢复');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '无法读取备份');
    } finally {
      event.target.value = '';
    }
  }

  async function handleClear() {
    const connected = cloud.status === 'connected' || cloud.status === 'syncing' || Boolean(cloud.lastSyncAt);
    if (!window.confirm(connected ? '将退出这台设备的家庭云同步并删除本机记录；其他设备和云端数据会保留。确定继续吗？' : '确定删除这台设备上的全部学习记录吗？请先导出备份。')) return;
    if (connected) await cloudActions.leave();
    await clearAllData();
    const fresh = await loadSettings();
    setAttempts([]);
    await setSettings(fresh);
    setToast('本地学习记录已清除');
    onDataCleared();
  }

  return <div className="page report-page"><div className="report-title"><div><span className="eyebrow">家长中心 · 当前档案</span><h1>{activeChild.nickname} 的学习报告</h1><p>每个孩子的扫描、复习队列和掌握证据完全分开。</p></div><button className="quiet-button" onClick={lock}>锁定家长中心</button></div>
    <section className="report-hero"><div><span className="report-label">当前可确认的稳定掌握</span><strong>{stats.stable}<small> 字</small></strong><p>已扫描 {stats.scanned} 字 · 基本掌握 {stats.basic} 字</p></div><div className="reliability"><span>结论可靠度</span><strong>{reliability}</strong><p>{objective.length ? `已有 ${objective.length} 次客观复核，正确 ${objectiveCorrect} 次。` : '目前只有主观熟悉度记录，不能据此给出精确识字量。'}</p></div></section>
    {literacyEstimate.sampleSize >= 24 && <section className="placement-report"><div><span className="eyebrow">分层定位结果</span><h2>{literacyEstimate.lower}—{literacyEstimate.upper}<small> 字</small></h2><p>中心估计约 {literacyEstimate.estimate} 字；来自课标字表一、二的 {literacyEstimate.sampleSize} 个代表样本。</p></div><div><strong>{literacyEstimate.reliability}</strong><p>这是“会读”的熟悉度范围，不等于稳定掌握；已审核题库中的自报会读字还会进入客观复核。</p></div></section>}
    <section className="metric-grid"><Metric icon="✓" tone="green" label="我会读（自报）" value={stats.sure} note="等待客观复核" /><Metric icon="~" tone="yellow" label="我不确定" value={stats.unsure} note="优先短期复习" /><Metric icon="✦" tone="red" label="请教教我" value={stats.teach} note="进入学习队列" /><Metric icon="↻" tone="purple" label="现在到期" value={stats.due} note="建议今天再见面" /></section>
    <section className="efficiency-panel"><div><span className="eyebrow">识字自动化效率</span><h2>准确、稳定，再看速度</h2><p>系统静默记录作答时间，不显示倒计时、不做同龄排名；速度不能抵消错误。</p></div><div className="efficiency-metrics"><div><small>客观正确率</small><strong>{objective.length ? `${Math.round(objectiveCorrect / objective.length * 100)}%` : '—'}</strong><span>{objectiveCorrect} / {objective.length} 次</span></div><div><small>正确作答中位数</small><strong>{medianLatency === undefined ? '—' : medianLatency < 1000 ? '<1秒' : `${(medianLatency / 1000).toFixed(1)}秒`}</strong><span>最近 100 次无提示正确</span></div><div><small>自动化识字</small><strong>{automaticCount} 字</strong><span>另有 {developingCount} 字正在提速</span></div></div><p className="source-note">“自动化”需客观正确率 ≥80%、正确中位时间 ≤3 秒，并有跨日和词句语境证据；不同设备的毫秒值仅看个人趋势。</p></section>
    <div className="report-columns"><section className="panel"><div className="panel-title"><h2>课程层级覆盖</h2><span>不是同龄排名</span></div><Coverage label="课标字表一" detail={`${uniqueList1} / 2500 已有记录`} value={uniqueList1 / 2500} tone="purple" /><Coverage label="课标字表二" detail={`${stats.scanned - uniqueList1} / 1000 已有记录`} value={(stats.scanned - uniqueList1) / 1000} tone="orange" /><Coverage label="小学约 3000 字目标" detail={`${stats.stable} 字达到稳定证据`} value={stats.stable / 3000} tone="green" /><p className="source-note">“已有记录”不等于“已掌握”；稳定掌握需要客观题与跨日证据。</p></section>
      <section className="panel"><div className="panel-title"><h2>下一步建议</h2><span>确定性规则生成</span></div><div className="advice-list"><div><span>01</span><p><strong>{stats.due ? `先复习 ${stats.due} 个到期字` : '完成第一轮客观复核'}</strong><small>每次 3-5 分钟，不用一次做完。</small></p></div><div><span>02</span><p><strong>优先处理“不确定”和“请教我”</strong><small>看读音、词语，再在另一题型中主动回忆。</small></p></div><div><span>03</span><p><strong>不要只追求扫描总量</strong><small>能在新词和隔天复测中认出，才是真正变稳。</small></p></div></div></section></div>
    <section className="profiles-panel"><div className="panel-title"><div><span className="eyebrow">家庭档案</span><h2>Kai、Lorik 和其他孩子</h2></div><button className="secondary-button" onClick={() => void addChild()}>＋ 添加档案</button></div><div className="profile-editor-grid">{settings.children.map((child) => <article className={child.id === settings.activeChildId ? 'profile-editor profile-editor--active' : 'profile-editor'} key={child.id}><button className="profile-select" onClick={() => void setSettings({ ...settings, activeChildId: child.id })} aria-pressed={child.id === settings.activeChildId}><span>{AVATAR_ICON[child.avatar]}</span><strong>{child.id === settings.activeChildId ? '当前学习' : '切换到此档案'}</strong></button><label>昵称<input value={child.nickname} onChange={(event) => void updateChild(child.id, { nickname: event.target.value.slice(0, 12) || '孩子' })} /></label><label>每日时长<select value={child.dailyMinutes} onChange={(event) => void updateChild(child.id, { dailyMinutes: Number(event.target.value) as 5 | 10 | 15 })}><option value="5">5 分钟</option><option value="10">10 分钟</option><option value="15">15 分钟</option></select></label><button className="profile-delete" disabled={settings.children.length <= 1} onClick={() => void removeChild(child.id)}>删除档案</button></article>)}</div></section>
    <CloudSyncPanel cloud={cloud} actions={cloudActions} />
    <section className="settings-panel"><div><h2>本机设置与数据</h2><p>本地始终保留可离线使用的数据；英文只在中文作答后显示，不进入中文掌握度。</p></div><div className="setting-switches"><label className="switch-label"><input type="checkbox" checked={settings.sound} onChange={(event) => void setSettings({ ...settings, sound: event.target.checked })} />启用设备点读声音</label><label className="switch-label"><input type="checkbox" checked={settings.englishBridge} onChange={(event) => void setSettings({ ...settings, englishBridge: event.target.checked })} />答后显示英文语义桥</label></div><div className="data-actions"><button onClick={() => void handleExport()}>导出全家备份</button><button onClick={() => inputRef.current?.click()}>恢复全家备份</button><button className="danger-button" onClick={() => void handleClear()}>删除本机数据</button><input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => void handleImport(event)} /></div></section>
  </div>;
}

function CloudSyncPanel({ cloud, actions }: { cloud: CloudUiState; actions: CloudActions }) {
  const [mode, setMode] = useState<'home' | 'create' | 'join' | 'code'>('home');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [syncCode, setSyncCode] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (reason) { setError(reason instanceof Error ? reason.message : '操作未完成'); }
    finally { setBusy(false); }
  }

  function reset(next: typeof mode = 'home') {
    setMode(next); setPin(''); setPinAgain(''); setSyncCode(''); setIssuedCode(''); setError('');
  }

  const connected = cloud.status === 'connected' || cloud.status === 'syncing' || (cloud.status === 'error' && Boolean(cloud.lastSyncAt));
  return <section className="cloud-panel">
    <div className="panel-title"><div><span className="eyebrow">跨设备存储</span><h2>家庭云同步</h2></div><span className={`cloud-badge cloud-badge--${connected ? 'on' : cloud.status === 'error' ? 'error' : 'off'}`}>{cloud.status === 'syncing' ? '同步中…' : connected ? '已连接' : cloud.status === 'checking' ? '检查中…' : '未开启'}</span></div>
    {mode === 'home' && <>
      <p className="cloud-explain">学习记录先写入本机，再通过 Cloudflare D1 合并到家庭空间。断网时可以继续使用，恢复网络后自动补传。</p>
      {cloud.message && <p className="cloud-error" role="alert">{cloud.message}</p>}
      {connected ? <div className="cloud-actions">
        <div className="cloud-last"><strong>✓ Kai、Lorik 的档案可跨设备使用</strong><small>{cloud.lastSyncAt ? `最近同步：${new Date(cloud.lastSyncAt).toLocaleString('zh-CN')}` : '正在准备第一次同步'}</small></div>
        <button onClick={() => void run(actions.syncNow)} disabled={busy || cloud.status === 'syncing'}>立即同步</button>
        <button onClick={() => reset('code')}>生成设备邀请码</button>
        <button className="quiet-button" onClick={() => void run(async () => { if (window.confirm('退出后，本机数据会保留，但不再自动同步。确定继续吗？')) { await actions.leave(); reset(); } })}>退出此设备</button>
      </div> : <div className="cloud-choice-grid">
        <button onClick={() => reset('create')}><span>☁</span><strong>开启家庭同步</strong><small>把这台设备上的现有数据作为家庭数据</small></button>
        <button onClick={() => reset('join')}><span>↔</span><strong>加入已有家庭</strong><small>输入另一台设备生成的邀请码</small></button>
      </div>}
    </>}
    {mode === 'create' && !issuedCode && <div className="cloud-form"><h3>设置 6 位家长 PIN</h3><p>PIN 与高强度设备邀请码一起用于添加新设备。请勿使用生日或连续数字。</p><label>家长 PIN<input inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="6 位数字" /></label><label>再次输入<input inputMode="numeric" autoComplete="new-password" maxLength={6} value={pinAgain} onChange={(event) => setPinAgain(event.target.value.replace(/\D/g, ''))} placeholder="再次确认" /></label>{error && <p className="cloud-error">{error}</p>}<div><button className="text-button" onClick={() => reset()}>返回</button><button className="primary-button" disabled={busy} onClick={() => void run(async () => { if (pin.length !== 6) throw new Error('请输入 6 位家长 PIN'); if (pin !== pinAgain) throw new Error('两次 PIN 不一致'); setIssuedCode(await actions.create(pin)); })}>{busy ? '正在建立…' : '建立家庭空间'}</button></div></div>}
    {mode === 'create' && issuedCode && <SyncCodeCard code={issuedCode} onDone={() => reset()} />}
    {mode === 'join' && <div className="cloud-form"><h3>加入已有家庭</h3><p>加入后会用家庭云端数据替换这台设备当前的默认档案；请先导出需要保留的本机备份。</p><label>设备邀请码<input autoCapitalize="characters" autoComplete="off" value={syncCode} onChange={(event) => setSyncCode(event.target.value.toUpperCase())} placeholder="ZIYOU-XXXX-XXXX-XXXX-XXXX" /></label><label>家长 PIN<input inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="6 位数字" /></label>{error && <p className="cloud-error">{error}</p>}<div><button className="text-button" onClick={() => reset()}>返回</button><button className="primary-button" disabled={busy} onClick={() => void run(async () => { await actions.join(syncCode, pin); reset(); })}>{busy ? '正在加入…' : '加入并下载家庭数据'}</button></div></div>}
    {mode === 'code' && !issuedCode && <div className="cloud-form"><h3>生成新的设备邀请码</h3><p>一个家庭可以同时保留多个有效邀请码；生成新码不会让旧码或已连接设备失效。</p><label>家长 PIN<input inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="6 位数字" /></label>{error && <p className="cloud-error">{error}</p>}<div><button className="text-button" onClick={() => reset()}>返回</button><button className="primary-button" disabled={busy} onClick={() => void run(async () => setIssuedCode(await actions.createInvite(pin)))}>{busy ? '正在生成…' : '生成设备邀请码'}</button></div></div>}
    {mode === 'code' && issuedCode && <SyncCodeCard code={issuedCode} onDone={() => reset()} />}
  </section>;
}

function SyncCodeCard({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return <div className="sync-code-card"><span>设备邀请码</span><strong>{code}</strong><p>邀请码 30 天内有效，最多可加入 8 台设备；家庭可以同时保留多个邀请码。请与家长 PIN 分开保管。</p><div><button onClick={() => void navigator.clipboard.writeText(code).then(() => setCopied(true))}>{copied ? '已复制' : '复制邀请码'}</button><button className="primary-button" onClick={onDone}>我已妥善保存</button></div></div>;
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
