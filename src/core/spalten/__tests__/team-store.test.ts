/**
 * Team-Spalten: die Reichweite muss halten, auch wenn die Datei lügt.
 *
 * Die Sidecar liegt im Klartext auf dem Share und lässt sich von Hand
 * editieren. Die beiden Ablagen dürfen sich deshalb nicht auf die Disziplin
 * ihrer Schreiber verlassen, sondern filtern beim LESEN auf ihre eigene
 * Herkunft — sonst schöbe eine `frei:ich:`-Zeile in der Team-Datei allen
 * Kolleginnen eine „persönliche" Spalte unter.
 *
 * Der zweite Punkt ist das Schreib-Gate: ohne `readwrite` darf nichts auf den
 * Share gehen — und der Aufrufer muss das ERFAHREN (`false`), statt einen
 * Erfolg zu sehen, den es nicht gab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const handleSpy = vi.fn();
const permissionSpy = vi.fn();
vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: () => handleSpy(),
  queryPermission: () => permissionSpy(),
}));

const atomicWriteSpy = vi.fn();
const readTextSpy = vi.fn();
vi.mock('@/core/services/infrastructure/atomic-write', () => ({
  atomicWrite: (...args: unknown[]) => atomicWriteSpy(...args),
  readText: () => readTextSpy(),
}));

import {
  leseTeamDatei, ladeTeamSpalten, schreibeTeamSpalten, TEAM_SPALTEN_CACHE_KEY, TEAM_SPALTEN_PATH,
} from '../team-store';
import { nurHerkunft, leseSpaltenListe } from '../lesen';
import { speicherePersoenlicheSpalten, EIGENE_SPALTEN_IDB_KEY } from '../store';
import type { EigeneSpalte } from '../typen';
import type { IDBStore } from '@/core/services/storage/idb-store';

const teamSpalte: EigeneSpalte = {
  id: 'frei:team:restlaufzeit', art: 'feld', label: 'Restlaufzeit', feldId: 'D_AAE', typ: 'datum',
};
const meineSpalte: EigeneSpalte = {
  id: 'frei:ich:restlaufzeit', art: 'feld', label: 'Restlaufzeit', feldId: 'D_AAE', typ: 'datum',
};

/** Minimaler kv-Store — nur was die beiden Ablagen anfassen. */
function fakeIdb(): IDBStore & { daten: Map<string, unknown> } {
  const daten = new Map<string, unknown>();
  return {
    daten,
    get: async (k: string) => daten.get(k),
    set: async (k: string, v: unknown) => { daten.set(k, v); },
    delete: async (k: string) => { daten.delete(k); },
  } as unknown as IDBStore & { daten: Map<string, unknown> };
}

beforeEach(() => {
  handleSpy.mockReset();
  permissionSpy.mockReset();
  atomicWriteSpy.mockReset();
  readTextSpy.mockReset();
});

describe('Herkunft filtert beim Lesen', () => {
  it('die Team-Datei liefert KEINE persönliche Definition aus', () => {
    const roh = { version: 1, spalten: [teamSpalte, meineSpalte] };
    expect(leseTeamDatei(roh).map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
  });

  it('die persönliche Ablage speichert KEINE Team-Definition', async () => {
    const idb = fakeIdb();
    await speicherePersoenlicheSpalten(idb, [teamSpalte, meineSpalte]);
    const abgelegt = idb.daten.get(EIGENE_SPALTEN_IDB_KEY) as EigeneSpalte[];
    expect(abgelegt.map(s => s.id)).toEqual(['frei:ich:restlaufzeit']);
  });

  it('eine Liste NUR aus Team-Definitionen löscht die persönliche Ablage', async () => {
    const idb = fakeIdb();
    idb.daten.set(EIGENE_SPALTEN_IDB_KEY, [meineSpalte]);
    await speicherePersoenlicheSpalten(idb, [teamSpalte]);
    expect(idb.daten.has(EIGENE_SPALTEN_IDB_KEY)).toBe(false);
  });

  it('tolerant: eine kaputte Definition nimmt die anderen nicht mit', () => {
    const roh = {
      spalten: [
        { id: 'frei:team:kaputt' },                 // ohne label
        { id: 'ganz-fremd', label: 'X', art: 'feld', feldId: 'A' }, // keine freie Id
        teamSpalte,
      ],
    };
    expect(leseTeamDatei(roh).map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
  });

  it('nurHerkunft trennt in beide Richtungen', () => {
    const beide = [teamSpalte, meineSpalte];
    expect(nurHerkunft(beide, 'team')).toEqual([teamSpalte]);
    expect(nurHerkunft(beide, 'ich')).toEqual([meineSpalte]);
    expect(leseSpaltenListe([teamSpalte, teamSpalte])).toHaveLength(1);
  });
});

describe('Schreib-Gate', () => {
  it('ohne Share wird nichts geschrieben und `false` gemeldet', async () => {
    handleSpy.mockResolvedValue(null);
    expect(await schreibeTeamSpalten(fakeIdb(), [teamSpalte])).toBe(false);
    expect(atomicWriteSpy).not.toHaveBeenCalled();
  });

  it('ohne Schreibrecht wird nichts geschrieben und `false` gemeldet', async () => {
    handleSpy.mockResolvedValue({});
    permissionSpy.mockResolvedValue('prompt');
    expect(await schreibeTeamSpalten(fakeIdb(), [teamSpalte])).toBe(false);
    expect(atomicWriteSpy).not.toHaveBeenCalled();
  });

  it('mit Recht landet die Datei atomar am vereinbarten Pfad', async () => {
    handleSpy.mockResolvedValue({});
    permissionSpy.mockResolvedValue('granted');
    const idb = fakeIdb();
    expect(await schreibeTeamSpalten(idb, [teamSpalte, meineSpalte])).toBe(true);
    expect(atomicWriteSpy).toHaveBeenCalledTimes(1);
    const [, pfad, inhalt] = atomicWriteSpy.mock.calls[0] as [unknown, string, string];
    expect(pfad).toBe(TEAM_SPALTEN_PATH);
    const datei = JSON.parse(inhalt) as { version: number; spalten: EigeneSpalte[] };
    expect(datei.version).toBe(1);
    // Die persönliche Definition darf NICHT in die geteilte Datei rutschen.
    expect(datei.spalten.map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
  });

  it('ein gescheiterter Write meldet `false` (und behauptet keinen Erfolg)', async () => {
    handleSpy.mockResolvedValue({});
    permissionSpy.mockResolvedValue('granted');
    atomicWriteSpy.mockRejectedValue(new Error('Share weg'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await schreibeTeamSpalten(fakeIdb(), [teamSpalte])).toBe(false);
    spy.mockRestore();
  });
});

describe('Lesen: Share, Cache, und der Unterschied zwischen beiden', () => {
  it('liest vom Share und legt den Stand in den Cache', async () => {
    handleSpy.mockResolvedValue({});
    readTextSpy.mockResolvedValue(JSON.stringify({ version: 1, spalten: [teamSpalte] }));
    const idb = fakeIdb();
    expect((await ladeTeamSpalten(idb)).map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
    expect(idb.daten.get(TEAM_SPALTEN_CACHE_KEY)).toHaveLength(1);
  });

  it('eine FEHLENDE Datei leert den Cache — eine gelöschte Spalte bleibt gelöscht', async () => {
    handleSpy.mockResolvedValue({});
    readTextSpy.mockResolvedValue(null);
    const idb = fakeIdb();
    idb.daten.set(TEAM_SPALTEN_CACHE_KEY, [teamSpalte]);
    expect(await ladeTeamSpalten(idb)).toEqual([]);
    expect(idb.daten.get(TEAM_SPALTEN_CACHE_KEY)).toEqual([]);
  });

  it('ein UNERREICHBARER Share fällt auf den Cache zurück', async () => {
    handleSpy.mockResolvedValue(null);
    const idb = fakeIdb();
    idb.daten.set(TEAM_SPALTEN_CACHE_KEY, [teamSpalte]);
    expect((await ladeTeamSpalten(idb)).map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
  });

  it('kaputtes JSON auf dem Share wirft nicht, sondern nimmt den Cache', async () => {
    handleSpy.mockResolvedValue({});
    readTextSpy.mockResolvedValue('{kein json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const idb = fakeIdb();
    idb.daten.set(TEAM_SPALTEN_CACHE_KEY, [teamSpalte]);
    expect((await ladeTeamSpalten(idb)).map(s => s.id)).toEqual(['frei:team:restlaufzeit']);
    spy.mockRestore();
  });
});
