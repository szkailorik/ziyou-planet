import { describe, expect, it } from 'vitest';
import { createDefaultSettings, migrateSettings } from './db';

describe('family profiles', () => {
  it('creates separate Kai and Lorik profiles', () => {
    const settings = createDefaultSettings();
    expect(settings.children.map((child) => child.nickname)).toEqual(['Kai', 'Lorik']);
    expect(new Set(settings.children.map((child) => child.id)).size).toBe(2);
    expect(settings.activeChildId).toBe(settings.children[0].id);
  });

  it('migrates the original single-child settings without losing its id', () => {
    const migrated = migrateSettings({ childId: 'legacy-child-id', nickname: '小探险家', dailyMinutes: 10, sound: true, aiEnabled: false });
    expect(migrated.children[0]).toMatchObject({ id: 'legacy-child-id', nickname: 'Kai' });
    expect(migrated.children[1].nickname).toBe('Lorik');
  });
});
