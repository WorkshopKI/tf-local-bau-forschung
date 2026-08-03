/**
 * `multi_select` vergleicht Filter-Werte gegen CSV-ROHWERTE — und die sind im
 * Export gemischt geschrieben (`beantragt`, aber `NF gestellt`,
 * `Schlussvermerk`). Wer die Werte aus einem kanonischen Helfer bezieht (der
 * normalisierte Schluessel liefert), traf beim frueheren exakten Vergleich
 * ausgerechnet die grossgeschriebenen Werte nicht: die Status-Pille zaehlte 2
 * Nachforderungen und filterte 0 heraus.
 *
 * Deshalb vergleicht der Zweig auf beiden Seiten trim + lowercase. Diese Datei
 * haelt genau das fest — inklusive der Grenzen, die dabei NICHT verrutschen
 * duerfen (`(leer)`-Bucket, leere Werteliste als No-op).
 */
import { describe, it, expect } from 'vitest';
import { applyFilters } from '../engine';
import type { ActiveFilter, FilterDefinition } from '../types';
import type { AntragListItem } from '../../types';
import { asAntragStatusRaw } from '../../types';

const STATUS_DEF: FilterDefinition = {
  id: 'f-status',
  programm_id: 'TEST',
  scope: 'system',
  name: 'Status',
  feld: 'status',
  typ: 'multi_select',
  config: { werte_quelle: 'auto', leer_bucket: true },
  anzeige_reihenfolge: 1,
  versteckt: false,
  erstellt_am: '2026-01-01',
  aktualisiert_am: '2026-01-01',
};

function antrag(aktenzeichen: string, status: string): AntragListItem {
  return { aktenzeichen, status: asAntragStatusRaw(status) } as AntragListItem;
}

const DATEN: AntragListItem[] = [
  antrag('A1', 'NF gestellt'),
  antrag('A2', 'Schlussvermerk'),
  antrag('A3', 'bewilligt'),
  antrag('A4', '  beantragt '),
  antrag('A5', ''),
];

function mitStatus(werte: string[]): string[] {
  const active: ActiveFilter[] = [{ filterId: 'f-status', value: werte }];
  return applyFilters(DATEN, active, [STATUS_DEF]).map(a => a.aktenzeichen);
}

describe('applyFilters — multi_select vergleicht schreibungs-tolerant', () => {
  it('trifft den grossgeschriebenen Rohwert mit dem normalisierten Schluessel', () => {
    expect(mitStatus(['nf gestellt'])).toEqual(['A1']);
    expect(mitStatus(['schlussvermerk'])).toEqual(['A2']);
  });

  it('trifft auch umgekehrt — Filter gross, Rohwert klein', () => {
    expect(mitStatus(['BEWILLIGT'])).toEqual(['A3']);
  });

  it('toleriert fuehrende/nachlaufende Leerzeichen auf beiden Seiten', () => {
    expect(mitStatus(['beantragt'])).toEqual(['A4']);
    expect(mitStatus(['  NF gestellt  '])).toEqual(['A1']);
  });

  it('sammelt mehrere Werte per ODER ein', () => {
    expect(mitStatus(['nf gestellt', 'schlussvermerk'])).toEqual(['A1', 'A2']);
  });

  it('haelt den (leer)-Bucket getrennt: nur der leere Status faellt hinein', () => {
    expect(mitStatus(['(leer)'])).toEqual(['A5']);
    // Ein leerer Status darf NICHT von einem beliebigen Wert mitgenommen werden.
    expect(mitStatus(['bewilligt'])).not.toContain('A5');
  });

  it('bleibt bei leerer Werteliste ein No-op', () => {
    expect(mitStatus([])).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });

  it('trifft nicht, wo es nichts zu treffen gibt', () => {
    expect(mitStatus(['gibt es nicht'])).toEqual([]);
  });
});
