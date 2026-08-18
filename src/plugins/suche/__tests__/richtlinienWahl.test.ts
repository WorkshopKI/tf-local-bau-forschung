import { describe, it, expect } from 'vitest';
import { wendeRichtlinienAn } from '../richtlinienWahl';
import { bereichsMenge } from '@/core/status/betrachtungsbereich';
import type { UnifiedSearchResult } from '@/core/types/search-result';

function treffer(id: string, code?: string): UnifiedSearchResult {
  return {
    id, type: 'antrag', title: id, score: 1,
    ...(code === undefined ? {} : { unterprogrammCode: code }),
  } as UnifiedSearchResult;
}

const LISTE = [
  treffer('neu', '136'),
  treffer('alt', '34'),
  treffer('ohne'),
];

describe('wendeRichtlinienAn', () => {
  it('gibt bei „alle" dieselbe Liste zurück — identisch, nicht kopiert', () => {
    expect(wendeRichtlinienAn(LISTE, null)).toBe(LISTE);
  });

  it('nimmt weg, was außerhalb der gewählten Richtlinien liegt', () => {
    const übrig = wendeRichtlinienAn(LISTE, bereichsMenge(['136']));
    expect(übrig.map(r => r.id)).toEqual(['neu', 'ohne']);
  });

  it('behält Treffer OHNE Programm-Nummer — geraten wird nicht', () => {
    // Ein Dokument ohne verknüpften Antrag trägt keine Richtlinie. Es
    // wegzuwerfen hieße, eine Zugehörigkeit zu behaupten, die niemand kennt —
    // dieselbe Regel, nach der die Marke „außerhalb des Anzeigebereichs" nur an
    // Treffern MIT Code hängt.
    const übrig = wendeRichtlinienAn(LISTE, bereichsMenge(['999']));
    expect(übrig.map(r => r.id)).toEqual(['ohne']);
  });

  it('vergleicht normalisiert — ein gepolsterter Code trifft trotzdem', () => {
    const übrig = wendeRichtlinienAn([treffer('x', ' 136 ')], bereichsMenge(['136']));
    expect(übrig).toHaveLength(1);
  });
});
