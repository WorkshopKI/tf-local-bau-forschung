import { describe, expect, it } from 'vitest';
import {
  entwuerfePunkt,
  feedbackPunkt,
  kuerzelStatusPunkt,
  liegtBeiAnderenPunkte,
  MAX_NAMEN,
  nachtlaufPunkt,
  neuPunkt,
  registryPunkt,
  satzAus,
  stillstandPunkte,
  weitermachenPunkt,
  zuTunPunkte,
  type FremdRoh,
  type FristRoh,
} from '../punkte';
import type { NachtlaufName } from '../nachtlaufNamen';
import { aktiveThemen, THEMEN } from '../themen';
import type { BriefPunkt, Segment, ThemaId } from '../typen';

const frist = (over: Partial<FristRoh> = {}): FristRoh => ({
  verbundId: 'VB1', akronym: 'HACKKI', grund: 'Gutachten offen', tage: 3, weitere: 0, ...over,
});

const name = (n: string, over: Partial<NachtlaufName> = {}): NachtlaufName => ({
  scopeId: `VB-${n}`, name: n, anzahl: 1, statusNeu: null, ...over,
});

const fremd = (titel: string, tage: number, over: Partial<FremdRoh> = {}): FremdRoh => ({
  scopeId: `VB-${titel}`, titel, tage, adresse: { art: 'liegt', wer: 'FB' }, ...over,
});

const ziele = (p: BriefPunkt): Extract<Segment, { art: 'ziel' }>[] =>
  p.segmente.filter((s): s is Extract<Segment, { art: 'ziel' }> => s.art === 'ziel');

/** Jeder Bauer, einmal mit Inhalt aufgerufen — für die Quer-Invarianten. */
const ALLE_PUNKTE = (): BriefPunkt[] => [
  ...stillstandPunkte([frist({ tage: -9 })]),
  ...zuTunPunkte([{ scopeId: 'VB2', titel: 'ZKN', text: 'QS anstoßen', tage: 4, rueckfall: false }]),
  ...liegtBeiAnderenPunkte([fremd('CALYPSO', -304), fremd('KITED', -172)]),
  kuerzelStatusPunkt([{ scopeId: 'VB9', titel: 'HACKKI', status: 'techn geprüft' }])!,
  nachtlaufPunkt([name('BauKo-Pilot'), name('LewisAI')], 'über Nacht')!,
  neuPunkt(2)!,
  entwuerfePunkt(1, 'VB3')!,
  weitermachenPunkt('HACKKI', 'VB1')!,
  feedbackPunkt(2)!,
  registryPunkt(5)!,
];

describe('punkte — satz und segmente können nicht auseinanderlaufen', () => {
  it('`satz` ist immer die Verkettung der Segment-Texte', () => {
    for (const p of ALLE_PUNKTE()) {
      expect(p.satz, `Thema ${p.themaId}`).toBe(satzAus(p.segmente));
    }
  });

  it('jeder Punkt trägt eine Rückfrage und mindestens ein Segment', () => {
    for (const p of ALLE_PUNKTE()) {
      expect(p.frage.trim(), `Thema ${p.themaId}`).not.toBe('');
      expect(p.segmente.length, `Thema ${p.themaId}`).toBeGreaterThan(0);
    }
  });

  it('jeder Punkt hat ein Sprungziel, und keines steht doppelt', () => {
    // Seit v6.61 tragen Namenslisten mehrere Ziele — jedes Wort eine Stelle,
    // aber nie zweimal dieselbe.
    for (const p of ALLE_PUNKTE()) {
      const z = ziele(p).map(s => JSON.stringify(s.ziel));
      expect(z.length, `Thema ${p.themaId}`).toBeGreaterThan(0);
      expect(new Set(z).size, `Thema ${p.themaId}`).toBe(z.length);
    }
  });

  it('nur die zwei Uhr-Themen tragen eine Tageszahl', () => {
    const mitUhr = ALLE_PUNKTE().filter(p => p.tage !== null).map(p => p.themaId);
    expect(new Set(mitUhr)).toEqual(new Set(['stillstand', 'zu-tun']));
  });
});

describe('punkte — Stillstands-Sätze', () => {
  it('unterscheidet überfällig, heute und bevorstehend', () => {
    expect(stillstandPunkte([frist({ tage: -4 })])[0]!.satz)
      .toContain('seit 4 Tagen überfällig');
    expect(stillstandPunkte([frist({ tage: 0 })])[0]!.satz)
      .toContain('heute überfällig');
    expect(stillstandPunkte([frist({ tage: 6 })])[0]!.satz)
      .toContain('in 6 Tagen überfällig');
  });

  it('nennt gebündelte Geschwister, statt sie zu verschweigen', () => {
    expect(stillstandPunkte([frist({ weitere: 2 })])[0]!.satz)
      .toContain('und 2 weitere im selben Verbund');
    expect(stillstandPunkte([frist({ weitere: 0 })])[0]!.satz)
      .not.toContain('weitere');
  });

  it('reicht die Tageszahl unverändert durch — der Adapter dreht das Vorzeichen', () => {
    expect(stillstandPunkte([frist({ tage: -4 })])[0]!.tage).toBe(-4);
  });
});

describe('punkte — der Rückfall gibt sich zu erkennen', () => {
  it('markiert und benennt eine Aussage aus der alten Status-Formel', () => {
    const p = zuTunPunkte([
      { scopeId: 'VB1', titel: 'HACKKI', text: 'Gutachten anfordern', tage: 2, rueckfall: true },
    ])[0]!;
    expect(p.rueckfall).toBe(true);
    expect(p.satz).toContain('aus dem Status abgeleitet');
  });

  it('schweigt darüber, wenn die Kaskade getragen hat', () => {
    const p = zuTunPunkte([
      { scopeId: 'VB1', titel: 'HACKKI', text: 'Gutachten anfordern', tage: 2, rueckfall: false },
    ])[0]!;
    expect(p.rueckfall).toBeUndefined();
    expect(p.satz).not.toContain('abgeleitet');
  });
});

describe('punkte — der Stand von vor dem Import gibt sich zu erkennen', () => {
  it('sagt in Worten, dass die Aufgabe noch neu berechnet wird', () => {
    const p = zuTunPunkte([
      { scopeId: 'VB1', titel: 'HACKKI', text: 'Gutachten anfordern', tage: 2, rueckfall: false, vorlaeufig: true },
    ])[0]!;
    expect(p.satz).toContain('Stand vor der Datenaktualisierung');
  });

  it('schweigt darüber ohne den Vermerk', () => {
    const p = zuTunPunkte([
      { scopeId: 'VB1', titel: 'HACKKI', text: 'Gutachten anfordern', tage: 2, rueckfall: false },
    ])[0]!;
    expect(p.satz).not.toContain('Datenaktualisierung');
  });
});

describe('punkte — leere Quellen schweigen', () => {
  it('gibt null bzw. nichts zurück, statt eine Null zu melden', () => {
    expect(nachtlaufPunkt([], 'über Nacht')).toBeNull();
    expect(liegtBeiAnderenPunkte([])).toEqual([]);
    expect(kuerzelStatusPunkt([])).toBeNull();
    expect(neuPunkt(0)).toBeNull();
    expect(entwuerfePunkt(0, null)).toBeNull();
    expect(feedbackPunkt(0)).toBeNull();
    expect(registryPunkt(0)).toBeNull();
    expect(weitermachenPunkt('  ', 'VB1')).toBeNull();
  });
});

describe('punkte — Einzahl und Mehrzahl', () => {
  it('schreibt die Eins aus und beugt das Verb mit', () => {
    expect(neuPunkt(1)!.satz).toBe('ein Antrag ist neu dazugekommen');
    expect(neuPunkt(4)!.satz).toBe('4 Anträge sind neu dazugekommen');
    expect(entwuerfePunkt(1, 'VB1')!.satz).toBe('ein eigener Entwurf wartet auf dich');
    expect(entwuerfePunkt(2, 'VB1')!.satz).toBe('2 eigene Entwürfe warten auf dich');
    expect(liegtBeiAnderenPunkte([fremd('CALYPSO', -1)])[0]!.satz).toBe('bei FB liegt CALYPSO');
    expect(liegtBeiAnderenPunkte([fremd('A', -2), fremd('B', -1)])[0]!.satz).toBe('bei FB liegen A und B');
  });
});

/**
 * Gemessen 11.09.2026 (Kürzel THü): der Brief sagte „4 Vorgänge haben sich über
 * Nacht geändert" — gemeint waren BauKo-Pilot (3 TV) und LewisAI.
 */
describe('punkte — über Nacht mit Namen', () => {
  it('nennt die Vorgänge und den neuen Status in Worten', () => {
    const p = nachtlaufPunkt(
      [name('BauKo-Pilot', { statusNeu: 'bewilligungsreif' }), name('LewisAI')], 'über Nacht',
    )!;
    expect(p.satz).toBe('über Nacht geändert: BauKo-Pilot (Status jetzt „bewilligungsreif“) und LewisAI');
  });

  it(`nennt höchstens ${MAX_NAMEN} Namen und zählt den Rest`, () => {
    const p = nachtlaufPunkt(['A', 'B', 'C', 'D', 'E'].map(n => name(n)), 'über Nacht')!;
    expect(p.satz).toBe('über Nacht geändert: A, B, C und 2 weitere');
  });

  it('jeder Name springt in seinen Vorgang', () => {
    const p = nachtlaufPunkt([name('BauKo-Pilot'), name('LewisAI')], 'über Nacht')!;
    expect(ziele(p).map(s => s.ziel)).toEqual([
      { art: 'antrag', scopeId: 'VB-BauKo-Pilot' },
      { art: 'antrag', scopeId: 'VB-LewisAI' },
    ]);
  });
});

/**
 * Gemessen 11.09.2026 (Kürzel THü, liest als FB): AIRES „GA schreiben" — liegt
 * bei AB — stand an der Spitze, als wäre es die Aufgabe des Lesers.
 */
describe('punkte — was bei anderen liegt', () => {
  it('eine Liste je Adresse, in den Wörtern der Nebenzeile', () => {
    const p = liegtBeiAnderenPunkte([
      fremd('CALYPSO', -304),
      fremd('KITED', -172),
      fremd('ATLAS', -5, { adresse: { art: 'wartet', wer: 'Antragsteller' } }),
      fremd('ZKN', -3, { adresse: { art: 'wartet', wer: 'QS' } }),
    ]);
    expect(p.map(x => x.satz)).toEqual([
      'bei FB liegen CALYPSO und KITED',
      'auf den Antragsteller wartet ATLAS',
      'auf QS wartet ZKN',
    ]);
    expect(p.every(x => x.themaId === 'liegt-bei-anderen' && x.tage === null)).toBe(true);
  });

  it('dringlichste zuerst, höchstens drei Namen', () => {
    const p = liegtBeiAnderenPunkte([
      fremd('E', 20), fremd('B', -100), fremd('D', 3), fremd('A', -300), fremd('C', -2),
    ])[0]!;
    expect(p.satz).toBe('bei FB liegen A, B, C und 2 weitere');
  });

  it('ein Vorgang steht einmal, an seinem dringlichsten Anlass', () => {
    const p = liegtBeiAnderenPunkte([
      fremd('KITED', -10, { scopeId: 'VB1' }), fremd('KITED', -172, { scopeId: 'VB1' }),
    ])[0]!;
    expect(p.satz).toBe('bei FB liegt KITED');
  });

  it('ein einzelner Vorgang reist mit der Rückfrage, eine Liste nicht', () => {
    expect(liegtBeiAnderenPunkte([fremd('KITED', -1)])[0]!.gruppe).toBe('VB-KITED');
    expect(liegtBeiAnderenPunkte([fremd('A', -1), fremd('B', -2)])[0]!.gruppe).toBeUndefined();
  });
});

/**
 * „Meine Anträge" zählt laut Kürzeln erledigte Vorgänge nicht mehr als offen
 * (Sperre im AB-Satz); der Brief nennt dieselbe Menge als Befund.
 */
describe('punkte — Kürzel ↔ Status', () => {
  it('nennt den Widerspruch, ohne eine Handlung zu behaupten', () => {
    const p = kuerzelStatusPunkt([{ scopeId: 'VB9', titel: 'HACKKI', status: 'techn geprüft' }])!;
    expect(p.satz).toBe('HACKKI ist laut Kürzeln erledigt, der Status sagt noch „techn geprüft“');
    expect(p.tage).toBeNull();
    expect(p.gruppe).toBe('VB9');
  });

  it('ohne Status-Text sagt er nur, dass der Status offen ist', () => {
    expect(kuerzelStatusPunkt([{ scopeId: 'VB9', titel: 'X', status: ' ' }])!.satz)
      .toBe('X ist laut Kürzeln erledigt, trägt aber noch einen offenen Status');
  });

  it('mehrere: eine Liste, jeder mit seinem Status', () => {
    const p = kuerzelStatusPunkt([
      { scopeId: 'VB1', titel: 'A', status: 'ablehnungsreif' },
      { scopeId: 'VB2', titel: 'B', status: 'techn geprüft' },
    ])!;
    expect(p.satz).toBe('laut Kürzeln erledigt, der Status sagt noch etwas anderes: A („ablehnungsreif“) und B („techn geprüft“)');
    expect(p.gruppe).toBeUndefined();
  });
});

/**
 * `gruppe` ist nicht nur der Entdopplungs-Schlüssel — es ist das Subjekt, das der
 * Rückfrage-Knopf dem Assistenten mitgibt. Ein Punkt, der nach EINEM Vorgang
 * fragt und ihn nicht benennt, landet beim Modell als „Keine Entität ausgewählt".
 */
describe('punkte — wer nach einem Vorgang fragt, benennt ihn', () => {
  const FRIST: FristRoh = {
    verbundId: 'VB1', akronym: 'CALYPSO', grund: 'Widerspruch', tage: -302, weitere: 0,
  };

  it('Stillstands- und To-do-Punkte tragen ihren Vorgang', () => {
    expect(stillstandPunkte([FRIST])[0]!.gruppe).toBe('VB1');
    expect(zuTunPunkte([
      { scopeId: 'VB2', titel: 'KITED', text: 'Rückmeldung', tage: -204, rueckfall: false },
    ])[0]!.gruppe).toBe('VB2');
  });

  it('„Wo stehe ich bei X?" trägt ihn auch', () => {
    const p = weitermachenPunkt('HACKKI', 'VB3')!;
    expect(p.frage).toBe('Wo stehe ich bei HACKKI?');
    expect(p.gruppe).toBe('VB3');
  });

  it('eine Listenfrage bleibt ohne Vorgang', () => {
    // „Welche Entwürfe habe ich offen?" spricht über eine Menge; ein einzelner
    // Vorgang daneben wäre eine Verengung, die die Frage nicht meint.
    expect(entwuerfePunkt(3, 'VB1')!.gruppe).toBeUndefined();
    expect(nachtlaufPunkt([name('A'), name('B')], 'über Nacht')!.gruppe).toBeUndefined();
    expect(feedbackPunkt(2)!.gruppe).toBeUndefined();
  });
});

/**
 * Gemessen 11.09.2026 (Kürzel THü, damals am Meilenstein-Thema): der Brief sagte
 * „KITED ist seit 227 Tagen fällig (QS freigegeben und versendet)", die Karte
 * darunter „Stellungnahme RNE prüfen". Die Klammer las sich als eingetretener
 * Zustand — und weil der Frist-Punkt den Verbund im Brief vertrat, fiel die
 * Aufgabe ganz weg. Für den Stillstand gilt dieselbe Form.
 */
describe('punkte — der Stillstand nennt sich, die Handlung kommt aus der Kaskade', () => {
  const ST: FristRoh = {
    verbundId: 'VB1', akronym: 'KITED', grund: 'Gutachten fertig', tage: -9, weitere: 0,
  };

  it('ein Stillstand steht als Stillstand da, nicht als nackte Klammer', () => {
    expect(stillstandPunkte([ST])[0]!.satz)
      .toBe('KITED: Stillstand „Gutachten fertig“ seit 9 Tagen überfällig.');
  });

  it('mit Aufgabe: die Uhr in der Klammer, die Handlung hinter dem Doppelpunkt', () => {
    const p = stillstandPunkte([{ ...ST, aufgabe: { text: 'QS anstoßen', rueckfall: false } }])[0]!;
    expect(p.satz).toBe('KITED (Stillstand „Gutachten fertig“ seit 9 Tagen überfällig): QS anstoßen.');
  });

  it('gebündelte Geschwister stehen bei der Uhr, nicht bei der Aufgabe', () => {
    const p = stillstandPunkte([
      { ...ST, weitere: 2, aufgabe: { text: 'QS anstoßen', rueckfall: false } },
    ])[0]!;
    expect(p.satz).toBe(
      'KITED (Stillstand „Gutachten fertig“ seit 9 Tagen überfällig — und 2 weitere im selben Verbund): QS anstoßen.',
    );
  });

  it('Rückfall und vorläufiger Stand geben sich auch am Stillstands-Satz zu erkennen', () => {
    const p = stillstandPunkte([
      { ...ST, aufgabe: { text: 'Gutachten anfordern', rueckfall: true, vorlaeufig: true } },
    ])[0]!;
    expect(p.rueckfall).toBe(true);
    expect(p.satz).toContain('aus dem Status abgeleitet');
    expect(p.satz).toContain('Stand vor der Datenaktualisierung');
  });

  it('ohne Aufgabe trägt der Punkt keinen Rückfall', () => {
    expect(stillstandPunkte([ST])[0]!.rueckfall).toBeUndefined();
  });
});

/**
 * Bis v6.60.3 gab es das Thema „Fristen" (Meilensteine). Es verdrängte beim
 * Entdoppeln den To-do-Punkt und schob eine lange Bedingungs-Bezeichnung vor
 * die Aufgabe — im Brief stand ein Plan-Termin statt einer Handlung.
 */
describe('themen — der Katalog', () => {
  it('der Katalog führt kein Meilenstein-Thema mehr', () => {
    expect(THEMEN.map(t => t.id as string)).not.toContain('fristen');
  });

  it('eine alte Abwahl „fristen" in einer gespeicherten Config schadet nicht', () => {
    const alt = ['fristen'] as unknown as ThemaId[];
    expect(aktiveThemen(alt)).toEqual(aktiveThemen([]));
  });

  it('„Liegt bei anderen" und „Kürzel ↔ Status" sind Themen ohne Uhr', () => {
    for (const id of ['liegt-bei-anderen', 'kuerzel-status'] as const) {
      const t = THEMEN.find(x => x.id === id);
      expect(t?.uhr, id).toBe(false);
      expect(t?.familie, id).toBe('arbeitsvorrat');
    }
  });
});
