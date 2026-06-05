/**
 * Tests fuer `stundenProTVFor` (v2.31) — zentraler Aufloeser fuer den
 * Antragstyp-spezifischen Stunden-pro-TV-Faktor.
 */
import { describe, it, expect } from 'vitest';
import { stundenProTVFor } from '../types';

describe('stundenProTVFor', () => {
  it('Override gewinnt ueber den Standard', () => {
    expect(stundenProTVFor({ stundenProTV: 9, stundenProTVProTyp: { DS: 4.5 } }, 'DS')).toBe(4.5);
  });

  it('ohne Override fuer den Bucket → Standard', () => {
    expect(stundenProTVFor({ stundenProTV: 9, stundenProTVProTyp: { DS: 4.5 } }, 'FuE')).toBe(9);
  });

  it('fehlende/leere Map → Standard', () => {
    expect(stundenProTVFor({ stundenProTV: 9 }, 'DS')).toBe(9);
    expect(stundenProTVFor({ stundenProTV: 9, stundenProTVProTyp: {} }, 'DS')).toBe(9);
  });

  it('ohne Bucket (Aggregat) → Standard', () => {
    expect(stundenProTVFor({ stundenProTV: 7, stundenProTVProTyp: { DS: 4.5 } })).toBe(7);
    expect(stundenProTVFor({ stundenProTV: 7, stundenProTVProTyp: { DS: 4.5 } }, null)).toBe(7);
  });

  it('0/negativer Override → Standard-Fallback', () => {
    expect(stundenProTVFor({ stundenProTV: 9, stundenProTVProTyp: { DS: 0 } }, 'DS')).toBe(9);
    expect(stundenProTVFor({ stundenProTV: 9, stundenProTVProTyp: { DS: -2 } }, 'DS')).toBe(9);
  });

  it('0/negativer Standard → 9-Fallback', () => {
    expect(stundenProTVFor({ stundenProTV: 0 })).toBe(9);
    expect(stundenProTVFor({ stundenProTV: -1 }, 'FuE')).toBe(9);
  });
});
