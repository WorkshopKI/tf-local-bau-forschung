import { describe, it, expect } from 'vitest';
import { getKorpusAuswahl, putKorpusAuswahl, deleteKorpusAuswahl, korpusAuswahlKey } from '../korpus-store';
import type { KorpusAuswahlRecord } from '../korpusAuswahl';
import type { IDBStore } from '@/core/services/storage';

/** Minimaler In-Memory-IDBStore mit einsehbarer Map (nur get/set/delete genutzt). */
function fakeIdb() {
  const m = new Map<string, unknown>();
  const idb = {
    async get<T>(k: string): Promise<T | null> { return (m.get(k) as T) ?? null; },
    async set(k: string, v: unknown): Promise<void> { m.set(k, v); },
    async delete(k: string): Promise<void> { m.delete(k); },
  } as unknown as IDBStore;
  return { idb, map: m };
}

const record = (key: string, aufgenommen: string[]): KorpusAuswahlRecord =>
  ({ key, aufgenommen, geaendert_am: '2026-07-21T10:00:00.000Z' });

describe('korpus-store — Keying + Default', () => {
  it('schreibt unter gutachten-korpus:<key> (kv, kein eigener Object-Store)', async () => {
    const { idb, map } = fakeIdb();
    await putKorpusAuswahl(idb, record('VB-1', ['d1']));
    expect(map.has('gutachten-korpus:VB-1')).toBe(true);
    expect(korpusAuswahlKey('VB-1')).toBe('gutachten-korpus:VB-1');
  });

  it('Miss → leerer Record statt null (Korpus === VB ist der Default)', async () => {
    const { idb } = fakeIdb();
    const r = await getKorpusAuswahl(idb, 'VB-unbekannt');
    expect(r.aufgenommen).toEqual([]);
    expect(r.key).toBe('VB-unbekannt');
  });

  it('Roundtrip erhält die Auswahl', async () => {
    const { idb } = fakeIdb();
    await putKorpusAuswahl(idb, record('VB-1', ['d1', 'd2']));
    expect((await getKorpusAuswahl(idb, 'VB-1')).aufgenommen).toEqual(['d1', 'd2']);
  });

  it('zwei Verbünde sind disjunkt gekeyt', async () => {
    const { idb } = fakeIdb();
    await putKorpusAuswahl(idb, record('VB-1', ['d1']));
    await putKorpusAuswahl(idb, record('VB-2', ['d9']));
    expect((await getKorpusAuswahl(idb, 'VB-1')).aufgenommen).toEqual(['d1']);
    expect((await getKorpusAuswahl(idb, 'VB-2')).aufgenommen).toEqual(['d9']);
  });

  it('defensiv: Record ohne aufgenommen-Array kippt nicht in den Auflösungspfad', async () => {
    const { idb, map } = fakeIdb();
    map.set('gutachten-korpus:VB-1', { key: 'VB-1', geaendert_am: 'x' });
    expect((await getKorpusAuswahl(idb, 'VB-1')).aufgenommen).toEqual([]);
  });

  it('hinweisErledigt überlebt den Roundtrip (sonst käme der Hinweis nach Reload zurück)', async () => {
    const { idb } = fakeIdb();
    await putKorpusAuswahl(idb, { ...record('VB-1', []), hinweisErledigt: true });
    expect((await getKorpusAuswahl(idb, 'VB-1')).hinweisErledigt).toBe(true);
  });

  it('delete entfernt den Key', async () => {
    const { idb, map } = fakeIdb();
    await putKorpusAuswahl(idb, record('VB-1', ['d1']));
    await deleteKorpusAuswahl(idb, 'VB-1');
    expect(map.has('gutachten-korpus:VB-1')).toBe(false);
  });
});
