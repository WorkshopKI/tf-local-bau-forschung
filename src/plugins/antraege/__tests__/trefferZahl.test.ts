/**
 * Der Guard gegen die eingefrorene Zahl (Reiter „NF": 0 Zeilen, aber „97
 * Anträge" vom vorigen Reiter) und die Beschriftung, die die Ebene benennt.
 */
import { describe, it, expect } from 'vitest';
import {
  berechneTrefferZahl,
  formatTrefferZahl,
  trefferZahlTitel,
  type ZeilenMeldung,
} from '../trefferZahl';

const TABELLE: ZeilenMeldung = { quelle: 'compact', tv: 97, zeilen: 97, art: null };

describe('berechneTrefferZahl', () => {
  it('kein Treffer ⇒ null, auch wenn noch eine alte Meldung steht', () => {
    // Genau der NF-Fall: die Tabelle rendert nicht mehr, meldet also nichts
    // Neues — die 97 des vorigen Reiters darf nicht stehen bleiben.
    expect(berechneTrefferZahl('compact', 0, TABELLE)).toEqual({ tv: 0, zeilen: 0, art: null });
  });

  it('ohne Meldung zählt die gefilterte Liste selbst', () => {
    expect(berechneTrefferZahl('compact', 42, null)).toEqual({ tv: 42, zeilen: 42, art: null });
  });

  it('verwirft eine Meldung aus einem anderen View-Modus', () => {
    // Wechsel Tabelle → Karten: die Karten melden nichts, die Tabellen-Zahl
    // (inkl. ihrer Verbund-Zeilen) waere dort schlicht falsch.
    const mitVerbund: ZeilenMeldung = { quelle: 'compact', tv: 17, zeilen: 12, art: 'verbund' };
    expect(berechneTrefferZahl('cards', 17, mitVerbund)).toEqual({ tv: 17, zeilen: 17, art: null });
  });

  it('übernimmt die Meldung des passenden Modus — inkl. Spaltenfilter', () => {
    const gefiltert: ZeilenMeldung = { quelle: 'compact', tv: 5, zeilen: 3, art: 'verbund' };
    expect(berechneTrefferZahl('compact', 17, gefiltert)).toEqual({ tv: 5, zeilen: 3, art: 'verbund' });
  });

  it('eine Meldung über null Teilvorhaben (Spaltenfilter leert die Tabelle) ⇒ null', () => {
    const leer: ZeilenMeldung = { quelle: 'compact', tv: 0, zeilen: 0, art: null };
    expect(berechneTrefferZahl('compact', 17, leer)).toEqual({ tv: 0, zeilen: 0, art: null });
  });
});

describe('formatTrefferZahl', () => {
  it('ohne Verdichtung nur die TV-Zahl, mit Tausenderpunkt', () => {
    expect(formatTrefferZahl({ tv: 1294, zeilen: 1294, art: null })).toBe('1.294 Teilvorhaben');
  });

  it('„Teilvorhaben" bleibt im Singular gleich', () => {
    expect(formatTrefferZahl({ tv: 1, zeilen: 1, art: null })).toBe('1 Teilvorhaben');
  });

  it('Verbund-Gruppierung stellt die Zeilenzahl daneben', () => {
    expect(formatTrefferZahl({ tv: 17, zeilen: 12, art: 'verbund' }))
      .toBe('17 Teilvorhaben · 12 Verbund-Zeilen');
  });

  it('beugt das Zeilen-Wort im Singular', () => {
    expect(formatTrefferZahl({ tv: 3, zeilen: 1, art: 'verbund' }))
      .toBe('3 Teilvorhaben · 1 Verbund-Zeile');
    expect(formatTrefferZahl({ tv: 3, zeilen: 1, art: 'gruppe' }))
      .toBe('3 Teilvorhaben · 1 Gruppe');
  });

  it('Listen-Gruppierung nennt Gruppen', () => {
    expect(formatTrefferZahl({ tv: 40, zeilen: 9, art: 'gruppe' }))
      .toBe('40 Teilvorhaben · 9 Gruppen');
  });

  it('verschweigt die zweite Zahl, wenn nichts verdichtet wurde', () => {
    // Gruppierung aktiv, aber jede Gruppe hat genau ein TV → keine Differenz.
    expect(formatTrefferZahl({ tv: 12, zeilen: 12, art: 'verbund' })).toBe('12 Teilvorhaben');
  });
});

describe('trefferZahlTitel', () => {
  it('benennt immer die Ebene der übrigen Zähler', () => {
    expect(trefferZahlTitel({ tv: 12, zeilen: 12, art: null })).toContain('Teilvorhaben');
  });

  it('erklärt zusätzlich die Verdichtung', () => {
    expect(trefferZahlTitel({ tv: 17, zeilen: 12, art: 'verbund' })).toContain('Verbund');
    expect(trefferZahlTitel({ tv: 17, zeilen: 12, art: 'gruppe' })).toContain('Gruppen');
  });
});
