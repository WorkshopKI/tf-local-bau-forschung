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

/**
 * Die Zusammensetzung (v4.104): Aehnlichkeits-Treffer bleiben in ALLEN Zahlen —
 * die Liste unter der Karte zeigt sie ja auch —, aber der Befund sagt, wie viele
 * es sind. Sonst liest das Modell „gering 625" als 625 belegte Fundstuecke.
 */
describe('Befund: Wortlaut gegen Aehnlichkeit', () => {
  const wort = { id: 'w', trefferfelder: ['titel' as const], relevanzStufe: 3 as const };
  const nurAehnlich = { id: 'a', trefferfelder: ['aehnlichkeit' as const], relevanzStufe: 1 as const };

  it('zaehlt die nur thematischen Treffer, ohne sie herauszurechnen', () => {
    const b = baueBefund([
      treffer(wort), treffer({ ...nurAehnlich, id: 'a1' }), treffer({ ...nurAehnlich, id: 'a2' }),
    ]);
    expect(b.gesamt).toBe(3);
    expect(b.nurAehnlich).toBe(2);
  });

  it('nennt die Zerlegung in DERSELBEN Zeile wie die Gesamtzahl', () => {
    const t = befundAlsText(baueBefund([treffer(wort), treffer(nurAehnlich)]));
    expect(t).toContain('Treffer insgesamt: 2 (1 mit gesuchtem Wortlaut, 1 nur thematisch ähnlich)');
  });

  it('schweigt dazu, wenn die Aehnlichkeitssuche nicht mitlief', () => {
    const t = befundAlsText(baueBefund([treffer(wort)]));
    expect(t).toContain('Treffer insgesamt: 1');
    expect(t).not.toContain('thematisch');
  });

  it('haelt einen gemischten Treffer fuer belegt — er traegt ein gesuchtes Wort', () => {
    const b = baueBefund([treffer({ id: 'g', trefferfelder: ['titel', 'aehnlichkeit'] })]);
    expect(b.nurAehnlich).toBe(0);
  });
});

describe('die Einschraenkung steht im Befund', () => {
  const MIT_ORT: Frageplan = {
    ...PLAN,
    frage: 'Was läuft in Bayern zum Thema Leichtbau?',
    leitbegriffe: [
      { begriff: 'Leichtbau', nadeln: ['leichtbau'], pflicht: false },
      { begriff: 'Bayern', nadeln: ['bayern'], pflicht: true, feld: 'bundesland' },
    ],
  };

  it('fuehrt Pflichtteile getrennt von den Themen', () => {
    const b = baueBefund([treffer({ id: 'a' })], MIT_ORT);
    expect(b.themen).toEqual(['Leichtbau']);
    expect(b.einschraenkungen).toEqual(['Bayern (Bundesland)']);
  });

  it('sagt im Text, dass ALLE Treffer sie erfuellen', () => {
    // Ohne diese Zeile las die Antwortkarte die Verteilung „Bayern 62 · ohne
    // Angabe 20" als Gegenbeispiel und schrieb zu 82 Bayern-Treffern „davon
    // liegen 62 in Bayern" — ein Widerspruch zur Einschraenkung, unter der sie
    // ueberhaupt in der Liste stehen.
    const t = befundAlsText(baueBefund([treffer({ id: 'a' }), treffer({ id: 'b' })], MIT_ORT));
    expect(t).toContain('ALLE 2 Treffer erfüllen bereits diese Einschränkung: Bayern (Bundesland)');
    expect(t).toContain('kein Gegenbeispiel');
  });

  it('schweigt ohne Pflichtteil', () => {
    const t = befundAlsText(baueBefund([treffer({ id: 'a' })], PLAN));
    expect(t).not.toContain('Einschränkung');
  });
});

describe('die Jahr-Achse des Befunds ist DIESELBE wie die der Facette', () => {
  it('faellt auf das Antragsjahr zurueck, wenn kein Bewilligungsdatum da ist', () => {
    // `werteVon(r,'jahr')` in facetten.ts rechnet
    // `extractYear(bewilligungsdatum) || extractYear(antragsdatum)`. Der Befund
    // las bis v4.136 nur `bewilligungsdatum?.slice(0,4)` — zwei Definitionen
    // derselben Achse auf einem Bildschirm. Am Bestand tragen 9 233 von 14 225
    // ein Bewilligungsdatum, aber 14 221 ein Antragsdatum: die Facette holte
    // Treffer herein, die der Befund als „ohne Angabe" meldete.
    const b = baueBefund([
      treffer({ id: 'a', bewilligungsdatum: '2024-03-01' }),
      treffer({ id: 'b', antragsdatum: '2023-11-02' }),
    ]);
    const jahr = b.verteilungen.find(v => v.achse === 'Jahr');
    expect(jahr?.ohne).toBe(0);
    expect(jahr?.werte.map(w => w.wert).sort()).toEqual(['2023', '2024']);
  });

  it('liest auch das deutsche Datumsformat — `slice(0,4)` haette „01.0" gezaehlt', () => {
    const b = baueBefund([treffer({ id: 'a', bewilligungsdatum: '01.03.2024' })]);
    const jahr = b.verteilungen.find(v => v.achse === 'Jahr');
    expect(jahr?.werte[0]?.wert).toBe('2024');
  });
});
