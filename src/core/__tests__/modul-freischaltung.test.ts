/**
 * Der Schnitt vor der Anmeldung (v3.27).
 *
 * Eine Freischaltung ist eine Aussage ueber die zuletzt getippte Anmeldung, nicht
 * ueber die naechsten 12 Stunden. Ohne diesen Schnitt zeigte eine Anmeldung mit
 * dem Basis-Passwort weiter, was eine fruehere Sitzung mit einem Modul-Passwort
 * geoeffnet hatte — beobachtet in zah-pl v3.25, wo beide Menues unabhaengig vom
 * getippten Passwort erschienen.
 *
 * Der Schloss-Test kommt als Parameter herein, weil Vitest `__TEAMFLOW_CONFIG__`
 * fest auf eine Config OHNE `moduleAuth` verdrahtet — `hatModulSchloss` waere hier
 * immer `false` und der interessante Fall nicht erreichbar (gleiche Begruendung
 * wie bei `modul-schloss.ts`).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { IDBStore } from '@/core/services/storage/idb-store';
import { KURATOR_SESSION_META_IDB_KEY, MODUL_FREISCHALTUNG_IDB_KEY } from '@/core/services/infrastructure/types';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { schliesseGesperrteModule } from '../modul-freischaltung';

const idb = new IDBStore();

const MIT_SCHLOSS = (): boolean => true;
const OHNE_SCHLOSS = (): boolean => false;

beforeAll(async () => {
  await idb.open();
});

beforeEach(async () => {
  // Ausgangslage: beide Module offen, wie nach einer frueheren Sitzung.
  await useModulFreischaltung.getState().freischalten(idb);
  await useKuratorSession.getState().aktiviere(idb, 'Test · Kurator');
});

describe('schliesseGesperrteModule', () => {
  it('schliesst beide Module und raeumt ihre IDB-Eintraege weg', async () => {
    await schliesseGesperrteModule(idb, MIT_SCHLOSS);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
    expect(useKuratorSession.getState().isActive).toBe(false);
    // Nicht nur der Zustand — sonst holt der naechste `rehydrate` alles zurueck.
    expect(await idb.get(MODUL_FREISCHALTUNG_IDB_KEY)).toBeNull();
    expect(await idb.get(KURATOR_SESSION_META_IDB_KEY)).toBeNull();
  });

  it('laesst Module OHNE Schloss unangetastet', async () => {
    // dev/local tragen kein moduleAuth. Wuerde hier trotzdem geschlossen, wuerfe
    // jeder Start der Abnahme-Umgebung die laufende Kurator-Session weg.
    await schliesseGesperrteModule(idb, OHNE_SCHLOSS);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(true);
    expect(useKuratorSession.getState().isActive).toBe(true);
  });

  it('ist ohne offene Freischaltung ein No-op', async () => {
    await schliesseGesperrteModule(idb, MIT_SCHLOSS);
    await schliesseGesperrteModule(idb, MIT_SCHLOSS);

    expect(useModulFreischaltung.getState().auslastungFrei).toBe(false);
    expect(useKuratorSession.getState().isActive).toBe(false);
  });
});
