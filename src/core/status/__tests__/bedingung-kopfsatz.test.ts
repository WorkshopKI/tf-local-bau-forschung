/**
 * Der Kopfsatz über den Karten des Bedingungs-Editors. Er nennt nur die oberste
 * Ebene — was in einer Gruppe steht, sagt deren Karte darunter.
 */
import { describe, expect, it } from 'vitest';
import { bedingungKopfsatz } from '../bedingung-text';
import type { Bedingung } from '../typen';

const NAMEN: Record<string, string> = { tib_kuerz: 'TIB', bib_kuerz: 'BIB' };
const labelVon = (id: string): string => NAMEN[id] ?? id;
const x: Bedingung = { feldId: 'x', op: 'gefuellt' };

describe('bedingungKopfsatz', () => {
  it('benannte Gruppen unter „alle": mit „und", Verb im Plural', () => {
    const b: Bedingung = { alle: [{ einige: [x], name: 'PreCheck AB' }, { einige: [x], name: 'PreCheck FB' }] };
    expect(bedingungKopfsatz(b, labelVon)).toBe('Erfüllt, wenn „PreCheck AB" und „PreCheck FB" zutreffen.');
  });

  it('„eine" verbindet mit „oder" und nimmt den Singular', () => {
    expect(bedingungKopfsatz({ einige: [{ einige: [x] }, { alle: [x] }] }, labelVon))
      .toBe('Erfüllt, wenn Gruppe 1 oder Gruppe 2 zutrifft.');
  });

  it('Einzelbedingungen stehen mit ihrem Satz da', () => {
    const b: Bedingung = { alle: [{ feldId: 'tib_kuerz', op: 'gefuellt' }, { feldId: 'bib_kuerz', op: 'gefuellt' }] };
    expect(bedingungKopfsatz(b, labelVon)).toBe('Erfüllt, wenn „TIB gefüllt" und „BIB gefüllt" zutreffen.');
  });

  it('unbenannte Gruppen zählen nur unter den Gruppen — wie der Platzhalter der Karte', () => {
    expect(bedingungKopfsatz({ alle: [x, { einige: [x] }, x] }, labelVon))
      .toBe('Erfüllt, wenn „x gefüllt", Gruppe 1 und „x gefüllt" zutreffen.');
  });

  it('ein Teil, ein Blatt als Wurzel, leer', () => {
    expect(bedingungKopfsatz({ alle: [x] }, labelVon)).toBe('Erfüllt, wenn „x gefüllt" zutrifft.');
    expect(bedingungKopfsatz(x, labelVon)).toBe('Erfüllt, wenn „x gefüllt" zutrifft.');
    expect(bedingungKopfsatz({ einige: [] }, labelVon)).toBe('Noch keine Bedingung.');
  });

  it('ab vier Teilen generisch', () => {
    expect(bedingungKopfsatz({ alle: [x, x, x, x] }, labelVon)).toBe('Erfüllt, wenn alle 4 Teile zutreffen.');
    expect(bedingungKopfsatz({ einige: [x, x, x, x] }, labelVon)).toBe('Erfüllt, wenn einer der 4 Teile zutrifft.');
  });
});
