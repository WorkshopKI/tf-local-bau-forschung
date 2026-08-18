/**
 * Die Stillstands-Achse.
 *
 * Die wichtigste Zusage steht zuerst: **ohne datierbare Aktivität lautet das
 * Urteil „nicht prüfbar", nie „läuft"**. Sie zu den Unauffälligen zu schlagen
 * hieße, eine Aussage zu treffen, für die die Grundlage fehlt.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  beurteileStillstand,
  filtereStillstand,
  type AktivitaetsIndex,
  type LetzteAktivitaet,
} from '../frage/letzteAktivitaet';

const STICHTAG = '2026-08-18';

const tag = (t: string, belegt = false): LetzteAktivitaet => ({ tag: t, belegt });

describe('beurteileStillstand', () => {
  it('ohne Eintrag: nicht prüfbar — nicht „läuft"', () => {
    expect(beurteileStillstand(undefined, 60, STICHTAG)).toBe('unpruefbar');
  });

  it('ein unlesbares Datum ist ebenfalls nicht prüfbar', () => {
    expect(beurteileStillstand(tag('kein datum'), 60, STICHTAG)).toBe('unpruefbar');
  });

  it('über der Schwelle steht der Vorgang still', () => {
    // 2026-05-01 → 109 Tage vor dem Stichtag.
    expect(beurteileStillstand(tag('2026-05-01'), 60, STICHTAG)).toBe('steht');
  });

  it('unter der Schwelle läuft er', () => {
    expect(beurteileStillstand(tag('2026-08-01'), 60, STICHTAG)).toBe('laeuft');
  });

  it('„länger als" heißt: genau auf der Schwelle noch nicht', () => {
    // 2026-06-19 ist exakt 60 Tage vor dem Stichtag.
    expect(beurteileStillstand(tag('2026-06-19'), 60, STICHTAG)).toBe('laeuft');
    expect(beurteileStillstand(tag('2026-06-18'), 60, STICHTAG)).toBe('steht');
  });
});

describe('filtereStillstand', () => {
  const a = (az: string): AntragListItem => ({ aktenzeichen: az } as AntragListItem);
  const liste = [a('A'), a('B'), a('C')];
  const index: AktivitaetsIndex = new Map([
    ['A', tag('2026-01-01')],  // lange her → steht
    ['B', tag('2026-08-10')],  // frisch    → läuft
    // C fehlt                                → nicht prüfbar
  ]);

  it('liefert nur die, die die Schwelle reißen — und zählt die Unprüfbaren', () => {
    const { treffer, unpruefbar } = filtereStillstand(liste, index, 60, STICHTAG);
    expect(treffer.map(x => x.aktenzeichen)).toEqual(['A']);
    expect(unpruefbar).toBe(1);
  });

  it('ein Unprüfbarer zählt NICHT als Treffer und NICHT als laufend', () => {
    const { treffer, unpruefbar } = filtereStillstand([a('C')], index, 60, STICHTAG);
    expect(treffer).toEqual([]);
    expect(unpruefbar).toBe(1);
  });

  it('ohne Index bleibt die Liste stehen, statt leer zu wirken', () => {
    // Während der Index noch rechnet, sähe eine leere Liste aus wie
    // „nichts gefunden" — und das wäre eine Auskunft, die niemand geprüft hat.
    const { treffer, unpruefbar } = filtereStillstand(liste, null, 60, STICHTAG);
    expect(treffer).toEqual(liste);
    expect(unpruefbar).toBe(3);
  });
});
