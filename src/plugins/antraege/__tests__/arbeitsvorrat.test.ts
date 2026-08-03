/**
 * Arbeitsvorrat/Archiv-Split (Journey-Paket 2 Phase 5).
 *
 * Reine Sektionierungs-Logik des „Alle"-Tabs: terminale Anträge (Kategorie
 * abgeschlossen ∪ abgelehnt, OHNE bewilligt) ins Archiv, der Rest in den
 * Arbeitsvorrat. Plus Archiv-Aufschlüsselung, effektiver Collapsed-Zustand
 * (Auto-Aufklappen bei Suche) und das View-/Gruppierungs-Gate.
 */
import { describe, it, expect } from 'vitest';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import {
  arbeitsvorratSectionOf,
  partitionArbeitsvorrat,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  isArchivCollapsedEffective,
  isArbeitsvorratView,
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
  it('beide Buckets → „Schlussvermerk n · abgelehnt/zurückgez. m"', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 12, abgelehntZurueckgezogen: 3 }))
      .toBe('Schlussvermerk 12 · abgelehnt/zurückgez. 3');
  });
  it('nur Schlussvermerk → abgelehnt-Teil weggelassen', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 5, abgelehntZurueckgezogen: 0 }))
      .toBe('Schlussvermerk 5');
  });
  it('nur Ablehnungen → Schlussvermerk-Teil weggelassen', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 0, abgelehntZurueckgezogen: 7 }))
      .toBe('abgelehnt/zurückgez. 7');
  });
  it('beide null → leerer String', () => {
    expect(formatArchivAufschluesselung({ schlussvermerk: 0, abgelehntZurueckgezogen: 0 })).toBe('');
  });
});

describe('isArchivCollapsedEffective', () => {
  it('ohne Suche gilt der persistierte Wunsch', () => {
    expect(isArchivCollapsedEffective(true, false, 5)).toBe(true);
    expect(isArchivCollapsedEffective(false, false, 5)).toBe(false);
  });
  it('aktive Suche mit Archiv-Treffern klappt zwangs-auf', () => {
    expect(isArchivCollapsedEffective(true, true, 5)).toBe(false);
  });
  it('aktive Suche ohne Archiv-Treffer bleibt eingeklappt', () => {
    expect(isArchivCollapsedEffective(true, true, 0)).toBe(true);
  });
  it('persistiert offen bleibt offen (Suche ändert nichts)', () => {
    expect(isArchivCollapsedEffective(false, true, 5)).toBe(false);
  });
});

describe('isArbeitsvorratView', () => {
  it('nur im „Alle"-Tab ohne aktive Gruppierung', () => {
    expect(isArbeitsvorratView('alle', 'none')).toBe(true);
    expect(isArbeitsvorratView('alle', 'status')).toBe(false);
    expect(isArbeitsvorratView('alle', 'verbund')).toBe(false);
    expect(isArbeitsvorratView('alle', 'netzwerk')).toBe(false);
    expect(isArbeitsvorratView('meine_offenen', 'none')).toBe(false);
    expect(isArbeitsvorratView('bewilligt_jahr', 'none')).toBe(false);
  });
});
