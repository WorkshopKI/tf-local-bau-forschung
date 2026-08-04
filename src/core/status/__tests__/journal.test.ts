/**
 * Der Journal-Kern. Was hier festgehalten wird:
 *
 * 1. **Fünf Eintragsarten, fünf Aussagen** — insbesondere `geleert`: dass jemand
 *    in C16 eine Setzung zurückgenommen hat, ist heute vollständig unsichtbar.
 * 2. **Der Baseline-Lauf erzeugt KEINE Einträge.** Ohne diese Regel stünden beim
 *    ersten Lauf hunderttausend Phantom-„gesetzt" in der Datei.
 * 3. **Ein Bereichswechsel ist keine Änderung.** Neu hinzugekommene Anträge
 *    haben keine Vorgeschichte im Stand — sie bekommen eine Baseline, keine
 *    `antrag-neu`-Flut.
 * 4. **Keine Bearbeiterspalte.** Das Journal beantwortet „was hat sich
 *    geändert", nicht „wer war das".
 */
import { describe, it, expect } from 'vitest';
import {
  baueJournalFelder, istJournalSpalte, JOURNAL_AUSGESCHLOSSEN,
} from '@/core/status/journal/felder';
import { alsTagesZahl, projiziereAntrag, projiziereExport } from '@/core/status/journal/projektion';
import { berechneDiff, dedupliziere, istUnscharf } from '@/core/status/journal/diff';
import { merkeStempel } from '@/core/status/journal/stand';
import { monateZwischen, journalMonatsPfad } from '@/core/status/journal/pfade';
import { alsIsoTag } from '@/core/status/journal/stempel';
import { VERARBEITET_MAX, type JournalWerte, type Stempel } from '@/core/status/journal/typen';

const STEMPEL: Stempel = { id: 'abc123def456', datum: '2026-08-03' };
const META = { stempel: STEMPEL, vorherDatum: '2026-08-02' };

describe('Feldauswahl', () => {
  it('nimmt Kürzel-Spalten und die beiden Status-Spalten', () => {
    expect(istJournalSpalte('D_ARZ')).toBe(true);
    expect(istJournalSpalte('d_xpc+')).toBe(true);
    expect(istJournalSpalte('STATUS_TV')).toBe(true);
    expect(istJournalSpalte('STATUS_VB')).toBe(true);
  });

  it('lässt alles andere draußen — kein generischer Spalten-Diff', () => {
    for (const s of ['AKTENZEICHEN', 'T_AAI', 'ZUW_MU_FST', 'FM_NUMMER', 'VB_TITEL']) {
      expect(istJournalSpalte(s), s).toBe(false);
    }
  });

  it('schließt JEDE Bearbeiterspalte aus — das ist die Datenschutz-Zusage', () => {
    for (const s of JOURNAL_AUSGESCHLOSSEN) {
      expect(istJournalSpalte(s), s).toBe(false);
      expect(istJournalSpalte(s.toLowerCase()), s).toBe(false);
    }
    // Und keine davon trägt versehentlich das D_-Präfix.
    expect(JOURNAL_AUSGESCHLOSSEN.every(s => !s.startsWith('D_'))).toBe(true);
  });

  it('entdoppelt Spalten und markiert Datumsfelder', () => {
    const felder = baueJournalFelder(['D_ARZ', 'd_arz', 'STATUS_TV', 'AKTENZEICHEN']);
    expect(felder.map(f => f.spalte)).toEqual(['D_ARZ', 'STATUS_TV']);
    expect(felder.find(f => f.spalte === 'D_ARZ')?.datum).toBe(true);
    expect(felder.find(f => f.spalte === 'STATUS_TV')?.datum).toBe(false);
  });
});

describe('Projektion', () => {
  const FELDER = baueJournalFelder(['D_ARZ', 'STATUS_TV', 'AKTENZEICHEN', 'FM_NUMMER']);

  it('speichert Datumswerte als YYYYMMDD-Zahl', () => {
    expect(alsTagesZahl('03.08.2026')).toBe(20260803);
    expect(alsTagesZahl('2026-08-03')).toBe(20260803);
    expect(alsTagesZahl('kein Datum')).toBeNull();
  });

  it('lässt leere Werte als Schlüssel WEG — das hält die Datei klein', () => {
    const p = projiziereAntrag({ D_ARZ: '  ', STATUS_TV: 'beantragt' }, FELDER);
    expect(p).toEqual({ STATUS_TV: 'beantragt' });
    expect('D_ARZ' in p).toBe(false);
  });

  it('führt ein Datumsfeld mit Freitext als Text statt es wegzuwerfen', () => {
    expect(projiziereAntrag({ D_ARZ: 'siehe Akte' }, FELDER)).toEqual({ D_ARZ: 'siehe Akte' });
  });

  it('filtert über den EXPLIZITEN Bereichs-Parameter, nicht still', () => {
    const zeilen = [
      { AKTENZEICHEN: 'A1', FM_NUMMER: '76', D_ARZ: '01.08.2026' },
      { AKTENZEICHEN: 'A2', FM_NUMMER: '47', D_ARZ: '01.08.2026' },
      { AKTENZEICHEN: '', FM_NUMMER: '76', D_ARZ: '01.08.2026' },
    ];
    const p = projiziereExport(zeilen, FELDER, 'AKTENZEICHEN', z => z.FM_NUMMER === '76');
    expect(Object.keys(p)).toEqual(['A1']);
  });
});

describe('Diff — die fünf Eintragsarten', () => {
  it('gesetzt: leer → Wert', () => {
    const e = berechneDiff({ A1: {} }, { A1: { D_ARZ: 20260803 } }, META);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ art: 'gesetzt', feld: 'D_ARZ', nach: 20260803, antragId: 'A1' });
    expect(e[0]!.von).toBeUndefined();
  });

  it('geaendert: Wert → anderer Wert', () => {
    const e = berechneDiff({ A1: { D_ARZ: 20260801 } }, { A1: { D_ARZ: 20260803 } }, META);
    expect(e[0]).toMatchObject({ art: 'geaendert', von: 20260801, nach: 20260803 });
  });

  it('geleert: Wert → leer — heute unsichtbar, genau darum geht es', () => {
    const e = berechneDiff({ A1: { D_ARZ: 20260801 } }, { A1: {} }, META);
    expect(e[0]).toMatchObject({ art: 'geleert', feld: 'D_ARZ', von: 20260801 });
    expect(e[0]!.nach).toBeUndefined();
  });

  it('antrag-neu: EIN Eintrag je Antrag, nicht je Feld', () => {
    const e = berechneDiff({}, { A1: { D_ARZ: 20260803, STATUS_TV: 'beantragt' } }, META);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ art: 'antrag-neu', antragId: 'A1' });
    expect(e[0]!.feld).toBeUndefined();
  });

  it('antrag-fehlt: festhalten, nichts löschen', () => {
    const e = berechneDiff({ A1: { D_ARZ: 20260801 } }, {}, META);
    expect(e).toEqual([expect.objectContaining({ art: 'antrag-fehlt', antragId: 'A1' })]);
  });

  it('meldet nichts, wenn sich nichts geändert hat', () => {
    const w: JournalWerte = { A1: { D_ARZ: 20260801 } };
    expect(berechneDiff(w, { A1: { D_ARZ: 20260801 } }, META)).toEqual([]);
  });

  it('ist deterministisch sortiert — sonst wäre kein Lauf mit dem nächsten vergleichbar', () => {
    const alt = { B: { D_X: 1 }, A: { D_Y: 1 } };
    const neu = { B: { D_X: 2 }, A: { D_Y: 2 } };
    const e = berechneDiff(alt, neu, META);
    expect(e.map(x => x.antragId)).toEqual(['A', 'B']);
  });
});

describe('Unscharfe Spanne', () => {
  it('ein Tag Abstand ist scharf', () => {
    expect(istUnscharf('2026-08-02', '2026-08-03')).toBe(false);
    const e = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1 } }, META);
    expect(e[0]!.unscharf).toBeUndefined();
  });

  it('mehr als ein Tag wird als ZEITRAUM ausgewiesen, nicht als Datum behauptet', () => {
    expect(istUnscharf('2026-07-31', '2026-08-03')).toBe(true);
    const e = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1 } }, {
      stempel: STEMPEL, vorherDatum: '2026-07-31',
    });
    expect(e[0]).toMatchObject({
      unscharf: true, vonDatum: '2026-07-31', bisDatum: '2026-08-03',
    });
  });
});

describe('Bereichswechsel', () => {
  it('neu im Bereich erzeugt KEIN antrag-neu — wir haben vorher nicht hingesehen', () => {
    const e = berechneDiff({ A1: { D_X: 1 } }, { A1: { D_X: 1 }, A2: { D_X: 5 } }, {
      ...META, neuImBereich: new Set(['A2']),
    });
    expect(e).toEqual([]);
  });

  it('aus dem Bereich gefallen erzeugt KEIN antrag-fehlt', () => {
    const e = berechneDiff({ A1: { D_X: 1 }, A2: { D_X: 5 } }, { A1: { D_X: 1 } }, {
      ...META, ausDemBereich: new Set(['A2']),
    });
    expect(e).toEqual([]);
  });

  it('ohne Bereichswechsel bleibt beides eine echte Meldung', () => {
    const e = berechneDiff({ A1: { D_X: 1 } }, { A2: { D_X: 5 } }, META);
    expect(e.map(x => x.art).sort()).toEqual(['antrag-fehlt', 'antrag-neu']);
  });
});

describe('Dedupe beim Lesen', () => {
  it('entfernt denselben Eintrag aus einem abgebrochenen Lauf', () => {
    // Erst JSONL, dann Stand: bricht es dazwischen ab, erzeugt der nächste Lauf
    // denselben Diff erneut. Lieber doppelt als verloren — das Lesen räumt auf.
    const e = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1 } }, META);
    expect(dedupliziere([...e, ...e])).toHaveLength(1);
  });

  it('behält zwei verschiedene Felder desselben Antrags', () => {
    const e = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1, D_ABB: 2 } }, META);
    expect(dedupliziere(e)).toHaveLength(2);
  });

  it('behält denselben Eintrag aus einem ANDEREN Export', () => {
    const a = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1 } }, META);
    const b = berechneDiff({ A1: {} }, { A1: { D_ARZ: 1 } }, {
      stempel: { id: 'zzz999', datum: '2026-08-04' }, vorherDatum: '2026-08-03',
    });
    expect(dedupliziere([...a, ...b])).toHaveLength(2);
  });
});

describe('Ringpuffer der Stempel', () => {
  it('setzt den neuesten nach vorn und entdoppelt', () => {
    expect(merkeStempel(['b', 'a'], 'a')).toEqual(['a', 'b']);
  });

  it('deckelt bei VERARBEITET_MAX', () => {
    const viele = Array.from({ length: VERARBEITET_MAX + 50 }, (_, i) => `s${i}`);
    expect(merkeStempel(viele, 'neu')).toHaveLength(VERARBEITET_MAX);
    expect(merkeStempel(viele, 'neu')[0]).toBe('neu');
  });
});

describe('Monatsdateien', () => {
  it('leitet den Pfad aus dem Tag ab', () => {
    expect(journalMonatsPfad('2026-08-03'))
      .toBe('_intern/vorgangssystem/journal/journal-2026-08.jsonl');
  });

  it('zählt die Monate über den Jahreswechsel', () => {
    expect(monateZwischen('2025-11-20', '2026-02-01'))
      .toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('liefert nichts, wenn das Ende vor dem Anfang liegt', () => {
    expect(monateZwischen('2026-08-01', '2026-07-01')).toEqual([]);
  });
});

describe('Stempel-Datum', () => {
  it('nimmt den ISO-Tag der Export-Datei, nicht den Importzeitpunkt', () => {
    expect(alsIsoTag(Date.parse('2026-08-03T22:15:00.000Z'))).toBe('2026-08-03');
  });
});
