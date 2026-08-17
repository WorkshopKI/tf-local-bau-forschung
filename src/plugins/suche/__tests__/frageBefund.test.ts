import { describe, it, expect } from 'vitest';
import { baueBefund, befundAlsText } from '../frageBefund';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { Frageplan } from '@/core/services/search/frageplan';

function treffer(p: Partial<UnifiedSearchResult> & { id: string }): UnifiedSearchResult {
  return {
    type: 'antrag', title: `Vorhaben ${p.id}`, snippet: '', score: 0.5, method: 'fulltext',
    ...p,
  } as UnifiedSearchResult;
}

const PLAN: Frageplan = {
  frage: 'Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?',
  leitbegriffe: [
    { begriff: 'Normung', nadeln: ['normung'], pflicht: false },
    { begriff: 'Standards', nadeln: ['standard'], pflicht: false },
  ],
  facetten: { status: [], jahr: [] },
  ignoriert: [],
};

describe('baueBefund', () => {
  it('zählt „trägt ALLE gefragten Themen" über die ganze Menge', () => {
    // Genau das, was die Antwort bis v4.88 nicht sagen konnte: sie stand auf 40
    // von 663 Treffern und musste den Rest offenlassen.
    const b = baueBefund([
      treffer({ id: 'a', abdeckung: 1 }),
      treffer({ id: 'b', abdeckung: 1 }),
      treffer({ id: 'c', abdeckung: 0.5 }),
      treffer({ id: 'd', abdeckung: 0.5 }),
    ], PLAN);
    expect(b.gesamt).toBe(4);
    expect(b.alleThemen).toBe(2);
    expect(b.themen).toEqual(['Normung', 'Standards']);
  });

  it('verträgt den Gleitkomma-Quotienten 2/3 + 1/3', () => {
    // `abdeckung` ist ein Quotient; ein Vergleich auf exakte 1 läge bei 3 von 3
    // Themen still daneben.
    const drei: Frageplan = {
      ...PLAN,
      leitbegriffe: [...PLAN.leitbegriffe, { begriff: 'Messtechnik', nadeln: ['messtech'], pflicht: false }],
    };
    const b = baueBefund([treffer({ id: 'a', abdeckung: 3 / 3 }), treffer({ id: 'b', abdeckung: 2 / 3 })], drei);
    expect(b.alleThemen).toBe(1);
  });

  it('schweigt zu „alle Themen", wenn nur EINES gefragt war', () => {
    // Dort wäre die Zahl gleich `gesamt` und sagte nichts — eine Zeile, die
    // nichts unterscheidet, ist im Prompt verschenkter Kontext.
    const eins: Frageplan = { ...PLAN, leitbegriffe: [PLAN.leitbegriffe[0]!] };
    expect(baueBefund([treffer({ id: 'a', abdeckung: 1 })], eins).alleThemen).toBeNull();
  });

  it('zählt die Relevanzstufen und lässt leere weg', () => {
    const b = baueBefund([
      treffer({ id: 'a', relevanzStufe: 3 }),
      treffer({ id: 'b', relevanzStufe: 3 }),
      treffer({ id: 'c', relevanzStufe: 1 }),
    ], PLAN);
    expect(b.relevanz).toEqual([{ stufe: 3, anzahl: 2 }, { stufe: 1, anzahl: 1 }]);
  });

  it('führt eine Achse gar nicht, wenn kein Treffer sie trägt', () => {
    const b = baueBefund([treffer({ id: 'a' }), treffer({ id: 'b' })], PLAN);
    expect(b.verteilungen.find(v => v.achse === 'Jahr')).toBeUndefined();
  });

  it('zählt fehlende Angaben getrennt, statt sie unter den Tisch fallen zu lassen', () => {
    const b = baueBefund([
      treffer({ id: 'a', bundesland: 'Sachsen' }),
      treffer({ id: 'b', bundesland: 'Sachsen' }),
      treffer({ id: 'c' }),
    ], PLAN);
    const v = b.verteilungen.find(x => x.achse === 'Bundesland');
    expect(v?.werte).toEqual([{ wert: 'Sachsen', anzahl: 2 }]);
    expect(v?.ohne).toBe(1);
  });

  it('kommt ohne Plan aus — dann gibt es keine gefragten Sachen', () => {
    const b = baueBefund([treffer({ id: 'a', relevanzStufe: 2 })], null);
    expect(b.themen).toEqual([]);
    expect(b.alleThemen).toBeNull();
    expect(b.gesamt).toBe(1);
  });
});

describe('befundAlsText', () => {
  it('nennt zu jeder Zahl ihre Bezugsgröße', () => {
    // „158" ist keine Aussage, „158 von 663" schon — das Modell soll die Zahl
    // übernehmen können, ohne sie einordnen zu müssen.
    const t = befundAlsText(baueBefund([
      treffer({ id: 'a', abdeckung: 1, relevanzStufe: 3, bundesland: 'Sachsen' }),
      treffer({ id: 'b', abdeckung: 0.5, relevanzStufe: 1, bundesland: 'Bayern' }),
    ], PLAN));
    expect(t).toContain('Treffer insgesamt: 2');
    expect(t).toContain('1 von 2');
    expect(t).toContain('Normung · Standards');
    expect(t).toContain('hoch 1');
  });
});
