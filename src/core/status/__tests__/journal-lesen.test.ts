/**
 * Das Lesen des Journals — Chronik, Nachtlauf, und die Anbindung an den Wächter.
 *
 * Der Kern hier: **belegt ist nicht dasselbe wie genähert**. Das jüngste
 * `D_`-Datum ist eine Untergrenze (mehrfach gesetzte Kürzel tragen nur das
 * letzte Datum, V9); das Journal kennt die echte Änderung. Beides darf nie
 * gleich aussehen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { JournalStand } from '@/core/status/journal/typen';

const share: { stand: JournalStand | null; dateien: Record<string, string> } = {
  stand: null, dateien: {},
};

vi.mock('@/core/status/sidecar-datei', async (echt) => {
  const original = await echt<typeof import('@/core/status/sidecar-datei')>();
  return {
    ...original,
    leseSidecar: async () => share.stand,
    leseSidecarText: async (_idb: IDBStore, pfad: string) => share.dateien[pfad] ?? null,
  };
});

const { chronikFuerAntrag, letzterNachtLauf, letzteAenderungJeAntrag, leereJournalCache } =
  await import('@/core/status/journal/lesen');
const { pruefeStillstand } = await import('@/core/status/waechter');

const IDB = {} as IDBStore;
const PFAD = '_intern/vorgangssystem/journal/journal-2026-08.jsonl';

const z = (o: Record<string, unknown>): string => JSON.stringify(o);

beforeEach(() => {
  leereJournalCache();
  share.stand = {
    schema: 1,
    journalAb: '2026-08-01',
    letzterStempel: { id: 's2', datum: '2026-08-05' },
    verarbeitet: ['s2', 's1'],
    bereich: ['76'],
    werte: { A1: { D_ARZ: 20260805 } },
  };
  share.dateien = {
    [PFAD]: [
      z({ stempel: 's1', antragId: 'A1', art: 'gesetzt', feld: 'D_ARZ', nach: 20260802, datum: '2026-08-02' }),
      // Dieselbe Zeile doppelt — ein abgebrochener Lauf hat sie zweimal erzeugt.
      z({ stempel: 's1', antragId: 'A1', art: 'gesetzt', feld: 'D_ARZ', nach: 20260802, datum: '2026-08-02' }),
      z({ stempel: 's2', antragId: 'A1', art: 'geaendert', feld: 'D_ARZ', von: 20260802, nach: 20260805, datum: '2026-08-05' }),
      z({ stempel: 's2', antragId: 'A2', art: 'antrag-neu', datum: '2026-08-05' }),
    ].join('\n'),
  };
});

describe('Chronik je Antrag', () => {
  it('gruppiert nach Feld, aufsteigend nach Datum, und entdoppelt', async () => {
    const c = await chronikFuerAntrag(IDB, 'A1', '2026-08-06');
    expect(c?.felder).toHaveLength(1);
    expect(c?.felder[0]?.feld).toBe('D_ARZ');
    expect(c?.felder[0]?.eintraege.map(e => e.art)).toEqual(['gesetzt', 'geaendert']);
    expect(c?.letzteAenderung).toBe('2026-08-05');
  });

  it('nennt den Nullpunkt — sonst gilt eine Teil-Chronik als vollständig', async () => {
    expect((await chronikFuerAntrag(IDB, 'A1', '2026-08-06'))?.journalAb).toBe('2026-08-01');
  });

  it('unterscheidet „nichts passiert" von „wird nicht geführt"', async () => {
    // A2 steht im Journal, aber nicht im Stand: außerhalb des Bereichs.
    const a2 = await chronikFuerAntrag(IDB, 'A2', '2026-08-06');
    expect(a2?.gefuehrt).toBe(false);
    // A1 steht im Stand und hat Einträge.
    expect((await chronikFuerAntrag(IDB, 'A1', '2026-08-06'))?.gefuehrt).toBe(true);
  });

  it('liefert nichts, wenn es kein Journal gibt', async () => {
    share.stand = null;
    leereJournalCache();
    expect(await chronikFuerAntrag(IDB, 'A1', '2026-08-06')).toBeNull();
  });
});

describe('Letzter Nachtlauf', () => {
  it('zeigt nur die Einträge des jüngsten Stempels', async () => {
    const l = await letzterNachtLauf(IDB);
    expect(l?.stempel).toBe('s2');
    expect(l?.eintraege.map(e => e.antragId)).toEqual(['A1', 'A2']);
  });

  it('meldet einen leeren Lauf als leer, nicht als fehlend', async () => {
    share.stand = { ...share.stand!, letzterStempel: { id: 's9', datum: '2026-08-06' } };
    leereJournalCache();
    const l = await letzterNachtLauf(IDB);
    expect(l).not.toBeNull();
    expect(l?.eintraege).toEqual([]);
  });
});

describe('Letzte Änderung je Antrag', () => {
  it('liefert je Antrag das jüngste Datum', async () => {
    const m = await letzteAenderungJeAntrag(IDB, '2026-08-06');
    expect(m?.get('A1')).toBe('2026-08-05');
    expect(m?.get('A2')).toBe('2026-08-05');
  });
});

describe('Wächter: belegt vs. genähert', () => {
  const version = { version: 1, autor: null, zeitstempel: '', felder: [], werte: [] } as never;

  it('ohne Journal bleibt es bei der Näherung und sagt „mindestens"', () => {
    const e = pruefeStillstand({
      version, vorkommen: [], statusCode: null, stichtag: '2026-08-10T00:00:00.000Z',
    });
    expect(e.belegt).toBe(false);
  });

  it('mit Journal gilt dessen Datum und die Zahl steht ohne Vorbehalt', () => {
    const e = pruefeStillstand({
      version, vorkommen: [], statusCode: null,
      journalAenderung: '2026-08-05', stichtag: '2026-08-10T00:00:00.000Z',
    });
    expect(e.belegt).toBe(true);
    expect(e.letzteAktivitaet).toBe('2026-08-05');
    expect(e.tage).toBe(5);
  });

  it('ein leerer Journal-Wert zählt NICHT als Beleg', () => {
    for (const wert of [null, undefined, '']) {
      const e = pruefeStillstand({
        version, vorkommen: [], statusCode: null,
        journalAenderung: wert, stichtag: '2026-08-10T00:00:00.000Z',
      });
      expect(e.belegt, String(wert)).toBe(false);
    }
  });
});
