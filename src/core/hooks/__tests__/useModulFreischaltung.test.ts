/**
 * Freischalt-Store: Persistenz, Ablauf, Aufraeumen (v3.0).
 *
 * Der wichtigste Fall ist der ABGELAUFENE Eintrag: er darf nicht nur ignoriert,
 * sondern muss geloescht werden — sonst bleibt eine Leiche in der IDB liegen, die
 * bei jedem Start erneut geprueft wird und im State-Inspector nach einer
 * bestehenden Freischaltung aussieht.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { IDBStore } from '@/core/services/storage/idb-store';
import { MODUL_FREISCHALTUNG_IDB_KEY } from '@/core/services/infrastructure/types';
import { useModulFreischaltung } from '../useModulFreischaltung';

const idb = new IDBStore();

beforeAll(async () => {
  await idb.open();
});

beforeEach(async () => {
  await idb.delete(MODUL_FREISCHALTUNG_IDB_KEY);
  useModulFreischaltung.setState({ auslastungFrei: false, auslastungBis: null });
});

describe('useModulFreischaltung', () => {
  it('freischalten setzt den State und schreibt die IDB-Meta', async () => {
    await useModulFreischaltung.getState().freischalten(idb);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(true);
    const meta = await idb.get<{ auslastungBis?: number }>(MODUL_FREISCHALTUNG_IDB_KEY);
    expect(meta?.auslastungBis).toBeGreaterThan(Date.now());
  });

  it('rehydrate stellt eine gueltige Freischaltung wieder her (uebersteht Reload)', async () => {
    await useModulFreischaltung.getState().freischalten(idb);
    useModulFreischaltung.setState({ auslastungFrei: false, auslastungBis: null });

    await useModulFreischaltung.getState().rehydrate(idb);
    expect(useModulFreischaltung.getState().auslastungFrei).toBe(true);
  });

  it('rehydrate stellt eine ABGELAUFENE Freischaltung nicht her und raeumt sie weg', async () => {
    await idb.set(MODUL_FREISCHALTUNG_IDB_KEY, { auslastungBis: Date.now() - 1000 });

    await useModulFreischaltung.getState().rehydrate(idb);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
    expect(await idb.get(MODUL_FREISCHALTUNG_IDB_KEY)).toBeNull();
  });

  it('rehydrate ohne Eintrag laesst alles gesperrt', async () => {
    await useModulFreischaltung.getState().rehydrate(idb);
    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
  });

  it('sperren loescht State und Meta', async () => {
    await useModulFreischaltung.getState().freischalten(idb);
    await useModulFreischaltung.getState().sperren(idb);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
    expect(await idb.get(MODUL_FREISCHALTUNG_IDB_KEY)).toBeNull();
  });

  it('tick sperrt, sobald die Frist ueberschritten ist', async () => {
    await useModulFreischaltung.getState().freischalten(idb);
    // Frist kuenstlich in die Vergangenheit ziehen.
    useModulFreischaltung.setState({ auslastungBis: Date.now() - 1 });

    useModulFreischaltung.getState().tick(idb);
    await new Promise(r => setTimeout(r, 10));

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
  });

  it('tick laesst eine laufende Freischaltung in Ruhe', async () => {
    await useModulFreischaltung.getState().freischalten(idb);

    useModulFreischaltung.getState().tick(idb);
    await new Promise(r => setTimeout(r, 10));

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(true);
  });
});
