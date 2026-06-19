import { describe, it, expect, vi } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { getUserId, resolveInstallId, INSTALL_ID_KEY } from '../identity';

// machineFingerprint nutzt `screen`/`navigator` → im node-Test-Env mocken.
vi.mock('@/core/services/infrastructure/crypto', () => ({
  machineFingerprint: vi.fn(async () => 'deadbeef'),
}));

function fakeIdb(seed: Record<string, unknown> = {}): { idb: IDBStore; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>(Object.entries(seed));
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
  } as unknown as IDBStore;
  return { idb, kv };
}

describe('getUserId — rein', () => {
  it('bevorzugt das Kürzel', () => {
    expect(getUserId('AB', 'inst-x')).toBe('AB');
  });
  it('fällt auf installId zurück bei leerem/whitespace-Kürzel', () => {
    expect(getUserId(undefined, 'inst-x')).toBe('inst-x');
    expect(getUserId('   ', 'inst-x')).toBe('inst-x');
  });
  it('behandelt das Übersichts-Kürzel „alle" als kein Kürzel', () => {
    expect(getUserId('alle', 'inst-x')).toBe('inst-x');
    expect(getUserId('ALLE', 'inst-x')).toBe('inst-x');
  });
  it('NFC-normalisiert Umlaut-Kürzel', () => {
    // 'THÜ' als NFD (U+0308 combining) muss zu NFC zusammengezogen werden.
    const nfd = 'THÜ';
    expect(getUserId(nfd, 'inst-x')).toBe('THÜ'.normalize('NFC'));
  });
});

describe('resolveInstallId — persistiert + stabil', () => {
  it('liefert den gecachten Wert ohne Neugenerierung', async () => {
    const { idb } = fakeIdb({ [INSTALL_ID_KEY]: 'inst-cached' });
    expect(await resolveInstallId(idb)).toBe('inst-cached');
  });

  it('generiert + persistiert beim ersten Aufruf, danach stabil', async () => {
    const { idb, kv } = fakeIdb();
    const first = await resolveInstallId(idb);
    expect(first).toMatch(/^inst-deadbeef-[0-9a-f]{8}$/);
    expect(kv.get(INSTALL_ID_KEY)).toBe(first);
    // Zweiter Aufruf liefert den persistierten Wert (kein Drift).
    expect(await resolveInstallId(idb)).toBe(first);
  });
});
