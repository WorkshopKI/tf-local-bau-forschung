/**
 * Tests des Gedächtnis-Stores (store.ts) + Facade (recorder.ts) + der harten
 * Invariante „Snapshot-Ausschluss" (der Store steht in KEINER Snapshot-Allowlist).
 *
 * `fake-indexeddb` als Polyfill; das Feature-Flag wird auf „an" gemockt, damit
 * die Tests das Verhalten (nicht die Build-Variante) prüfen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';

vi.mock('@/config/feature-flags', () => ({
  isAssistentGedaechtnisEnabled: () => true,
}));

import { IDBStore } from '@/core/services/storage/idb-store';
import { GEDAECHTNIS_STORE } from '../types';
import type { GedaechtnisEintrag, LaufMeta } from '../types';
import {
  alleEintraege,
  entferneInvalidierteAelterAls,
  loescheAlle,
  loescheEintrag,
  schreibeStapel,
} from '../store';
import {
  __resetGedaechtnisFuerTests,
  initGedaechtnis,
  istGedaechtnisAktiv,
  ladeAktiveEintraege,
  ladeLaufMeta,
  persistiereEintraege,
  schreibeLaufMeta,
  setzeGedaechtnisAktiv,
} from '../recorder';

const TAG = 24 * 60 * 60 * 1000;

function eintrag(over: Partial<GedaechtnisEintrag> & { id: string }): GedaechtnisEintrag {
  return {
    version: 1,
    block: 'arbeitskontext',
    text: 'Fakt.',
    status: 'aktiv',
    erstellt: 1000,
    aktualisiert: 1000,
    belege: ['e1'],
    ...over,
  };
}

async function frischerStore(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  await initGedaechtnis(idb);
  return idb;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetGedaechtnisFuerTests();
});

describe('Gedächtnis-Store — CRUD', () => {
  it('schreibt einen Stapel und liest ihn zurück (put = anlegen/überschreiben)', async () => {
    const idb = await frischerStore();
    await schreibeStapel(idb, [eintrag({ id: 'a' }), eintrag({ id: 'b', text: 'Zwei.' })]);
    expect(await alleEintraege(idb)).toHaveLength(2);
    // Überschreiben desselben id-Keys
    await schreibeStapel(idb, [eintrag({ id: 'a', text: 'Geändert.' })]);
    const alle = await alleEintraege(idb);
    expect(alle).toHaveLength(2);
    expect(alle.find(e => e.id === 'a')!.text).toBe('Geändert.');
  });

  it('löscht einen Eintrag hart und alle', async () => {
    const idb = await frischerStore();
    await schreibeStapel(idb, [eintrag({ id: 'a' }), eintrag({ id: 'b' })]);
    await loescheEintrag(idb, 'a');
    expect(await alleEintraege(idb)).toHaveLength(1);
    const anzahl = await loescheAlle(idb);
    expect(anzahl).toBe(1);
    expect(await alleEintraege(idb)).toHaveLength(0);
  });

  it('Retention entfernt nur INVALIDIERTE Einträge älter als cutoff (aktive bleiben)', async () => {
    const idb = await frischerStore();
    const now = Date.now();
    await schreibeStapel(idb, [
      eintrag({ id: 'inv-alt', status: 'invalidiert', aktualisiert: now - 40 * TAG }),
      eintrag({ id: 'inv-frisch', status: 'invalidiert', aktualisiert: now - 5 * TAG }),
      eintrag({ id: 'aktiv-alt', status: 'aktiv', aktualisiert: now - 40 * TAG }),
    ]);
    const geloescht = await entferneInvalidierteAelterAls(idb, now - 30 * TAG);
    expect(geloescht).toBe(1);
    const rest = (await alleEintraege(idb)).map(e => e.id).sort();
    expect(rest).toEqual(['aktiv-alt', 'inv-frisch']);
  });
});

describe('Gedächtnis-Facade — Opt-in + Lauf-Meta', () => {
  it('Opt-in wird persistiert + gecacht; aktive Einträge werden gefiltert', async () => {
    await frischerStore();
    expect(istGedaechtnisAktiv()).toBe(false);
    await setzeGedaechtnisAktiv(true);
    expect(istGedaechtnisAktiv()).toBe(true);

    await persistiereEintraege([
      eintrag({ id: 'a', status: 'aktiv' }),
      eintrag({ id: 'b', status: 'invalidiert' }),
    ]);
    const aktive = await ladeAktiveEintraege();
    expect(aktive.map(e => e.id)).toEqual(['a']);
  });

  it('Lauf-Meta roundtrip (kv)', async () => {
    await frischerStore();
    expect(await ladeLaufMeta()).toBeNull();
    const meta: LaufMeta = {
      letzterLauf: 123,
      wasserzeichen: 100,
      angewandt: 3,
      verworfen: 1,
      fehler: false,
    };
    await schreibeLaufMeta(meta);
    expect(await ladeLaufMeta()).toEqual(meta);
  });
});

describe('Gedächtnis-Store — Snapshot-Ausschluss (Invariante 1)', () => {
  it('der Store steht in keiner Snapshot-Allowlist (Write + Sync)', () => {
    const snapshotSrc = readFileSync(new URL('../../../csv/snapshot.ts', import.meta.url), 'utf-8');
    const syncSrc = readFileSync(new URL('../../../csv/snapshot-sync.ts', import.meta.url), 'utf-8');
    expect(snapshotSrc).not.toContain(GEDAECHTNIS_STORE);
    expect(syncSrc).not.toContain(GEDAECHTNIS_STORE);
  });
});
