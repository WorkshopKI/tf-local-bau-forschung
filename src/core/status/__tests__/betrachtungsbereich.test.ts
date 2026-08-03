/**
 * Der Betrachtungsbereich — die Reihenfolge seiner beiden Quellen und die eine
 * Prüffunktion, die alle Konsumenten teilen.
 *
 * Kernzusage (Pitfall #46): der Seed steht im Code und gilt flag-unabhängig;
 * eine gepflegte Fassung überschreibt ihn. Weicht sie ab, muss man das sehen —
 * sonst zeigen dev/pl andere Zahlen als prod, ohne dass jemand merkt, warum.
 */
import { describe, it, expect } from 'vitest';
import {
  BETRACHTUNGSBEREICH_SEED, bereichsProgramme, bereichsMenge, istImBereich,
  bereichWeichtVomSeedAb,
} from '@/core/status/betrachtungsbereich';
import type { MappingVersion } from '@/core/status/typen';

const fassung = (programme?: string[]): MappingVersion => ({
  version: 1, autor: null, zeitstempel: 'x', felder: [], werte: [],
  ...(programme ? { betrachtungsbereich: { programme } } : {}),
});

describe('bereichsProgramme', () => {
  it('nimmt den Code-Seed, wenn keine Fassung geladen ist (prod/as)', () => {
    expect(bereichsProgramme(null)).toEqual(BETRACHTUNGSBEREICH_SEED);
    expect(bereichsProgramme(undefined)).toEqual(BETRACHTUNGSBEREICH_SEED);
  });

  it('nimmt den Code-Seed, wenn die Fassung nichts pflegt', () => {
    expect(bereichsProgramme(fassung())).toEqual(BETRACHTUNGSBEREICH_SEED);
  });

  it('die gepflegte Liste schlägt den Seed', () => {
    expect(bereichsProgramme(fassung(['138']))).toEqual(['138']);
  });

  it('eine LEERE gepflegte Liste ist kein Bereich ohne Inhalt, sondern „nicht gepflegt"', () => {
    expect(bereichsProgramme(fassung([]))).toEqual(BETRACHTUNGSBEREICH_SEED);
  });

  it('deckt die neun Richtlinien der Trigger-Zuarbeit ab', () => {
    expect([...BETRACHTUNGSBEREICH_SEED].sort())
      .toEqual(['131', '136', '137', '138', '139', '76', '77', '78', '79']);
  });
});

describe('bereichWeichtVomSeedAb', () => {
  it('schweigt, solange nichts gepflegt ist', () => {
    expect(bereichWeichtVomSeedAb(null)).toBe(false);
    expect(bereichWeichtVomSeedAb(fassung())).toBe(false);
  });

  it('schweigt bei gleicher Menge in anderer Reihenfolge', () => {
    expect(bereichWeichtVomSeedAb(fassung([...BETRACHTUNGSBEREICH_SEED].reverse()))).toBe(false);
  });

  it('meldet jede echte Abweichung — sie wirkt in prod erst mit dem Release', () => {
    expect(bereichWeichtVomSeedAb(fassung(['138']))).toBe(true);
    expect(bereichWeichtVomSeedAb(fassung([...BETRACHTUNGSBEREICH_SEED, '47']))).toBe(true);
  });
});

describe('istImBereich', () => {
  const menge = bereichsMenge(['76', '138']);

  it('`null` heißt kein Filter — jeder Antrag zählt', () => {
    expect(istImBereich('47', null)).toBe(true);
    expect(istImBereich(undefined, null)).toBe(true);
  });

  it('trifft über den normalisierten Schlüssel', () => {
    expect(istImBereich('76', menge)).toBe(true);
    expect(istImBereich('  138 ', menge)).toBe(true);
    expect(istImBereich('47', menge)).toBe(false);
  });

  it('ein Antrag ohne Programm-Nummer fällt heraus, statt geraten zu werden', () => {
    expect(istImBereich(undefined, menge)).toBe(false);
    expect(istImBereich('', menge)).toBe(false);
    expect(istImBereich(null, menge)).toBe(false);
    expect(istImBereich(76, menge), 'kein impliziter Zahl-String-Cast').toBe(false);
  });
});
