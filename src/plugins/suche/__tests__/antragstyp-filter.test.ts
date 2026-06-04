import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { getSucheAntragstypItems, matchesSucheAntragstyp } from '../suchseite-utils';

/** Minimaler UnifiedSearchResult-Stub — die Antragstyp-Helper lesen nur
 *  `type` + `vbPhase`. */
function antrag(vbPhase: number | undefined): UnifiedSearchResult {
  return { id: 'x', type: 'antrag', score: 1, method: 'hybrid', title: 't', snippet: '', vbPhase } as UnifiedSearchResult;
}
function dokument(): UnifiedSearchResult {
  return { id: 'd', type: 'dokument', score: 1, method: 'hybrid', title: 't', snippet: '' } as UnifiedSearchResult;
}

describe('getSucheAntragstypItems', () => {
  it('zählt FuE/DS/DL/NW über die Antrag-Treffer; Alle = Antrag-Anzahl (ohne Dokumente)', () => {
    const items = getSucheAntragstypItems([
      antrag(3), // FuE
      antrag(5), // DS
      antrag(4), // DL
      antrag(1), // NW
      antrag(2), // NW
      antrag(9), // Irrläufer → keinem Bucket zugeordnet, zählt aber zu Alle
      dokument(), // zählt NICHT
    ]);
    const byLabel = Object.fromEntries(items.map(i => [i.label, i.count]));
    expect(items.map(i => i.label)).toEqual(['Alle', 'FuE', 'DS', 'DL', 'NW']);
    expect(byLabel).toEqual({ Alle: 6, FuE: 1, DS: 1, DL: 1, NW: 2 });
  });
});

describe('matchesSucheAntragstyp', () => {
  it('„Alle" matcht jeden Treffer (auch Dokumente)', () => {
    expect(matchesSucheAntragstyp(antrag(3), 'Alle')).toBe(true);
    expect(matchesSucheAntragstyp(dokument(), 'Alle')).toBe(true);
  });

  it('ein Bucket matcht nur den passenden Antrag-Treffer', () => {
    expect(matchesSucheAntragstyp(antrag(3), 'FuE')).toBe(true);
    expect(matchesSucheAntragstyp(antrag(5), 'FuE')).toBe(false);
    expect(matchesSucheAntragstyp(antrag(1), 'NW')).toBe(true);
  });

  it('Dokumente und Irrläufer (vb_phase 9) matchen keinen Bucket', () => {
    expect(matchesSucheAntragstyp(dokument(), 'FuE')).toBe(false);
    expect(matchesSucheAntragstyp(antrag(9), 'FuE')).toBe(false);
    expect(matchesSucheAntragstyp(antrag(undefined), 'FuE')).toBe(false);
  });
});
