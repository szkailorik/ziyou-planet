import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, AttemptEvent, BackupPayload, ChildAvatar, ChildProfile } from './types';

export type SyncMeta = {
  key: 'cloud';
  settingsUpdatedAt: string;
  lastSyncAt?: string;
};

type LegacySettings = {
  childId: string;
  nickname: string;
  dailyMinutes: 5 | 10 | 15;
  sound: boolean;
  aiEnabled: false;
};

function createChild(nickname: string, avatar: ChildAvatar, dailyMinutes: 5 | 10 | 15 = 10, id: string = crypto.randomUUID()): ChildProfile {
  return { id, nickname, avatar, dailyMinutes, createdAt: new Date().toISOString() };
}

export function createDefaultSettings(): AppSettings {
  const kai = createChild('Kai', 'rocket');
  return {
    activeChildId: kai.id,
    children: [kai, createChild('Lorik', 'planet')],
    sound: true,
    aiEnabled: false
  };
}

export function migrateSettings(value: AppSettings | LegacySettings): AppSettings {
  if ('children' in value && Array.isArray(value.children) && value.children.length > 0) return value;
  const legacy = value as LegacySettings;
  const kai = createChild(legacy.nickname === '小探险家' ? 'Kai' : legacy.nickname, 'rocket', legacy.dailyMinutes, legacy.childId);
  return {
    activeChildId: kai.id,
    children: [kai, createChild('Lorik', 'planet', legacy.dailyMinutes)],
    sound: legacy.sound,
    aiEnabled: false
  };
}

class ZiyouDatabase extends Dexie {
  attempts!: EntityTable<AttemptEvent, 'id'>;
  settings!: EntityTable<{ key: string; value: AppSettings | LegacySettings }, 'key'>;
  syncMeta!: EntityTable<SyncMeta, 'key'>;

  constructor() {
    super('ziyou-planet');
    this.version(1).stores({
      attempts: 'id, childId, characterId, occurredAt, mode',
      settings: 'key'
    });
    this.version(2).stores({
      attempts: 'id, childId, characterId, occurredAt, mode',
      settings: 'key'
    });
    this.version(3).stores({
      attempts: 'id, childId, characterId, occurredAt, mode',
      settings: 'key',
      syncMeta: 'key'
    });
  }
}

export const db = new ZiyouDatabase();

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.settings.get('main');
  if (row) {
    const migrated = migrateSettings(row.value);
    if (!('children' in row.value)) await saveSettings(migrated);
    if (!await db.syncMeta.get('cloud')) await db.syncMeta.put({ key: 'cloud', settingsUpdatedAt: new Date().toISOString() });
    return migrated;
  }
  const fresh = createDefaultSettings();
  const now = new Date().toISOString();
  await db.transaction('rw', db.settings, db.syncMeta, async () => {
    await db.settings.put({ key: 'main', value: fresh });
    await db.syncMeta.put({ key: 'cloud', settingsUpdatedAt: now });
  });
  return fresh;
}

export async function saveSettings(value: AppSettings, options: { markChanged?: boolean } = {}) {
  await db.transaction('rw', db.settings, db.syncMeta, async () => {
    await db.settings.put({ key: 'main', value });
    if (options.markChanged !== false) {
      const current = await db.syncMeta.get('cloud');
      await db.syncMeta.put({ key: 'cloud', settingsUpdatedAt: new Date().toISOString(), lastSyncAt: current?.lastSyncAt });
    }
  });
}

export async function loadSyncMeta(): Promise<SyncMeta> {
  const current = await db.syncMeta.get('cloud');
  if (current) return current;
  const fresh: SyncMeta = { key: 'cloud', settingsUpdatedAt: new Date().toISOString() };
  await db.syncMeta.put(fresh);
  return fresh;
}

export async function exportBackup(settings: AppSettings): Promise<BackupPayload> {
  return {
    format: 'ziyou-planet-backup',
    version: 2,
    schemaVersion: 2,
    catalogVersion: 'curriculum-2022-v1',
    ruleVersion: 'v1',
    exportedAt: new Date().toISOString(),
    settings,
    attempts: await db.attempts.toArray()
  };
}

export async function importBackup(payload: BackupPayload) {
  validateBackup(payload);
  await db.transaction('rw', db.attempts, db.settings, db.syncMeta, async () => {
    await db.attempts.clear();
    await db.attempts.bulkPut(payload.attempts);
    await db.settings.put({ key: 'main', value: payload.settings });
    await db.syncMeta.put({ key: 'cloud', settingsUpdatedAt: new Date().toISOString() });
  });
}

export async function replaceFromCloud(payload: BackupPayload, settingsUpdatedAt: string, syncedAt: string) {
  validateBackup(payload);
  await db.transaction('rw', db.attempts, db.settings, db.syncMeta, async () => {
    await db.attempts.clear();
    await db.attempts.bulkPut(payload.attempts);
    await db.settings.put({ key: 'main', value: payload.settings });
    await db.syncMeta.put({ key: 'cloud', settingsUpdatedAt, lastSyncAt: syncedAt });
  });
}

export function validateBackup(payload: BackupPayload) {
  if (!payload || payload.format !== 'ziyou-planet-backup' || payload.version !== 2 || payload.schemaVersion !== 2 || payload.catalogVersion !== 'curriculum-2022-v1' || payload.ruleVersion !== 'v1' || !Array.isArray(payload.attempts)) {
    throw new Error('备份版本不受支持');
  }
  if (!payload.settings || !Array.isArray(payload.settings.children) || payload.settings.children.length < 1 || payload.settings.children.length > 8 || typeof payload.settings.sound !== 'boolean' || payload.settings.aiEnabled !== false) {
    throw new Error('备份中的设置不正确');
  }
  const childIds = new Set<string>();
  const avatars = new Set(['rocket', 'planet', 'star', 'book']);
  for (const child of payload.settings.children) {
    if (!child || typeof child.id !== 'string' || child.id.length < 8 || childIds.has(child.id) || typeof child.nickname !== 'string' || child.nickname.trim().length < 1 || child.nickname.length > 12 || !avatars.has(child.avatar) || ![5, 10, 15].includes(child.dailyMinutes) || !Number.isFinite(Date.parse(child.createdAt))) {
      throw new Error('备份中的儿童档案不正确');
    }
    childIds.add(child.id);
  }
  if (!childIds.has(payload.settings.activeChildId)) throw new Error('备份中的当前档案不正确');
  if (payload.attempts.length > 50_000) throw new Error('备份记录过多');
  const ids = new Set<string>();
  const modes = new Set(['self-check', 'pronunciation-choice', 'meaning-choice', 'context-choice']);
  const results = new Set(['correct', 'partial', 'incorrect', 'skipped']);
  const confidences = new Set(['sure', 'unsure', 'teach-me']);
  const latestAllowed = Date.now() + 5 * 60 * 1000;
  for (const event of payload.attempts) {
    const time = Date.parse(event?.occurredAt);
    if (!event || typeof event.id !== 'string' || ids.has(event.id) || !childIds.has(event.childId) || !Number.isInteger(event.characterId) || event.characterId < 1 || event.characterId > 3500 || !modes.has(event.mode) || !results.has(event.result) || (event.confidence !== undefined && !confidences.has(event.confidence)) || !Number.isFinite(event.latencyMs) || event.latencyMs < 0 || event.latencyMs > 3_600_000 || typeof event.hintUsed !== 'boolean' || event.ruleVersion !== 'v1' || !Number.isFinite(time) || time > latestAllowed) {
      throw new Error('备份包含无效或重复的作答记录');
    }
    ids.add(event.id);
  }
}

export async function clearAllData() {
  await db.transaction('rw', db.attempts, db.settings, db.syncMeta, async () => {
    await db.attempts.clear();
    await db.settings.clear();
    await db.syncMeta.clear();
  });
}
