import { describe, it, expect } from 'vitest';
import { wendeRichtlinienAn, zaehleErreichbareAntraege } from '../richtlinienWahl';
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

describe('zaehleErreichbareAntraege', () => {
  // 100 Anträge: 60 in der laufenden Richtlinie, 30 in einer alten, 10 ohne Nummer.
  const JE = new Map([['136', 60], ['34', 30], ['', 10]]);

  it('gibt bei „alle" die Index-Zahl zurück — unverändert', () => {
    expect(zaehleErreichbareAntraege(100, JE, null)).toBe(100);
  });

  it('zieht ab, was außerhalb liegt — und lässt die Namenlosen drin', () => {
    // 100 − 30 = 70: die 10 ohne Nummer stehen weiter in der Trefferliste,
    // also gehören sie auch in den Nenner.
    expect(zaehleErreichbareAntraege(100, JE, bereichsMenge(['136']))).toBe(70);
  });

  it('bleibt bei der Index-Zahl, solange die Zählung fehlt', () => {
    // Eine halb geladene Auskunft wäre schlechter als die ganze: der Nenner
    // darf nicht kurz auf 0 springen, während die Projektion noch liest.
    expect(zaehleErreichbareAntraege(100, null, bereichsMenge(['136']))).toBe(100);
    expect(zaehleErreichbareAntraege(100, new Map(), bereichsMenge(['136']))).toBe(100);
  });

  it('rechnet die Gesamtzahl nicht ins Minus', () => {
    // Zählung und Index kommen aus demselben Store, können aber während eines
    // Imports auseinanderliegen. Eine negative Menge ist keine Auskunft.
    expect(zaehleErreichbareAntraege(20, JE, bereichsMenge(['136']))).toBe(0);
  });

  it('vergleicht normalisiert — ein gepolsterter Code zählt dazu', () => {
    expect(zaehleErreichbareAntraege(100, new Map([[' 136 ', 60]]), bereichsMenge(['136'])))
      .toBe(100);
  });
});
