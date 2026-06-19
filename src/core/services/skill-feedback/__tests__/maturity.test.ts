import { describe, it, expect } from 'vitest';
import { suggestReifegrad } from '../maturity';
import type { SkillAggregat } from '../aggregate';

function agg(p: Partial<SkillAggregat>): SkillAggregat {
  return { nutzung: 0, up: 0, down: 0, letzteNutzung: null, kommentare: [], ...p };
}

describe('suggestReifegrad — beratend', () => {
  it('dünne Datenlage → kein Vorschlag', () => {
    expect(suggestReifegrad(agg({ nutzung: 2 }), 'entwurf')).toBeNull();
    expect(suggestReifegrad(agg({ nutzung: 4, up: 2 }), 'entwurf')).toBeNull();
  });

  it('Nutzung allein stuft entwurf → erprobt', () => {
    expect(suggestReifegrad(agg({ nutzung: 8 }), 'entwurf')).toBe('erprobt');
  });

  it('viel Nutzung + überwiegend 👍 → empfohlen', () => {
    expect(suggestReifegrad(agg({ nutzung: 30, up: 9, down: 1 }), 'entwurf')).toBe('empfohlen');
    expect(suggestReifegrad(agg({ nutzung: 30, up: 9, down: 1 }), 'erprobt')).toBe('empfohlen');
  });

  it('Gleichstand → kein Vorschlag', () => {
    expect(suggestReifegrad(agg({ nutzung: 8 }), 'erprobt')).toBeNull();
    expect(suggestReifegrad(agg({ nutzung: 30, up: 9, down: 1 }), 'empfohlen')).toBeNull();
  });

  it('keine Abstufung ohne klares Negativ-Signal', () => {
    // Hohe Stufe, aber nur mäßige/dünne aktuelle Daten → NICHT zurückstufen.
    expect(suggestReifegrad(agg({ nutzung: 8, up: 3, down: 2 }), 'empfohlen')).toBeNull();
    expect(suggestReifegrad(agg({ nutzung: 6 }), 'empfohlen')).toBeNull();
  });

  it('klares Negativ-Signal stuft ab (empfohlen → entwurf)', () => {
    // 1 von 5 👍 = 0.2 Zustimmung, genug Feedback → klares Signal.
    expect(suggestReifegrad(agg({ nutzung: 30, up: 1, down: 4 }), 'empfohlen')).toBe('entwurf');
    expect(suggestReifegrad(agg({ nutzung: 30, up: 1, down: 4 }), 'erprobt')).toBe('entwurf');
  });

  it('mäßige Ablehnung (über Schwelle) ist kein klares Signal', () => {
    // 2 von 5 👍 = 0.4 > 0.3 → kein klares Negativ; entwurf bleibt entwurf.
    expect(suggestReifegrad(agg({ nutzung: 8, up: 2, down: 3 }), 'entwurf')).toBeNull();
  });

  it('schlägt nie unter den aktuellen Stand ohne Signal, auch bei Nutzungs-Knick', () => {
    // erprobt, aktuell kaum Nutzung, kein Feedback → null (kein Auto-Downgrade).
    expect(suggestReifegrad(agg({ nutzung: 1 }), 'erprobt')).toBeNull();
  });
});
