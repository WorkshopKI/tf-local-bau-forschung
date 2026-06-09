import { describe, it, expect } from 'vitest';
import { collectHeartbeats, isValidHeartbeat } from '../collector';
import type { OnlineHeartbeat } from '../types';

/**
 * Minimaler In-Memory-Mock eines User-Folders-Root: jeder Key ist ein
 * User-Ordner, der Wert der Inhalt von `ZAH/online-status.json` (oder null =
 * Datei fehlt). Spiegelt den Lesepfad `readText(userDir, 'ZAH/online-status.json')`.
 */
function makeRoot(entries: Record<string, string | null>): FileSystemDirectoryHandle {
  const fileHandle = (text: string) => ({ getFile: async () => ({ text: async () => text }) });
  const zahDir = (text: string | null) => ({
    getDirectoryHandle: async (name: string) => {
      if (name !== 'ZAH') throw new Error('no such dir');
      return {
        getFileHandle: async (fname: string) => {
          if (fname !== 'online-status.json' || text === null) throw new Error('no such file');
          return fileHandle(text);
        },
      };
    },
  });
  return {
    async *values() {
      for (const name of Object.keys(entries)) yield { kind: 'directory', name };
    },
    getDirectoryHandle: async (name: string) => {
      if (!(name in entries)) throw new Error('no such user');
      return zahDir(entries[name] ?? null);
    },
  } as unknown as FileSystemDirectoryHandle;
}

function hb(partial: Partial<OnlineHeartbeat>): string {
  const base: OnlineHeartbeat = {
    version: 1,
    deviceId: 'abcdef-0000',
    lastActive: '2026-06-09T12:00:00.000Z',
    appVersion: '2.59.0',
    variant: 'production',
  };
  return JSON.stringify({ ...base, ...partial });
}

const NOW = Date.parse('2026-06-09T12:05:00.000Z'); // fixer Sammel-Zeitpunkt

describe('collectHeartbeats', () => {
  it('markiert frische Heartbeats online, alte offline', async () => {
    const root = makeRoot({
      AAA: hb({ kuerzel: 'AAA', lastActive: '2026-06-09T12:04:00.000Z' }), // 1 min → online
      BBB: hb({ kuerzel: 'BBB', lastActive: '2026-06-09T11:50:00.000Z' }), // 15 min → offline
    });
    const users = await collectHeartbeats(root, NOW);
    const byKuerzel = Object.fromEntries(users.map(u => [u.kuerzel, u]));
    expect(byKuerzel.AAA.online).toBe(true);
    expect(byKuerzel.BBB.online).toBe(false);
  });

  it('ueberspringt fehlende Dateien und kaputtes/ungueltiges JSON', async () => {
    const root = makeRoot({
      AAA: hb({ kuerzel: 'AAA', lastActive: '2026-06-09T12:04:30.000Z' }),
      MISSING: null,
      BROKEN: 'not-json{',
      WRONGVERSION: JSON.stringify({ version: 2, deviceId: 'x', lastActive: NOW }),
    });
    const users = await collectHeartbeats(root, NOW);
    expect(users.map(u => u.kuerzel)).toEqual(['AAA']);
  });

  it('faellt fuer Display auf name bzw. Geraete-ID zurueck', async () => {
    const root = makeRoot({
      NAMED: hb({ name: 'Max Muster', deviceId: 'dev-1', lastActive: '2026-06-09T12:04:00.000Z' }),
      ANON: hb({ deviceId: 'abcdef123456', lastActive: '2026-06-09T12:04:00.000Z' }),
    });
    const users = await collectHeartbeats(root, NOW);
    const display = users.map(u => u.display).sort();
    expect(display).toContain('Max Muster');
    expect(display).toContain('Gerät abcdef');
  });

  it('zukunfts-Zeitstempel (negatives Alter) gilt nicht als online', async () => {
    const root = makeRoot({
      FUTURE: hb({ kuerzel: 'FUTURE', lastActive: '2026-06-09T12:10:00.000Z' }), // 5 min in der Zukunft
    });
    const users = await collectHeartbeats(root, NOW);
    expect(users[0]?.online).toBe(false);
  });
});

describe('isValidHeartbeat', () => {
  it('akzeptiert nur version 1 mit deviceId + lastActive', () => {
    expect(isValidHeartbeat({ version: 1, deviceId: 'x', lastActive: 'y' })).toBe(true);
    expect(isValidHeartbeat({ version: 2, deviceId: 'x', lastActive: 'y' })).toBe(false);
    expect(isValidHeartbeat({ version: 1, lastActive: 'y' })).toBe(false);
    expect(isValidHeartbeat(null)).toBe(false);
    expect(isValidHeartbeat('string')).toBe(false);
  });
});
