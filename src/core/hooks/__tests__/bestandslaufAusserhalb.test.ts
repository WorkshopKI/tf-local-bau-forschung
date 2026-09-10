/**
 * Der Bestandslauf rechnet nur die zwei jüngsten Richtlinien. Zwei Dinge daran
 * sind festzuhalten: der Schlüssel der Ablage folgt der gerechneten Menge (sonst
 * läse ein Leser das Ergebnis einer anderen), und „außerhalb" gilt nur, wenn
 * ALLE Teilvorhaben einer Zeile draußen liegen.
 */
import { describe, expect, it } from 'vitest';
import { alleNichtGerechnet, bestandsSchluessel } from '../useBestandsAufgaben';
import type { MappingVersion } from '@/core/status';

const VERSION = { version: 3, zeitstempel: '2026-09-01T00:00:00.000Z' } as MappingVersion;
const STICHTAG = '2026-09-10T10:00:00.000Z';

describe('bestandsSchluessel — die gerechnete Menge', () => {
  it('ändert sich mit der Lauf-Menge, nicht mit ihrer Reihenfolge', () => {
    const ohne = bestandsSchluessel(VERSION, null, STICHTAG);
    const mit = bestandsSchluessel(VERSION, null, STICHTAG, new Set(['136', '76']));
    expect(mit).not.toBe(ohne);
    expect(bestandsSchluessel(VERSION, null, STICHTAG, new Set(['76', '136']))).toBe(mit);
  });
});

describe('alleNichtGerechnet', () => {
  const nicht = new Set(['AZ-1', 'AZ-2']);

  it('gilt nur, wenn alle Teilvorhaben der Zeile draußen liegen', () => {
    expect(alleNichtGerechnet(['AZ-1', 'AZ-2'], nicht)).toBe(true);
    expect(alleNichtGerechnet(['AZ-1', 'AZ-9'], nicht)).toBe(false);
  });

  it('eine leere Zeile ist nicht „außerhalb"', () => {
    expect(alleNichtGerechnet([], nicht)).toBe(false);
  });
});
