/**
 * **Bis wann läuft die Achse?** — die eine Entscheidung, die `frist-bezug.ts`
 * über die reine Weiterreichung hinaus trifft.
 *
 * Sie ist klein und trägt viel: als Liste fiel ein zu langes Schlusssegment
 * nicht auf, als Bahn verschluckt es die ganze Zeitachse. Ein 2018 entschiedener
 * Altfall gegen „heute" gerechnet streckt seinen letzten Status über acht Jahre.
 *
 * Der Rest von `fristFuerVorkommen` ist Zuführung zu `berechneFrist`, und die
 * hat ihre eigenen Tests (`frist-ergebnis`).
 */
import { describe, it, expect } from 'vitest';
import { bezugsZeitpunktVon } from '@/core/status/frist-bezug';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';

const STICHTAG = '2026-08-07';

describe('bezugsZeitpunktVon', () => {
  it('endet am Haltedatum, wenn die Uhr steht', () => {
    const e: FristErgebnis = {
      zustand: 'angehalten', bezugsZeitpunkt: '2018-06-01', haltedatumQuelle: 'journal',
    };
    expect(bezugsZeitpunktVon(e, STICHTAG)).toBe('2018-06-01');
  });

  it('läuft bis zum Stichtag, solange die Uhr läuft', () => {
    const e: FristErgebnis = {
      zustand: 'laeuft', basisDatum: '2026-05-01', zielDatum: '2026-07-30',
      bezugsZeitpunkt: STICHTAG, tageRest: -8, haltedatumQuelle: 'unbekannt',
    };
    expect(bezugsZeitpunktVon(e, STICHTAG)).toBe(STICHTAG);
  });

  it('fällt bei angehaltener Uhr OHNE Haltedatum auf den Stichtag zurück', () => {
    // „Wir wissen nicht, wann sie stehen blieb" — die Achse dort abzuschneiden
    // erfände einen Zeitpunkt. Bis heute laufen zu lassen ist die schwächere,
    // aber belegbare Aussage; erfunden wird nichts.
    const e: FristErgebnis = {
      zustand: 'angehalten', grund: 'Haltedatum unbekannt', haltedatumQuelle: 'unbekannt',
    };
    expect(bezugsZeitpunktVon(e, STICHTAG)).toBe(STICHTAG);
  });

  it('fällt auch bei nicht berechenbarer Frist auf den Stichtag zurück', () => {
    const e: FristErgebnis = {
      zustand: 'nicht_berechenbar', grund: 'kein Eingangsdatum', haltedatumQuelle: 'unbekannt',
    };
    expect(bezugsZeitpunktVon(e, STICHTAG)).toBe(STICHTAG);
  });
});
