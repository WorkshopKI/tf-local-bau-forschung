import { describe, expect, it } from 'vitest';
import {
  bewegungWort, faelligWort, fristTageWort, fristWort, gerissenWort,
} from '../uhrWorte';

describe('uhrWorte — ein Wort je Uhr', () => {
  it('Frist: über, noch, heute — kurz und lang', () => {
    expect(fristTageWort(-12)).toBe('12 T über Frist');
    expect(fristTageWort(-12, 'lang')).toBe('12 Tage über der Frist');
    expect(fristTageWort(-1, 'lang')).toBe('1 Tag über der Frist');
    expect(fristTageWort(5)).toBe('noch 5 T');
    expect(fristTageWort(1, 'lang')).toBe('noch 1 Tag');
    expect(fristTageWort(0)).toBe('heute fällig');
  });

  it('Frist aus dem Zustand: angehalten und nicht berechenbar sind eigene Wörter', () => {
    expect(fristWort({ zustand: 'laeuft', tageRest: -3 }, 'lang')).toBe('3 Tage über der Frist');
    expect(fristWort({ zustand: 'angehalten', tageRest: undefined })).toBe('angehalten');
    expect(fristWort({ zustand: 'angehalten', tageRest: undefined }, 'lang')).toBe('Frist angehalten');
    expect(fristWort({ zustand: 'nicht_berechenbar', tageRest: undefined })).toBe('—');
    expect(fristWort({ zustand: 'laeuft', tageRest: undefined }, 'lang')).toBe('Frist nicht berechenbar');
  });

  it('Meilenstein: gerissen und fällig — nie „überfällig"', () => {
    expect(gerissenWort(33)).toBe('gerissen seit 33 T');
    expect(gerissenWort(33, 'lang')).toBe('seit 33 Tagen gerissen');
    expect(gerissenWort(null)).toBe('gerissen');
    expect(faelligWort(5)).toBe('fällig in 5 T');
    expect(faelligWort(5, 'lang')).toBe('in 5 Tagen fällig');
    expect(faelligWort(0)).toBe('heute fällig');
  });

  it('Stillstand: keine Bewegung, mit Ziel und „mindestens" nur bei genäherter Liegezeit', () => {
    expect(bewegungWort(35, 21, true)).toBe('keine Bewegung seit 35 T (Ziel 21 T)');
    expect(bewegungWort(35, 21, false)).toBe('keine Bewegung seit ≥35 T (Ziel 21 T)');
    expect(bewegungWort(35, 21, false, 'lang')).toBe('keine Bewegung seit mindestens 35 Tagen, Ziel 21 Tage');
    expect(bewegungWort(35, null, true, 'lang')).toBe('keine Bewegung seit 35 Tagen');
    expect(bewegungWort(null, 21, true)).toBe('keine datierte Bewegung');
  });

  it('kein Wort dieses Moduls sagt „überfällig"', () => {
    const woerter = [
      fristTageWort(-4), fristTageWort(-4, 'lang'), gerissenWort(4), gerissenWort(4, 'lang'),
      faelligWort(4), bewegungWort(40, 21, false, 'lang'),
    ];
    for (const w of woerter) expect(w).not.toMatch(/überfällig/);
  });
});
