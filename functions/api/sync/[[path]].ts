type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (query: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown>;
};

type Env = { ZIYOU_DB: D1Database };
type Context = { request: Request; env: Env };

type ChildProfile = {
  id: string;
  nickname: string;
  avatar: 'rocket' | 'planet' | 'star' | 'book';
  dailyMinutes: 5 | 10 | 15;
  createdAt: string;
};

type AppSettings = {
  activeChildId: string;
  children: ChildProfile[];
  sound: boolean;
  aiEnabled: false;
};

type AttemptEvent = {
  id: string;
  childId: string;
  characterId: number;
  mode: 'self-check' | 'pronunciation-choice' | 'meaning-choice' | 'context-choice';
  result: 'correct' | 'partial' | 'incorrect' | 'skipped';
  confidence?: 'sure' | 'unsure' | 'teach-me';
  latencyMs: number;
  hintUsed: boolean;
  occurredAt: string;
  ruleVersion: 'v1';
};

type BackupPayload = {
  format: 'ziyou-planet-backup';
  version: 2;
  schemaVersion: 2;
  catalogVersion: 'curriculum-2022-v1';
  ruleVersion: 'v1';
  exportedAt: string;
  settings: AppSettings;
  attempts: AttemptEvent[];
};

type FamilyRow = {
  id: string;
  settings_json: string;
  settings_updated_at: string;
  pin_salt?: string;
  pin_hash?: string;
};

const COOKIE_NAME = 'zp_session';
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_MAX_USES = 8;
const MAX_ACTIVE_INVITES = 12;

export async function onRequest(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const action = url.pathname.split('/').filter(Boolean).at(-1) ?? 'status';
    const method = context.request.method.toUpperCase();

    if (method === 'OPTIONS') return new Response(null, { status: 204 });
    if (method !== 'GET') assertSameOrigin(context.request);

    if (action === 'status' && method === 'GET') return status(context);
    if (action === 'create' && method === 'POST') return createFamily(context);
    if (action === 'join' && method === 'POST') return joinFamily(context);
    if (action === 'leave' && method === 'POST') return leaveFamily(context);
    if (action === 'code' && method === 'POST') return regenerateCode(context);
    if (action === 'state' && method === 'GET') return getState(context);
    if (action === 'state' && method === 'PUT') return putState(context);
    return json({ error: '接口不存在' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器暂时无法完成同步';
    const status = message.startsWith('AUTH:') ? 401 : message.startsWith('INPUT:') ? 400 : 500;
    return json({ error: message.replace(/^(AUTH|INPUT):\s*/, '') }, status);
  }
}

async function status({ request, env }: Context) {
  const session = await getSession(request, env, false);
  if (!session) return json({ connected: false });
  const now = new Date().toISOString();
  const [attempts, devices, invites] = await Promise.all([
    env.ZIYOU_DB.prepare('SELECT COUNT(*) AS count FROM attempts WHERE family_id = ?').bind(session.id).first<{ count: number }>(),
    env.ZIYOU_DB.prepare('SELECT COUNT(*) AS count FROM devices WHERE family_id = ?').bind(session.id).first<{ count: number }>(),
    env.ZIYOU_DB.prepare('SELECT COUNT(*) AS count FROM family_invites WHERE family_id = ? AND revoked_at IS NULL AND use_count < max_uses AND (expires_at IS NULL OR expires_at > ?)').bind(session.id, now).first<{ count: number }>()
  ]);
  return json({ connected: true, updatedAt: session.settings_updated_at, attempts: Number(attempts?.count ?? 0), devices: Number(devices?.count ?? 0), activeInvites: Number(invites?.count ?? 0) });
}

async function createFamily({ request, env }: Context) {
  const body = await readJson(request) as { pin?: unknown; deviceLabel?: unknown; backup?: unknown; settingsUpdatedAt?: unknown };
  const pin = validatePin(body.pin);
  const backup = validateBackup(body.backup);
  const now = new Date().toISOString();
  const settingsUpdatedAt = validateClientTime(body.settingsUpdatedAt, now);
  const familyId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const syncCode = makeSyncCode();
  const inviteId = crypto.randomUUID();
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const token = randomToken(32);
  const salt = randomToken(16);
  const [codeHash, tokenHash, pinHash] = await Promise.all([
    sha256(normalizeCode(syncCode)),
    sha256(token),
    derivePin(pin, salt)
  ]);

  await env.ZIYOU_DB.batch([
    env.ZIYOU_DB.prepare('INSERT INTO families (id, sync_code_hash, pin_salt, pin_hash, settings_json, settings_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(familyId, codeHash, salt, pinHash, JSON.stringify(backup.settings), settingsUpdatedAt, now, now),
    env.ZIYOU_DB.prepare('INSERT INTO devices (id, family_id, token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(deviceId, familyId, tokenHash, sanitizeLabel(body.deviceLabel), now, now),
    env.ZIYOU_DB.prepare('INSERT INTO family_invites (id, family_id, code_hash, created_at, expires_at, max_uses, use_count, revoked_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)')
      .bind(inviteId, familyId, codeHash, now, inviteExpiresAt, INVITE_MAX_USES)
  ]);
  await insertAttempts(env.ZIYOU_DB, familyId, backup.attempts, new Set(backup.settings.children.map((child) => child.id)));
  const state = await readState(env.ZIYOU_DB, { id: familyId, settings_json: JSON.stringify(backup.settings), settings_updated_at: settingsUpdatedAt });
  return json({ connected: true, syncCode, state }, 201, sessionCookie(token));
}

async function joinFamily({ request, env }: Context) {
  const body = await readJson(request) as { syncCode?: unknown; pin?: unknown; deviceLabel?: unknown };
  const pin = validatePin(body.pin);
  const codeHash = await sha256(normalizeCode(String(body.syncCode ?? '')));
  const now = new Date().toISOString();
  const family = await env.ZIYOU_DB.prepare('SELECT f.id, f.settings_json, f.settings_updated_at, f.pin_salt, f.pin_hash, i.id AS invite_id FROM family_invites i JOIN families f ON f.id = i.family_id WHERE i.code_hash = ? AND i.revoked_at IS NULL AND i.use_count < i.max_uses AND (i.expires_at IS NULL OR i.expires_at > ?)')
    .bind(codeHash, now).first<FamilyRow & { invite_id: string }>();
  if (!family?.pin_salt || !family.pin_hash) throw new Error('AUTH:设备邀请码或家长 PIN 不正确');
  const candidate = await derivePin(pin, family.pin_salt);
  if (!constantTimeEqual(candidate, family.pin_hash)) throw new Error('AUTH:设备邀请码或家长 PIN 不正确');

  const token = randomToken(32);
  await env.ZIYOU_DB.batch([
    env.ZIYOU_DB.prepare('INSERT INTO devices (id, family_id, token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), family.id, await sha256(token), sanitizeLabel(body.deviceLabel), now, now),
    env.ZIYOU_DB.prepare('UPDATE family_invites SET use_count = use_count + 1 WHERE id = ? AND use_count < max_uses')
      .bind(family.invite_id)
  ]);
  return json({ connected: true, state: await readState(env.ZIYOU_DB, family) }, 200, sessionCookie(token));
}

async function leaveFamily({ request, env }: Context) {
  const token = getCookie(request, COOKIE_NAME);
  if (token) await env.ZIYOU_DB.prepare('DELETE FROM devices WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ connected: false }, 200, expiredSessionCookie());
}

async function regenerateCode({ request, env }: Context) {
  const session = await getSession(request, env, true);
  const body = await readJson(request) as { pin?: unknown };
  const pin = validatePin(body.pin);
  const family = await env.ZIYOU_DB.prepare('SELECT pin_salt, pin_hash FROM families WHERE id = ?').bind(session.id).first<{ pin_salt: string; pin_hash: string }>();
  if (!family || !constantTimeEqual(await derivePin(pin, family.pin_salt), family.pin_hash)) throw new Error('AUTH:家长 PIN 不正确');
  const now = new Date().toISOString();
  const active = await env.ZIYOU_DB.prepare('SELECT COUNT(*) AS count FROM family_invites WHERE family_id = ? AND revoked_at IS NULL AND use_count < max_uses AND (expires_at IS NULL OR expires_at > ?)')
    .bind(session.id, now).first<{ count: number }>();
  if (Number(active?.count ?? 0) >= MAX_ACTIVE_INVITES) throw new Error('INPUT:有效设备邀请码已经达到 12 个，请先使用已有邀请码');
  const syncCode = makeSyncCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await env.ZIYOU_DB.batch([
    env.ZIYOU_DB.prepare('INSERT INTO family_invites (id, family_id, code_hash, created_at, expires_at, max_uses, use_count, revoked_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)')
      .bind(crypto.randomUUID(), session.id, await sha256(normalizeCode(syncCode)), now, expiresAt, INVITE_MAX_USES),
    env.ZIYOU_DB.prepare('UPDATE families SET updated_at = ? WHERE id = ?').bind(now, session.id)
  ]);
  return json({ syncCode, expiresAt, maxUses: INVITE_MAX_USES });
}

async function getState({ request, env }: Context) {
  const session = await getSession(request, env, true);
  return json({ state: await readState(env.ZIYOU_DB, session) });
}

async function putState({ request, env }: Context) {
  const session = await getSession(request, env, true);
  const body = await readJson(request) as { backup?: unknown; settingsUpdatedAt?: unknown };
  const backup = validateBackup(body.backup);
  const clientSettingsTime = validateClientTime(body.settingsUpdatedAt, new Date().toISOString());
  let canonical = session;

  if (clientSettingsTime > session.settings_updated_at) {
    const now = new Date().toISOString();
    await env.ZIYOU_DB.prepare('UPDATE families SET settings_json = ?, settings_updated_at = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(backup.settings), clientSettingsTime, now, session.id).run();
    const childIds = backup.settings.children.map((child) => child.id);
    const placeholders = childIds.map(() => '?').join(', ');
    await env.ZIYOU_DB.prepare(`DELETE FROM attempts WHERE family_id = ? AND child_id NOT IN (${placeholders})`).bind(session.id, ...childIds).run();
    canonical = { ...session, settings_json: JSON.stringify(backup.settings), settings_updated_at: clientSettingsTime };
  }

  const canonicalSettings = JSON.parse(canonical.settings_json) as AppSettings;
  await insertAttempts(env.ZIYOU_DB, session.id, backup.attempts, new Set(canonicalSettings.children.map((child) => child.id)));
  await env.ZIYOU_DB.prepare('UPDATE families SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), session.id).run();
  return json({ state: await readState(env.ZIYOU_DB, canonical) });
}

async function getSession(request: Request, env: Env, required: boolean): Promise<FamilyRow | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    if (required) throw new Error('AUTH:这台设备尚未加入家庭同步');
    return null;
  }
  const tokenHash = await sha256(token);
  const family = await env.ZIYOU_DB.prepare('SELECT f.id, f.settings_json, f.settings_updated_at FROM devices d JOIN families f ON f.id = d.family_id WHERE d.token_hash = ?')
    .bind(tokenHash).first<FamilyRow>();
  if (!family) {
    if (required) throw new Error('AUTH:同步会话已失效，请重新加入');
    return null;
  }
  await env.ZIYOU_DB.prepare('UPDATE devices SET last_seen_at = ? WHERE token_hash = ?').bind(new Date().toISOString(), tokenHash).run();
  return family;
}

async function readState(db: D1Database, family: FamilyRow) {
  const rows = await db.prepare('SELECT id, child_id, character_id, mode, result, confidence, latency_ms, hint_used, occurred_at, rule_version FROM attempts WHERE family_id = ? ORDER BY occurred_at ASC')
    .bind(family.id).all<Record<string, unknown>>();
  const attempts: AttemptEvent[] = rows.results.map((row) => ({
    id: String(row.id),
    childId: String(row.child_id),
    characterId: Number(row.character_id),
    mode: row.mode as AttemptEvent['mode'],
    result: row.result as AttemptEvent['result'],
    ...(row.confidence ? { confidence: row.confidence as AttemptEvent['confidence'] } : {}),
    latencyMs: Number(row.latency_ms),
    hintUsed: Boolean(row.hint_used),
    occurredAt: String(row.occurred_at),
    ruleVersion: 'v1'
  }));
  return {
    backup: {
      format: 'ziyou-planet-backup', version: 2, schemaVersion: 2,
      catalogVersion: 'curriculum-2022-v1', ruleVersion: 'v1',
      exportedAt: new Date().toISOString(), settings: JSON.parse(family.settings_json), attempts
    } satisfies BackupPayload,
    settingsUpdatedAt: family.settings_updated_at,
    syncedAt: new Date().toISOString()
  };
}

async function insertAttempts(db: D1Database, familyId: string, attempts: AttemptEvent[], allowedChildren: Set<string>) {
  const receivedAt = new Date().toISOString();
  const valid = attempts.filter((attempt) => allowedChildren.has(attempt.childId));
  for (let index = 0; index < valid.length; index += 50) {
    const statements = valid.slice(index, index + 50).map((attempt) => db.prepare(
      'INSERT OR IGNORE INTO attempts (id, family_id, child_id, character_id, mode, result, confidence, latency_ms, hint_used, occurred_at, rule_version, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(attempt.id, familyId, attempt.childId, attempt.characterId, attempt.mode, attempt.result, attempt.confidence ?? null, attempt.latencyMs, attempt.hintUsed ? 1 : 0, attempt.occurredAt, attempt.ruleVersion, receivedAt));
    if (statements.length) await db.batch(statements);
  }
}

function validateBackup(value: unknown): BackupPayload {
  const payload = value as BackupPayload;
  if (!payload || payload.format !== 'ziyou-planet-backup' || payload.version !== 2 || payload.schemaVersion !== 2 || payload.catalogVersion !== 'curriculum-2022-v1' || payload.ruleVersion !== 'v1' || !Array.isArray(payload.attempts)) throw new Error('INPUT:同步数据版本不受支持');
  const settings = payload.settings;
  if (!settings || !Array.isArray(settings.children) || settings.children.length < 1 || settings.children.length > 8 || typeof settings.sound !== 'boolean' || settings.aiEnabled !== false) throw new Error('INPUT:家庭设置不正确');
  const childIds = new Set<string>();
  const avatars = new Set(['rocket', 'planet', 'star', 'book']);
  for (const child of settings.children) {
    if (!child || typeof child.id !== 'string' || child.id.length < 8 || childIds.has(child.id) || typeof child.nickname !== 'string' || child.nickname.trim().length < 1 || child.nickname.length > 12 || !avatars.has(child.avatar) || ![5, 10, 15].includes(child.dailyMinutes) || !Number.isFinite(Date.parse(child.createdAt))) throw new Error('INPUT:儿童档案不正确');
    childIds.add(child.id);
  }
  if (!childIds.has(settings.activeChildId)) throw new Error('INPUT:当前儿童档案不正确');
  if (payload.attempts.length > 50_000) throw new Error('INPUT:学习记录过多，请联系支持');
  const ids = new Set<string>();
  const modes = new Set(['self-check', 'pronunciation-choice', 'meaning-choice', 'context-choice']);
  const results = new Set(['correct', 'partial', 'incorrect', 'skipped']);
  const confidences = new Set(['sure', 'unsure', 'teach-me']);
  const latestAllowed = Date.now() + 5 * 60 * 1000;
  for (const event of payload.attempts) {
    const time = Date.parse(event?.occurredAt);
    if (!event || typeof event.id !== 'string' || ids.has(event.id) || !childIds.has(event.childId) || !Number.isInteger(event.characterId) || event.characterId < 1 || event.characterId > 3500 || !modes.has(event.mode) || !results.has(event.result) || (event.confidence !== undefined && !confidences.has(event.confidence)) || !Number.isFinite(event.latencyMs) || event.latencyMs < 0 || event.latencyMs > 3_600_000 || typeof event.hintUsed !== 'boolean' || event.ruleVersion !== 'v1' || !Number.isFinite(time) || time > latestAllowed) throw new Error('INPUT:学习记录包含无效项目');
    ids.add(event.id);
  }
  return payload;
}

async function readJson(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error('INPUT:同步数据超过 12MB');
  try { return await request.json(); } catch { throw new Error('INPUT:请求内容不是有效 JSON'); }
}

function validatePin(value: unknown) {
  const pin = String(value ?? '').trim();
  if (!/^\d{6}$/.test(pin)) throw new Error('INPUT:家长 PIN 必须是 6 位数字');
  return pin;
}

function validateClientTime(value: unknown, fallback: string) {
  const text = String(value ?? '');
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || parsed > Date.now() + 5 * 60 * 1000) return fallback;
  return new Date(parsed).toISOString();
}

function sanitizeLabel(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('AUTH:请求来源不受信任');
}

function normalizeCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^ZIYOU[2-9A-HJ-NP-Z]{16}$/.test(normalized)) throw new Error('INPUT:家庭同步码格式不正确');
  return normalized;
}

function makeSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = '';
  for (const byte of bytes) raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `ZIYOU-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

function randomToken(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256);
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function getCookie(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api/sync; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`;
}

function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/api/sync; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function json(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
