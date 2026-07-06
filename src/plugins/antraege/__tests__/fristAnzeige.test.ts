/**
 * Relative, ampel-gefärbte Frist-Anzeige (Journey-Paket 2 Phase 4).
 *
 * Reine Funktions-Tests ohne DOM — `nowMs` wird explizit injiziert (statt
 * `vi.setSystemTime`), damit „Tage bis zur Frist" deterministisch ist.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { MS_PER_DAY } from '@/core/services/csv/frist';
import {
  fristTextFromDays,
  fristAmpelFromDays,
  fristAnzeigeFromDays,
  fristAnzeige,
} from '../fristAnzeige';

/** Bezugs-Antragsdatum (UTC-Mitternacht → exakte Tages-Arithmetik). Frist =
 *  antragsdatum + 90 Tage (Antragsphase). */
const ANTRAGSDATUM = '2026-01-01T00:00:00.000Z';
const ANTRAGSDATUM_MS = new Date(ANTRAGSDATUM).getTime();
/** `now`, so gewählt dass die 90-Tage-Frist noch `restTage` entfernt ist. */
function nowFor(restTage: number): number {
  return ANTRAGSDATUM_MS + (90 - restTage) * MS_PER_DAY;
}

function antrag(status: string, extra?: Partial<AntragListItem>): AntragListItem {
  return { aktenzeichen: 'X', programm_id: 'P', status, antragsdatum: ANTRAGSDATUM, ...extra } as AntragListItem;
}

describe('fristTextFromDays — humanisierte relative Anzeige (kein Roh-„-2807d")', () => {
  it('Frist in der Zukunft → „in {n} T"', () => {
    expect(fristTextFromDays(45)).toBe('in 45 T');
    expect(fristTextFromDays(1)).toBe('in 1 T');
  });
  it('Frist heute → „heute"', () => {
    expect(fristTextFromDays(0)).toBe('heute');
  });
  it('überfällig → „seit {n} T" (positiver Betrag, kein Minus)', () => {
    expect(fristTextFromDays(-12)).toBe('seit 12 T');
    expect(fristTextFromDays(-2807)).toBe('seit 2807 T');
  });
});

describe('fristAmpelFromDays — frist-relative Stufen', () => {
  it('überfällig (< 0) → rot', () => {
    expect(fristAmpelFromDays(-1)).toBe('rot');
    expect(fristAmpelFromDays(-100)).toBe('rot');
  });
  it('heute / ≤ 14 T → orange', () => {
    expect(fristAmpelFromDays(0)).toBe('orange');
    expect(fristAmpelFromDays(14)).toBe('orange');
  });
  it('15–30 T → gelb', () => {
    expect(fristAmpelFromDays(15)).toBe('gelb');
    expect(fristAmpelFromDays(30)).toBe('gelb');
  });
  it('> 30 T → grün', () => {
    expect(fristAmpelFromDays(31)).toBe('gruen');
    expect(fristAmpelFromDays(365)).toBe('gruen');
  });
});

describe('fristAnzeigeFromDays — Kombination + leere Zelle', () => {
  it('null → null (leere Zelle)', () => {
    expect(fristAnzeigeFromDays(null)).toBeNull();
  });
  it('kombiniert Text + Ampel', () => {
    expect(fristAnzeigeFromDays(20)).toEqual({ text: 'in 20 T', ampel: 'gelb' });
    expect(fristAnzeigeFromDays(-5)).toEqual({ text: 'seit 5 T', ampel: 'rot' });
  });
});

describe('fristAnzeige — Einzelantrag (phasen-aware Frist)', () => {
  it('terminaler Status → null (leere Zelle), auch bei berechenbarer Frist', () => {
    expect(fristAnzeige(antrag('Schlussvermerk'), nowFor(10))).toBeNull();
    expect(fristAnzeige(antrag('abgelehnt/zurückgezogen'), nowFor(10))).toBeNull();
    expect(fristAnzeige(antrag('abgebrochen'), nowFor(10))).toBeNull();
  });

  it('offener Antrag mit Rest-Frist → „in {n} T" + passende Ampel', () => {
    expect(fristAnzeige(antrag('beantragt'), nowFor(40))).toEqual({ text: 'in 40 T', ampel: 'gruen' });
    expect(fristAnzeige(antrag('beantragt'), nowFor(25))).toEqual({ text: 'in 25 T', ampel: 'gelb' });
    expect(fristAnzeige(antrag('beantragt'), nowFor(10))).toEqual({ text: 'in 10 T', ampel: 'orange' });
  });

  it('offener Antrag am Fristtag → „heute" (orange)', () => {
    expect(fristAnzeige(antrag('beantragt'), nowFor(0))).toEqual({ text: 'heute', ampel: 'orange' });
  });

  it('überfälliger offener Antrag → „seit {n} T" (rot)', () => {
    expect(fristAnzeige(antrag('beantragt'), nowFor(-15))).toEqual({ text: 'seit 15 T', ampel: 'rot' });
  });

  it('offen ohne Antragsdatum → null (keine berechenbare Frist)', () => {
    expect(fristAnzeige(antrag('beantragt', { antragsdatum: '' }), nowFor(10))).toBeNull();
  });

  it('Begleitphase ohne VN-Eingang → null (VN-Frist unbekannt, nicht erfunden)', () => {
    expect(fristAnzeige(antrag('vn geprüft', { antragsdatum: '', vn_eingang_datum: '' }), nowFor(10))).toBeNull();
  });

  it('Begleitphase mit VN-Eingang → VN-Frist (VN-Eingang + 6 Monate)', () => {
    const a = fristAnzeige(
      antrag('vn geprüft', { vn_eingang_datum: '2026-01-01T00:00:00.000Z' }),
      new Date('2026-02-01T00:00:00.000Z').getTime(),
    );
    expect(a).not.toBeNull();
    expect(a!.text).toMatch(/^in \d+ T$/);
    expect(a!.ampel).toBe('gruen'); // ~5 Monate entfernt
  });
});
