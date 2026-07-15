export type Confidence = 'sure' | 'unsure' | 'teach-me';
export type AttemptMode = 'self-check' | 'pronunciation-choice' | 'meaning-choice' | 'context-choice';
export type AttemptResult = 'correct' | 'partial' | 'incorrect' | 'skipped';
export type MasteryState = 'untested' | 'introduced' | 'forming' | 'basic' | 'stable' | 'due';
export type AutomaticityState = 'insufficient' | 'effortful' | 'developing' | 'automatic';
export type ChildAvatar = 'rocket' | 'planet' | 'star' | 'book';

export type ChildProfile = {
  id: string;
  nickname: string;
  avatar: ChildAvatar;
  dailyMinutes: 5 | 10 | 15;
  createdAt: string;
};

export type CharacterEntry = {
  id: number;
  char: string;
  unicode: string;
  curriculumList: 1 | 2;
  productBand: 'seed' | 'core' | 'extended';
  pinyin: string;
  words: string[];
  example: string;
  classicLine?: string;
  classicSource?: string;
  theme: string;
  scene: string;
  confusables: string[];
  englishBridges: Array<{ zh: string; en: string }>;
  characterFamily?: {
    anchor: string;
    members: string[];
    note: string;
  };
  contentStatus: 'basic' | 'reviewed';
};

export type AttemptEvent = {
  id: string;
  childId: string;
  characterId: number;
  mode: AttemptMode;
  result: AttemptResult;
  confidence?: Confidence;
  latencyMs: number;
  hintUsed: boolean;
  occurredAt: string;
  ruleVersion: 'v1';
};

export type CharacterProgress = {
  characterId: number;
  state: MasteryState;
  score: number;
  attempts: number;
  correct: number;
  objectiveCorrect: number;
  objectiveAttempts: number;
  objectiveAccuracy: number;
  medianCorrectLatencyMs?: number;
  automaticity: AutomaticityState;
  distinctModes: number;
  distinctDays: number;
  nextReviewAt?: string;
  lastSeenAt?: string;
};

export type AppSettings = {
  activeChildId: string;
  children: ChildProfile[];
  sound: boolean;
  englishBridge: boolean;
  aiEnabled: false;
};

export type BackupPayload = {
  format: 'ziyou-planet-backup';
  version: 2;
  schemaVersion: 2;
  catalogVersion: 'curriculum-2022-v1';
  ruleVersion: 'v1';
  exportedAt: string;
  settings: AppSettings;
  attempts: AttemptEvent[];
};
