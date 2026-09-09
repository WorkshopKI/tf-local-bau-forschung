import { describe, expect, it } from 'vitest';
import {
  entwuerfePunkt,
  feedbackPunkt,
  meilensteinPunkte,
  nachtlaufPunkt,
  neuPunkt,
  registryPunkt,
  satzAus,
  stillstandPunkte,
  weitermachenPunkt,
  zuTunPunkte,
  type FristRoh,
} from '../punkte';
import type { BriefPunkt } from '../typen';

const frist = (over: Partial<FristRoh> = {}): FristRoh => ({
  verbundId: 'VB1', akronym: 'HACKKI', grund: 'Gutachten offen', tage: 3, weitere: 0, ...over,
});

/** Jeder Bauer, einmal mit Inhalt aufgerufen — für die Quer-Invarianten. */
const ALLE_PUNKTE = (): BriefPunkt[] => [
  ...meilensteinPunkte([frist()]),
  ...stillstandPunkte([frist({ tage: -9 })]),
  ...zuTunPunkte([{ scopeId: 'VB2', titel: 'ZKN', text: 'QS anstoßen', tage: 4, rueckfall: false }]),
  nachtlaufPunkt(3, 'über Nacht')!,
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

  it('jeder Punkt hat genau ein Sprungziel — eine Zahl, eine Stelle', () => {
    for (const p of ALLE_PUNKTE()) {
      const ziele = p.segmente.filter(s => s.art === 'ziel');
      expect(ziele.length, `Thema ${p.themaId}`).toBe(1);
    }
  });

  it('nur die drei Uhr-Themen tragen eine Tageszahl', () => {
    const mitUhr = ALLE_PUNKTE().filter(p => p.tage !== null).map(p => p.themaId);
    expect(new Set(mitUhr)).toEqual(new Set(['fristen', 'stillstand', 'zu-tun']));
  });
});

describe('punkte — Frist-Sätze', () => {
  it('unterscheidet überfällig, heute und bevorstehend', () => {
    expect(meilensteinPunkte([frist({ tage: -4 })])[0]!.satz)
      .toContain('seit 4 Tagen fällig');
    expect(meilensteinPunkte([frist({ tage: 0 })])[0]!.satz)
      .toContain('heute fällig');
    expect(meilensteinPunkte([frist({ tage: 6 })])[0]!.satz)
      .toContain('in 6 Tagen fällig');
  });

  it('Zieltage sprechen von Überfälligkeit, Meilensteine von Fälligkeit', () => {
    // CONTEXT.md: Zieltage messen Stillstand, Meilensteine einen Termin —
    // die beiden dürfen im Brief nicht gleich klingen.
    expect(stillstandPunkte([frist({ tage: -9 })])[0]!.satz).toContain('überfällig');
    expect(meilensteinPunkte([frist({ tage: -9 })])[0]!.satz).toContain('fällig');
    expect(meilensteinPunkte([frist({ tage: -9 })])[0]!.satz).not.toContain('überfällig');
  });

  it('nennt gebündelte Geschwister, statt sie zu verschweigen', () => {
    expect(meilensteinPunkte([frist({ weitere: 2 })])[0]!.satz)
      .toContain('und 2 weitere im selben Verbund');
    expect(meilensteinPunkte([frist({ weitere: 0 })])[0]!.satz)
      .not.toContain('weitere');
  });

  it('reicht die Tageszahl unverändert durch — der Adapter dreht das Vorzeichen', () => {
    expect(meilensteinPunkte([frist({ tage: -4 })])[0]!.tage).toBe(-4);
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

describe('punkte — leere Quellen schweigen', () => {
  it('gibt null zurück, statt eine Null zu melden', () => {
    expect(nachtlaufPunkt(0, 'über Nacht')).toBeNull();
    expect(neuPunkt(0)).toBeNull();
    expect(entwuerfePunkt(0, null)).toBeNull();
    expect(feedbackPunkt(0)).toBeNull();
    expect(registryPunkt(0)).toBeNull();
    expect(weitermachenPunkt('  ', 'VB1')).toBeNull();
  });
});

describe('punkte — Einzahl und Mehrzahl', () => {
  it('schreibt die Eins aus und beugt das Verb mit', () => {
    expect(nachtlaufPunkt(1, 'über Nacht')!.satz).toBe('ein Vorgang hat sich über Nacht geändert');
    expect(nachtlaufPunkt(3, 'über Nacht')!.satz).toBe('3 Vorgänge haben sich über Nacht geändert');
    expect(neuPunkt(1)!.satz).toBe('ein Antrag ist neu dazugekommen');
    expect(neuPunkt(4)!.satz).toBe('4 Anträge sind neu dazugekommen');
    expect(entwuerfePunkt(1, 'VB1')!.satz).toBe('ein eigener Entwurf wartet auf dich');
    expect(entwuerfePunkt(2, 'VB1')!.satz).toBe('2 eigene Entwürfe warten auf dich');
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

  it('Frist-, Stillstands- und To-do-Punkte tragen ihren Vorgang', () => {
    expect(meilensteinPunkte([FRIST])[0]!.gruppe).toBe('VB1');
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
    expect(nachtlaufPunkt(5, 'über Nacht')!.gruppe).toBeUndefined();
    expect(feedbackPunkt(2)!.gruppe).toBeUndefined();
  });
});
