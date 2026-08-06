/**
 * Arbeitsvorrat/Beendet-Split (Journey-Paket 2 Phase 5, eigene Achse seit v3.5).
 *
 * Reine Sektionierungs-Logik des „Alle"-Tabs: terminale Anträge (Kategorie
 * abgeschlossen ∪ abgelehnt, OHNE bewilligt) ins Beendete, der Rest in den
 * Arbeitsvorrat. Plus Aufschlüsselung, effektive Sichtbarkeit (Notbremsen gegen
 * „da ist nichts") und das View-Gate.
 */
import { describe, it, expect } from 'vitest';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import {
  arbeitsvorratSectionOf,
  partitionArbeitsvorrat,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  istBeendetVersteckt,
  hatBeendetAchse,
  BEENDET_OPTIONS,
} from '../arbeitsvorrat';

function a(status: string): { status: ReturnType<typeof asAntragStatusRaw> } {
  return { status: asAntragStatusRaw(status) };
}

describe('arbeitsvorratSectionOf', () => {
  it('terminale Status → Archiv', () => {
    for (const s of ['Schlussvermerk', 'beendet', 'abgebrochen', 'abgelehnt/zurückgezogen']) {
      expect(arbeitsvorratSectionOf(a(s))).toBe('archiv');
    }
  });
  it('nicht-terminale Status → Arbeitsvorrat (inkl. bewilligt + Begleitung)', () => {
    for (const s of ['beantragt', 'bearbeitungsreif', 'NF gestellt', 'bewilligungsreif', 'bewilligt', 'VN geprüft']) {
      expect(arbeitsvorratSectionOf(a(s))).toBe('in_arbeit');
    }
  });
  it('bewilligt ist bewusst NICHT terminal (Begleitphase folgt)', () => {
    expect(arbeitsvorratSectionOf(a('bewilligt'))).toBe('in_arbeit');
  });
});

describe('partitionArbeitsvorrat', () => {
  it('trennt stabil, Eingabe-Reihenfolge bleibt je Sektion erhalten', () => {
    const rows = [a('beantragt'), a('Schlussvermerk'), a('bewilligt'), a('abgelehnt/zurückgezogen'), a('NF gestellt')];
    const { inArbeit, archiv } = partitionArbeitsvorrat(rows);
    expect(inArbeit.map(r => String(r.status))).toEqual(['beantragt', 'bewilligt', 'NF gestellt']);
    expect(archiv.map(r => String(r.status))).toEqual(['Schlussvermerk', 'abgelehnt/zurückgezogen']);
  });
  it('leere Eingabe → zwei leere Sektionen', () => {
    const { inArbeit, archiv } = partitionArbeitsvorrat([]);
    expect(inArbeit).toEqual([]);
    expect(archiv).toEqual([]);
  });
});

describe('archivAufschluesselung', () => {
  it('splittet terminale Anträge in Schlussvermerk vs. abgelehnt/zurückgezogen, ignoriert nicht-terminale', () => {
    const rows = [
      a('Schlussvermerk'), a('beendet'), a('abgebrochen'),
      a('abgelehnt/zurückgezogen'),
      a('beantragt'), a('bewilligt'),
    ];
    expect(archivAufschluesselung(rows)).toEqual({ schlussvermerk: 3, abgelehntZurueckgezogen: 1 });
  });
  it('leere Liste → beide null', () => {
    expect(archivAufschluesselung([])).toEqual({ schlussvermerk: 0, abgelehntZurueckgezogen: 0 });
  });
});

describe('formatArchivAufschluesselung', () => {
  // Die Bucket-Namen kommen seit v3.15 aus derselben Quelle wie die
  // Status-Pille (`statusKurzLabel`). Vorher stand hier eine eigene Kopie, die
  // `abgelehnt/zurückgez.` schrieb, während die Antragsliste daneben
  // `abgel./zurückgez.` zeigte — dasselbe Kopf-Band, zwei Schreibweisen.
  it('beide Buckets → „Schlussvermerk n · abgel./zurückgez. m"', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 12, abgelehntZurueckgezogen: 3 }))
      .toBe('Schlussvermerk 12 · abgel./zurückgez. 3');
  });
  it('nur Schlussvermerk → abgelehnt-Teil weggelassen', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 5, abgelehntZurueckgezogen: 0 }))
      .toBe('Schlussvermerk 5');
  });
  it('nur Ablehnungen → Schlussvermerk-Teil weggelassen', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 0, abgelehntZurueckgezogen: 7 }))
      .toBe('abgel./zurückgez. 7');
  });
  it('beide null → leerer String', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 0, abgelehntZurueckgezogen: 0 })).toBe('');
  });
});

describe('istBeendetVersteckt', () => {
  const voll = { wunsch: true, suchAktiv: false, beendet: 5, arbeitsvorrat: 7 };

  it('ohne Notbremse gilt die Schalter-Stellung', () => {
    expect(istBeendetVersteckt(voll)).toBe(true);
    expect(istBeendetVersteckt({ ...voll, wunsch: false })).toBe(false);
  });
  it('nichts Beendetes → nie versteckt (kein Streifen „0 ausgeblendet")', () => {
    expect(istBeendetVersteckt({ ...voll, beendet: 0 })).toBe(false);
  });
  it('nur Beendetes → sichtbar, sonst stünde „Keine Anträge" trotz Daten', () => {
    expect(istBeendetVersteckt({ ...voll, arbeitsvorrat: 0 })).toBe(false);
  });
  it('aktive Suche zeigt den ausgeblendeten Teil — Treffer dürfen nicht fehlen', () => {
    expect(istBeendetVersteckt({ ...voll, suchAktiv: true })).toBe(false);
  });
  it('Suche ohne Beendetes ändert nichts am Ergebnis', () => {
    expect(istBeendetVersteckt({ ...voll, suchAktiv: true, beendet: 0 })).toBe(false);
  });
  it('die Notbremse setzt den Wunsch nicht zurück — sie überstimmt ihn nur', () => {
    // Reine Funktion: derselbe Wunsch, ohne Suche wieder wirksam.
    expect(istBeendetVersteckt({ ...voll, suchAktiv: true })).toBe(false);
    expect(istBeendetVersteckt(voll)).toBe(true);
  });
});

describe('hatBeendetAchse', () => {
  it('nur im „Alle"-Tab', () => {
    expect(hatBeendetAchse('alle')).toBe(true);
    expect(hatBeendetAchse('meine_offenen')).toBe(false);
    expect(hatBeendetAchse('bewilligt_jahr')).toBe(false);
  });

  it('kennt die Gruppierung NICHT — genau das war bis v3.5 die stille Kopplung', () => {
    // Regressionsgatter: sobald jemand wieder ein Gruppierungs-Argument
    // einführt, verschwindet die Achse bei jeder Gruppierung ≠ 'none'. Die
    // Signatur ist einstellig, das Ergebnis hängt an nichts sonst.
    expect(hatBeendetAchse.length).toBe(1);
    for (const g of ['none', 'status', 'netzwerk', 'fb', 'ab']) {
      expect((hatBeendetAchse as (v: string, g?: string) => boolean)('alle', g)).toBe(true);
    }
  });
});

describe('BEENDET_OPTIONS', () => {
  it('trägt genau die zwei Stellungen, „ausgeblendet" zuerst (= Standard)', () => {
    expect(BEENDET_OPTIONS.map(o => o.key)).toEqual(['aus', 'ein']);
    expect(BEENDET_OPTIONS[0]!.label).toBe('ausgeblendet');
  });
});
