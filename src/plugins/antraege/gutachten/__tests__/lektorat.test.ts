/**
 * Tests des Lektorat-Wächters: er ist die einzige Instanz, die „der Lektor hat
 * doch inhaltlich etwas geändert" deterministisch bemerkt — daher gegen die
 * realen deutschen Schreibweisen (Tausenderpunkt, Dezimalkomma, Einheiten) und
 * gegen den Kapp-Verdacht (abgeschnittene Antwort) geprüft.
 */
import { describe, it, expect } from 'vitest';
import {
  zahlenInventar, pruefeLektorat, istVerdaechtigGekuerzt, gebrocheneRegeln, befundText,
  LEKTORAT_LAENGEN_SCHWELLE,
} from '../lektorat';
import type { CheckResult } from '@/core/services/skills';

describe('zahlenInventar', () => {
  it('erfasst deutsche Zahlformate inkl. Einheiten-Suffix', () => {
    const inv = zahlenInventar('Der Umsatz stieg 2027 um 12,5 % auf 1.000 Stück bzw. 3 Mio. € bei 250 T€ Kosten.');
    expect(inv).toContain('2027');
    expect(inv).toContain('12,5 %');
    expect(inv).toContain('1.000');
    expect(inv).toContain('3 mio. €');
    expect(inv).toContain('250 t€');
  });

  it('unterscheidet gleiche Ziffern mit verschiedenen Einheiten', () => {
    expect(zahlenInventar('12 %')).not.toEqual(zahlenInventar('12 kg'));
  });

  it('liefert für Text ohne Zahlen ein leeres Inventar', () => {
    expect(zahlenInventar('Ein Satz ganz ohne Ziffern.')).toEqual([]);
  });
});

describe('pruefeLektorat', () => {
  const VORHER = 'Das Vorhaben senkt den Ausschuss bis 2027 um 12,5 % und spart 3 Mio. € jährlich ein.';

  it('meldet nichts bei identischem Text', () => {
    const b = pruefeLektorat(VORHER, VORHER);
    expect(b.auffaellig).toBe(false);
    expect(b.zahlenVerloren).toEqual([]);
    expect(b.zahlenNeu).toEqual([]);
    expect(b.laengenDeltaProzent).toBe(0);
    expect(befundText(b)).toBe('');
  });

  it('meldet nichts bei rein sprachlicher Überarbeitung gleicher Länge', () => {
    const nachher = 'Bis 2027 senkt das Vorhaben den Ausschuss um 12,5 % und spart jährlich 3 Mio. € ein.';
    const b = pruefeLektorat(VORHER, nachher);
    expect(b.auffaellig).toBe(false);
  });

  it('erkennt eine gestrichene Zahl', () => {
    const nachher = 'Das Vorhaben senkt den Ausschuss bis 2027 spürbar und spart 3 Mio. € jährlich ein, was erheblich ist.';
    const b = pruefeLektorat(VORHER, nachher);
    expect(b.zahlenVerloren).toEqual(['12,5 %']);
    expect(b.auffaellig).toBe(true);
    expect(befundText(b)).toContain('1 Zahl fehlt');
  });

  it('erkennt eine hinzuerfundene Zahl', () => {
    const nachher = 'Das Vorhaben senkt den Ausschuss bis 2027 um 12,5 %, spart 3 Mio. € jährlich und bindet 5 Mitarbeitende.';
    const b = pruefeLektorat(VORHER, nachher);
    expect(b.zahlenNeu).toEqual(['5']);
    expect(befundText(b)).toContain('1 Zahl ist neu');
  });

  it('zählt Vielfachheiten (zwei gleiche Zahlen, eine entfällt)', () => {
    const b = pruefeLektorat('10 % hier und 10 % dort.', '10 % nur noch hier.');
    expect(b.zahlenVerloren).toEqual(['10 %']);
    expect(b.zahlenNeu).toEqual([]);
  });

  it('meldet Längen-Drift oberhalb der Schwelle, darunter nicht', () => {
    const basis = 'x'.repeat(1000);
    const knappDrunter = pruefeLektorat(basis, 'x'.repeat(1000 - LEKTORAT_LAENGEN_SCHWELLE * 10));
    expect(knappDrunter.laengenDeltaProzent).toBe(-LEKTORAT_LAENGEN_SCHWELLE);
    expect(knappDrunter.auffaellig).toBe(false);

    const drueber = pruefeLektorat(basis, 'x'.repeat(850));
    expect(drueber.laengenDeltaProzent).toBe(-15);
    expect(drueber.auffaellig).toBe(true);
    expect(befundText(drueber)).toContain('Länge −15 %');
  });

  it('kappt die Zahlen-Aufzählung im Befundtext', () => {
    const b = pruefeLektorat('1 2 3 4 5', '');
    expect(befundText(b, 2)).toContain('1, 2, …');
  });
});

describe('istVerdaechtigGekuerzt', () => {
  it('schlägt bei deutlich zu kurzem Ergebnis an (abgeschnittene Antwort)', () => {
    expect(istVerdaechtigGekuerzt('x'.repeat(1000), 'x'.repeat(500))).toBe(true);
  });

  it('schlägt bei normaler Redigatur nicht an', () => {
    expect(istVerdaechtigGekuerzt('x'.repeat(1000), 'x'.repeat(950))).toBe(false);
    expect(istVerdaechtigGekuerzt('x'.repeat(1000), 'x'.repeat(600))).toBe(false); // exakt an der Grenze
  });

  it('ist No-op bei leerem Ausgangstext', () => {
    expect(istVerdaechtigGekuerzt('', '')).toBe(false);
  });
});

/**
 * Gemessen am 22.08.2026 an Abschnitt G: der Rohentwurf trug den Pflicht-Anfang
 * wörtlich (`ok`), der Lektor formulierte ihn stilistisch um, die Prüfung meldete
 * danach `fehler`. Der beschädigte Stand war der angezeigte.
 */
describe('gebrocheneRegeln — der Feinschliff darf nichts Erfülltes brechen', () => {
  const check = (id: string, level: CheckResult['level']): CheckResult => ({ id, level, label: id });

  it('meldet die Regel, die vorher ok war und jetzt Fehler ist (der G-Fall)', () => {
    const gebrochen = gebrocheneRegeln(
      [check('vorgabe:g:pflicht_anfang', 'ok')],
      [check('vorgabe:g:pflicht_anfang', 'fehler')],
    );
    expect(gebrochen.map(c => c.id)).toEqual(['vorgabe:g:pflicht_anfang']);
  });

  it('rechnet einen schon vorher bestehenden Fehler NICHT an', () => {
    expect(gebrocheneRegeln(
      [check('r', 'fehler')],
      [check('r', 'fehler')],
    )).toEqual([]);
  });

  it('rechnet eine Regel NICHT an, die es vorher gar nicht gab', () => {
    // Nicht vorhanden heisst nicht erfuellt — der Feinschliff kann sie nicht gebrochen haben.
    expect(gebrocheneRegeln([], [check('neu', 'fehler')])).toEqual([]);
  });

  it('ein Hinweis blockiert nie, auch wenn er neu ist', () => {
    expect(gebrocheneRegeln([check('r', 'ok')], [check('r', 'hinweis')])).toEqual([]);
  });

  it('eine Verbesserung ist kein Bruch', () => {
    expect(gebrocheneRegeln([check('r', 'fehler')], [check('r', 'ok')])).toEqual([]);
  });

  it('sammelt mehrere Brüche und lässt die übrigen Regeln in Ruhe', () => {
    const gebrochen = gebrocheneRegeln(
      [check('a', 'ok'), check('b', 'hinweis'), check('c', 'ok'), check('d', 'fehler')],
      [check('a', 'fehler'), check('b', 'fehler'), check('c', 'ok'), check('d', 'fehler')],
    );
    expect(gebrochen.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('leere Listen sind ein No-op', () => {
    expect(gebrocheneRegeln([], [])).toEqual([]);
  });
});
