/**
 * Tests für das Assistent-Ereignisprotokoll (Phase 0).
 *
 * Deckt die sechs Kern-Invarianten ab: (1) Opt-out ⇒ kein Write; (2) Opt-in ⇒
 * Write mit korrektem Schema; (3) Retention nach Alter UND Kapazität; (4)
 * Löschen entfernt alles; (5) Schema-Guard (kein Nested/Übergroßes in `detail`);
 * (6) Snapshot-Ausschluss (der Store steht in keiner Snapshot-Allowlist).
 *
 * `fake-indexeddb` als Polyfill (vitest node env), IDB-Welt vor jedem Test
 * zurücksetzen. Das Feature-Flag wird auf „an" gemockt, damit die Tests
 * ausschließlich das Opt-in-Verhalten (nicht die Build-Variante) prüfen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';

vi.mock('@/config/feature-flags', () => ({
  isAssistentProtokollEnabled: () => true,
}));

import { IDBStore } from '@/core/services/storage/idb-store';
import { EREIGNISPROTOKOLL_STORE } from '@/core/services/assistent/protokoll/types';
import * as store from '@/core/services/assistent/protokoll/store';
import {
  __resetProtokollFuerTests,
  initProtokoll,
  istProtokollAktiv,
  ladeLetzteEreignisse,
  loescheProtokollVollstaendig,
  protokolliereEreignis,
  setzeProtokollAktiv,
} from '@/core/services/assistent/protokoll/recorder';

const TAG = 24 * 60 * 60 * 1000;

async function frischerRecorder(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  await initProtokoll(idb);
  return idb;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetProtokollFuerTests();
});

describe('Ereignisprotokoll — Gate + Schema', () => {
  it('Opt-out: schreibt kein Ereignis', async () => {
    const idb = await frischerRecorder();
    expect(istProtokollAktiv()).toBe(false);
    await protokolliereEreignis({ typ: 'suche_ausgefuehrt', detail: { query: 'test', trefferanzahl: 3 } });
    expect(await store.zaehle(idb)).toBe(0);
  });

  it('Opt-in: schreibt ein Ereignis mit korrektem Schema', async () => {
    await frischerRecorder();
    await setzeProtokollAktiv(true);
    expect(istProtokollAktiv()).toBe(true);

    await protokolliereEreignis({
      typ: 'antrag_geoeffnet',
      route: '#/antraege/AZ1',
      entitaet: { art: 'antrag', id: 'AZ1' },
      detail: { status: 'bewilligt' },
    });

    const evs = await ladeLetzteEreignisse();
    expect(evs).toHaveLength(1);
    const e = evs[0]!;
    expect(e.typ).toBe('antrag_geoeffnet');
    expect(e.version).toBe(1);
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
    expect(typeof e.zeitstempel).toBe('number');
    expect(e.route).toBe('#/antraege/AZ1');
    expect(e.entitaet).toEqual({ art: 'antrag', id: 'AZ1' });
    expect(e.detail).toEqual({ status: 'bewilligt' });
  });
});

describe('Ereignisprotokoll — Retention', () => {
  it('löscht nach Alter (> 90 Tage) und nach Kapazität (ältester zuerst)', async () => {
    const idb = await frischerRecorder();
    const now = Date.now();

    // Alter: 2 alt (95/100 Tage), 1 frisch
    await store.appendEreignis(idb, { id: 'a1', version: 1, zeitstempel: now - 100 * TAG, typ: 'frist_angesehen' });
    await store.appendEreignis(idb, { id: 'a2', version: 1, zeitstempel: now - 95 * TAG, typ: 'frist_angesehen' });
    await store.appendEreignis(idb, { id: 'n1', version: 1, zeitstempel: now - 1 * TAG, typ: 'frist_angesehen' });

    const nachAlter = await store.loescheAelterAls(idb, now - 90 * TAG);
    expect(nachAlter).toBe(2);
    expect(await store.zaehle(idb)).toBe(1);

    // Kapazität: auf gesamt 5 auffüllen, cap = 3 → 2 älteste weg
    await store.appendEreignis(idb, { id: 'k1', version: 1, zeitstempel: now - 10 * TAG, typ: 'frist_angesehen' });
    await store.appendEreignis(idb, { id: 'k2', version: 1, zeitstempel: now - 9 * TAG, typ: 'frist_angesehen' });
    await store.appendEreignis(idb, { id: 'k3', version: 1, zeitstempel: now - 8 * TAG, typ: 'frist_angesehen' });
    await store.appendEreignis(idb, { id: 'k4', version: 1, zeitstempel: now - 7 * TAG, typ: 'frist_angesehen' });

    const nachKap = await store.kapazitaetKappen(idb, 3);
    expect(nachKap).toBe(2);
    expect(await store.zaehle(idb)).toBe(3);

    // Übrig (aufsteigend): k3 (-8d), k4 (-7d), n1 (-1d) — k1/k2 als älteste weg.
    const rest = (await store.listeNachZeit(idb, undefined, 'next')).map(e => e.id);
    expect(rest).toEqual(['k3', 'k4', 'n1']);
  });
});

describe('Ereignisprotokoll — Löschen', () => {
  it('entfernt alle Ereignisse', async () => {
    const idb = await frischerRecorder();
    await setzeProtokollAktiv(true);
    await protokolliereEreignis({ typ: 'frist_angesehen' });
    await protokolliereEreignis({ typ: 'frist_angesehen' });
    expect(await store.zaehle(idb)).toBe(2);

    const geloescht = await loescheProtokollVollstaendig();
    expect(geloescht).toBe(2);
    expect(await store.zaehle(idb)).toBe(0);
  });
});

describe('Ereignisprotokoll — Schema-Guard', () => {
  it('verwirft verschachtelte Werte und kürzt lange Strings', async () => {
    await frischerRecorder();
    await setzeProtokollAktiv(true);

    const lang = 'x'.repeat(1000);
    await protokolliereEreignis({
      typ: 'suche_ausgefuehrt',
      detail: {
        query: lang,
        trefferanzahl: 5,
        verschachtelt: { a: 1 },
        liste: [1, 2, 3],
        nichts: null as unknown as string,
      },
    });

    const e = (await ladeLetzteEreignisse())[0]!;
    expect(e.detail).toBeDefined();
    expect((e.detail!.query as string).length).toBe(500);
    expect(e.detail!.trefferanzahl).toBe(5);
    expect('verschachtelt' in e.detail!).toBe(false);
    expect('liste' in e.detail!).toBe(false);
    expect('nichts' in e.detail!).toBe(false);
  });
});

describe('Ereignisprotokoll — Snapshot-Ausschluss', () => {
  it('der Store steht in keiner Snapshot-Allowlist (Write + Sync)', () => {
    const snapshotSrc = readFileSync(new URL('../../../csv/snapshot.ts', import.meta.url), 'utf-8');
    const syncSrc = readFileSync(new URL('../../../csv/snapshot-sync.ts', import.meta.url), 'utf-8');
    expect(snapshotSrc).not.toContain(EREIGNISPROTOKOLL_STORE);
    expect(syncSrc).not.toContain(EREIGNISPROTOKOLL_STORE);
  });
});
