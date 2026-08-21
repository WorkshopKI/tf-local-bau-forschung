/**
 * Was eine „Zweitfassung" variiert, hängt am Transport — und muss in der
 * Beschriftung stehen.
 *
 * Vorher entfiel der Menü-Eintrag ohne Bridge ersatzlos: ausgerechnet an der
 * direkt angebundenen KI, wo ein zweiter Lauf am billigsten ist und die
 * Temperatur als Stellschraube bereitliegt.
 */
import { describe, it, expect } from 'vitest';
import { bestimmeZweitfassung, fassungLabel } from '../zweitfassung';
import { TEMPERATUR_STANDARD, TEMPERATUR_ZWEITFASSUNG } from '@/core/services/ai/sampling';

describe('bestimmeZweitfassung', () => {
  it('variiert über die Bridge die KI — die jeweils andere', () => {
    expect(bestimmeZweitfassung(true, 'gpt-oss')).toEqual({
      art: 'ki', ziel: 'qwen35', label: 'Qwen3.6-35B',
    });
    expect(bestimmeZweitfassung(true, 'qwen35')).toEqual({
      art: 'ki', ziel: 'gpt-oss', label: 'gpt-oss-120b',
    });
  });

  it('variiert ohne Bridge die Temperatur — unabhängig von der KI-Präferenz', () => {
    for (const ziel of ['gpt-oss', 'qwen35'] as const) {
      expect(bestimmeZweitfassung(false, ziel)).toEqual({
        art: 'temperatur', temperatur: TEMPERATUR_ZWEITFASSUNG, label: 'anderer Einstellung',
      });
    }
  });

  it('liefert IMMER eine Art — der Eintrag entfällt nie mehr', () => {
    expect(bestimmeZweitfassung(false, 'gpt-oss').label).toBeTruthy();
  });
});

describe('Temperatur-Konstanten', () => {
  it('die zweite Fassung weicht vom Standard ab — sonst wäre es keine zweite', () => {
    expect(TEMPERATUR_ZWEITFASSUNG).not.toBe(TEMPERATUR_STANDARD);
  });

  it('KEIN Greedy Decoding: Reasoning-Modelle laufen bei 0 in Wiederholschleifen', () => {
    expect(TEMPERATUR_ZWEITFASSUNG).toBeGreaterThan(0);
  });

  /**
   * Die 125-Lauf-Messung (25 fiktive VBs × fünf Temperaturen) fand zwischen 0,2
   * und 1,0 keinen Unterschied in der Regeltreue. Der Standard schreibt deshalb
   * die llama.cpp-Voreinstellung fest, statt eine Qualitätsaussage zu behaupten —
   * wer ihn ändert, soll an dieser Stelle stolpern und erst neu messen.
   */
  it('der Standard IST die Server-Voreinstellung — nur eben nicht mehr implizit', () => {
    expect(TEMPERATUR_STANDARD).toBe(1.0);
  });
});

describe('fassungLabel', () => {
  it('benennt die abweichende Einstellung', () => {
    expect(fassungLabel('abweichend')).toBe('andere Einstellung');
  });

  it('übersetzt den v2.373-Marker mit — gespeicherte Fassungen fallen nicht durch', () => {
    expect(fassungLabel('mutig')).toBe('andere Einstellung');
  });

  it('schweigt beim Standard — der Normalfall sagt nichts', () => {
    expect(fassungLabel(undefined)).toBeNull();
  });
});
