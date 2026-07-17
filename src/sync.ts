import type { BackupPayload } from './types';

export type CloudSnapshot = {
  backup: BackupPayload;
  settingsUpdatedAt: string;
  syncedAt: string;
};

export type CloudStatus = {
  connected: boolean;
  updatedAt?: string;
  attempts?: number;
  devices?: number;
  activeInvites?: number;
};

type JsonRecord = Record<string, unknown>;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/sync/${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({})) as JsonRecord;
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '云同步暂时不可用');
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('云同步连接超时，本地学习不受影响');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function deviceLabel() {
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = browserNavigator.userAgentData?.platform || navigator.platform || '未知设备';
  return `${platform} · ${new Date().toLocaleDateString('zh-CN')}`.slice(0, 80);
}

export async function getCloudStatus() {
  return api<CloudStatus>('status', { method: 'GET', headers: {} });
}

export async function createCloudFamily(pin: string, backup: BackupPayload, settingsUpdatedAt: string) {
  return api<{ connected: true; syncCode: string; state: CloudSnapshot }>('create', {
    method: 'POST', body: JSON.stringify({ pin, backup, settingsUpdatedAt, deviceLabel: deviceLabel() })
  });
}

export async function joinCloudFamily(syncCode: string, pin: string) {
  return api<{ connected: true; state: CloudSnapshot }>('join', {
    method: 'POST', body: JSON.stringify({ syncCode, pin, deviceLabel: deviceLabel() })
  });
}

export async function syncCloudState(backup: BackupPayload, settingsUpdatedAt: string) {
  return api<{ state: CloudSnapshot }>('state', {
    method: 'PUT', body: JSON.stringify({ backup, settingsUpdatedAt })
  });
}

export async function pullCloudState() {
  return api<{ state: CloudSnapshot }>('state', { method: 'GET', headers: {} });
}

export async function leaveCloudFamily() {
  return api<{ connected: false }>('leave', { method: 'POST', body: '{}' });
}

export async function createDeviceInvite(pin: string) {
  return api<{ syncCode: string; expiresAt: string; maxUses: number }>('code', { method: 'POST', body: JSON.stringify({ pin }) });
}
