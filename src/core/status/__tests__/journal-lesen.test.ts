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

const share: {
  stand: JournalStand | null;
  dateien: Record<string, string>;
  /** Wie oft der Stand wirklich vom Share gelesen wurde — der Cache-Nachweis. */
  standGelesen: number;
} = { stand: null, dateien: {}, standGelesen: 0 };

vi.mock('@/core/status/sidecar-datei', async (echt) => {
  const original = await echt<typeof import('@/core/status/sidecar-datei')>();
  return {
    ...original,
    leseSidecar: async () => { share.standGelesen += 1; return share.stand; },
    leseSidecarText: async (_idb: IDBStore, pfad: string) => share.dateien[pfad] ?? null,
  };
});

const {
  chronikFuerAntrag, letzterNachtLauf, nachtLaeufeSeit, letzteAenderungJeAntrag,
  leereJournalCache,
  bewerteAlter, journalFrische, JOURNAL_FRISCHE_WARNUNG_TAGE,
} = await import('@/core/status/journal/lesen');
const { pruefeStillstand } = await import('@/core/status/waechter');
const { markiereBestandGeaendert } = await import('@/core/services/bestand-generation');

const IDB = {} as IDBStore;
const PFAD = '_intern/vorgangssystem/journal/journal-2026-08.jsonl';

const z = (o: Record<string, unknown>): string => JSON.stringify(o);

beforeEach(() => {
  leereJournalCache();
  share.standGelesen = 0;
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

  it('brachte der jüngste Export nichts, steht der letzte Lauf MIT Änderungen da', async () => {
    // Am echten Bestand trugen 4 von 9 verarbeiteten Stempeln keinen Eintrag
    // (20.08.2026). Ein Widget, das darauf „nichts geändert" sagt, verbirgt
    // die echten Änderungen von vorgestern hinter einem Leerlauf.
    share.stand = { ...share.stand!, letzterStempel: { id: 's9', datum: '2026-08-06' } };
    leereJournalCache();
    const l = await letzterNachtLauf(IDB);
    expect(l?.stempel).toBe('s2');
    expect(l?.datum).toBe('2026-08-05');
    expect(l?.eintraege.map(e => e.antragId)).toEqual(['A1', 'A2']);
    // … und sagt, WELCHER Lauf leer ausging — sonst läse man alte Änderungen
    // als die von heute Nacht.
    expect(l?.ersatzFuer).toEqual({ stempel: 's9', datum: '2026-08-06' });
  });

  it('ist auch der Ersatz leer, bleibt es bei einem leeren Lauf (nicht null)', async () => {
    share.stand = { ...share.stand!, letzterStempel: { id: 's9', datum: '2026-08-06' } };
    share.dateien = {};
    leereJournalCache();
    const l = await letzterNachtLauf(IDB);
    expect(l).not.toBeNull();
    expect(l?.stempel).toBe('s9');
    expect(l?.eintraege).toEqual([]);
    expect(l?.ersatzFuer).toBeUndefined();
  });
});

describe('Zeitfenster über mehrere Läufe', () => {
  it('sammelt alle Läufe im Fenster, jüngster zuerst', async () => {
    const f = await nachtLaeufeSeit(IDB, 7, '2026-08-06');
    expect(f?.laeufe).toEqual([
      { stempel: 's2', datum: '2026-08-05' },
      { stempel: 's1', datum: '2026-08-02' },
    ]);
    // Entdoppelt wie überall: die vier Zeilen tragen eine Dublette.
    expect(f?.eintraege).toHaveLength(3);
  });

  it('zählt einschließlich heute: 2 Tage sind heute und gestern', async () => {
    const f = await nachtLaeufeSeit(IDB, 2, '2026-08-06');
    expect(f?.vonDatum).toBe('2026-08-05');
    expect(f?.laeufe.map(l => l.stempel)).toEqual(['s2']);
    expect(f?.eintraege).toHaveLength(2);
  });

  it('klemmt auf den Nullpunkt — das Fenster verspricht nie mehr als das Journal hat', async () => {
    const f = await nachtLaeufeSeit(IDB, 60, '2026-08-06');
    expect(f?.vonDatum).toBe('2026-08-01');
    expect(f?.journalAb).toBe('2026-08-01');
  });

  it('greift NICHT vor das Fenster zurück, wenn nichts drin steht', async () => {
    // Anders als `letzterNachtLauf`: das Fenster macht eine Zusage über einen
    // Zeitraum, und ein heimlicher Griff davor würde sie brechen.
    const f = await nachtLaeufeSeit(IDB, 1, '2026-08-10');
    expect(f).not.toBeNull();
    expect(f?.eintraege).toEqual([]);
    expect(f?.laeufe).toEqual([]);
    expect(f?.vonDatum).toBe('2026-08-10');
  });

  it('liest über den Monatswechsel hinweg', async () => {
    share.stand = { ...share.stand!, journalAb: '2026-07-01' };
    share.dateien['_intern/vorgangssystem/journal/journal-2026-07.jsonl'] =
      z({ stempel: 's0', antragId: 'A3', art: 'gesetzt', feld: 'D_AB', nach: 20260730, datum: '2026-07-30' });
    leereJournalCache();
    const f = await nachtLaeufeSeit(IDB, 10, '2026-08-06');
    expect(f?.vonDatum).toBe('2026-07-28');
    expect(f?.laeufe.map(l => l.stempel)).toEqual(['s2', 's1', 's0']);
  });

  it('ohne Journal null — „noch keines" ist etwas anderes als „nichts gefunden"', async () => {
    share.stand = null;
    leereJournalCache();
    expect(await nachtLaeufeSeit(IDB, 7, '2026-08-06')).toBeNull();
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

describe('Frische — ein ausgefallener Lauf muss auffallen', () => {
  it('warnt erst jenseits der Schwelle: ein Freitags-Export ist am Montag ok', () => {
    // Drei Tage sind ein Wochenende, kein Ausfall. Ab vier ist es einer.
    expect(bewerteAlter('2026-08-05', '2026-08-07')).toEqual({ tageAlt: 2, veraltet: false });
    expect(bewerteAlter('2026-08-05', '2026-08-08'))
      .toEqual({ tageAlt: JOURNAL_FRISCHE_WARNUNG_TAGE, veraltet: false });
    expect(bewerteAlter('2026-08-05', '2026-08-09')).toEqual({ tageAlt: 4, veraltet: true });
  });

  it('klemmt ein Export-Datum aus der Zukunft auf 0 statt negativ zu zaehlen', () => {
    // Ein `lastModified` nach heute ist ein Uhr-Artefakt, kein frischerer Stand.
    expect(bewerteAlter('2026-08-10', '2026-08-05')).toEqual({ tageAlt: 0, veraltet: false });
  });

  it('liefert Stempel, Nullpunkt und die Eintraege des laufenden Monats', async () => {
    const f = await journalFrische(IDB, '2026-08-06');
    expect(f).toMatchObject({
      journalAb: '2026-08-01',
      stempel: { id: 's2', datum: '2026-08-05' },
      tageAlt: 1,
      veraltet: false,
      monat: '2026-08',
    });
    // Entdoppelt: die vier Zeilen enthalten eine Dublette aus einem
    // abgebrochenen Lauf.
    expect(f?.eintraegeImMonat).toBe(3);
  });

  it('meldet den Ausfall, sobald der letzte Export zu lange her ist', async () => {
    const f = await journalFrische(IDB, '2026-08-20');
    expect(f).toMatchObject({ tageAlt: 15, veraltet: true });
  });

  it('ohne Stand null — „noch nicht angelegt" ist etwas anderes als „nichts passiert"', async () => {
    share.stand = null;
    expect(await journalFrische(IDB, '2026-08-06')).toBeNull();
  });

  it('zaehlt 0 Eintraege, wenn der laufende Monat noch keine Datei hat', async () => {
    const f = await journalFrische(IDB, '2026-09-02');
    expect(f?.monat).toBe('2026-09');
    expect(f?.eintraegeImMonat).toBe(0);
  });
});


describe('Der Stand wird je Sitzung EINMAL gelesen', () => {
  // Er wiegt ueber tausende Antraege mehrere MB und liegt auf einem SMB-Share.
  // Bis v4.103 las ihn jeder Board-Aufruf und jede Antragsseite neu.
  it('zwei Leser derselben Generation teilen einen Lesevorgang', async () => {
    await letzteAenderungJeAntrag(IDB, '2026-08-06');
    expect(share.standGelesen).toBe(1);
    await letzteAenderungJeAntrag(IDB, '2026-08-06');
    await chronikFuerAntrag(IDB, 'A1', '2026-08-06');
    expect(share.standGelesen).toBe(1);
  });

  it('nach einem Bestandswechsel wird neu gelesen', async () => {
    await letzteAenderungJeAntrag(IDB, '2026-08-06');
    expect(share.standGelesen).toBe(1);
    markiereBestandGeaendert();
    await letzteAenderungJeAntrag(IDB, '2026-08-06');
    expect(share.standGelesen).toBe(2);
  });

  it('auch ein FEHLENDER Stand wird gecacht', async () => {
    // Sonst zahlt eine Installation ohne Journal je Aufruf einen
    // fehlschlagenden SMB-Zugriff — und genau dort ist er am teuersten.
    share.stand = null;
    leereJournalCache();
    share.standGelesen = 0;
    expect(await letzteAenderungJeAntrag(IDB, '2026-08-06')).toBeNull();
    expect(await letzteAenderungJeAntrag(IDB, '2026-08-06')).toBeNull();
    expect(share.standGelesen).toBe(1);
  });
});
