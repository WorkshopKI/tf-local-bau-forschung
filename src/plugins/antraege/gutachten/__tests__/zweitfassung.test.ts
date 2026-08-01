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
import { TEMPERATUR_MUTIG, TEMPERATUR_SICHER } from '@/core/services/ai/sampling';

describe('bestimmeZweitfassung', () => {
  it('variiert über die Bridge die KI — die jeweils andere', () => {
    expect(bestimmeZweitfassung(true, 'standard')).toEqual({
      art: 'ki', ziel: 'agentisch', label: 'der agentischen KI',
    });
    expect(bestimmeZweitfassung(true, 'agentisch')).toEqual({
      art: 'ki', ziel: 'standard', label: 'der Standard-KI',
    });
  });

  it('variiert ohne Bridge die Temperatur — unabhängig von der KI-Präferenz', () => {
    for (const ziel of ['standard', 'agentisch'] as const) {
      expect(bestimmeZweitfassung(false, ziel)).toEqual({
        art: 'temperatur', temperatur: TEMPERATUR_MUTIG, label: 'mutigerer Einstellung',
      });
    }
  });

  it('liefert IMMER eine Art — der Eintrag entfällt nie mehr', () => {
    expect(bestimmeZweitfassung(false, 'standard').label).toBeTruthy();
  });
});

describe('Temperatur-Konstanten', () => {
  it('die mutige Fassung liegt über der sicheren — sonst wäre es keine zweite', () => {
    expect(TEMPERATUR_MUTIG).toBeGreaterThan(TEMPERATUR_SICHER);
  });

  it('KEIN Greedy Decoding: Reasoning-Modelle laufen bei 0 in Wiederholschleifen', () => {
    expect(TEMPERATUR_SICHER).toBeGreaterThan(0);
  });

  it('bleibt unter der llama.cpp-Voreinstellung 1.0 — das war der Ist-Zustand bis v2.372', () => {
    expect(TEMPERATUR_MUTIG).toBeLessThan(1);
  });
});

describe('fassungLabel', () => {
  it('benennt die mutigere Einstellung', () => {
    expect(fassungLabel('mutig')).toBe('mutigere Einstellung');
  });

  it('schweigt beim Standard — der Normalfall sagt nichts', () => {
    expect(fassungLabel(undefined)).toBeNull();
  });
});
