import { describe, it, expect } from 'vitest';
import {
  spearmanCorrelation,
  ranks,
  bewertungenToVirtuell,
  historicalAsVirtuell,
  calibrateSingle,
  gridSearchOptimalConfidence,
  klassifizierungsAccuracy,
  aggregateGridResults,
  explainDeviation,
} from '../services/onboarding-kalibrierung';
import type { Antrag } from '@/core/services/csv/types';
import type { OnboardingBewertungEintrag, UeberKategorie } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: '2026-05-01T00:00:00Z',
    ...fields,
  } as Antrag;
}

describe('ranks', () => {
  it('hoechster Wert -> Rang 1', () => {
    expect(ranks([10, 5, 1])).toEqual([1, 2, 3]);
  });
  it('Ties bekommen den Durchschnitts-Rang', () => {
    // Werte sortiert: [5, 5, 3, 1] -> Raenge 1, 2 (Ties) -> avg 1.5; 3 -> 3; 1 -> 4
    expect(ranks([5, 5, 3, 1])).toEqual([1.5, 1.5, 3, 4]);
  });
  it('alle gleich -> alle gleicher Rang', () => {
    expect(ranks([2, 2, 2])).toEqual([2, 2, 2]);
  });
});

describe('spearmanCorrelation', () => {
  it('identische Reihenfolge -> 1.0', () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1, 5);
  });
  it('umgekehrte Reihenfolge -> -1.0', () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 5);
  });
  it('Wikipedia-aehnliches Beispiel [1,2,3,4,5] vs [1,4,2,3,5] = 0.7', () => {
    // ranks([1,2,3,4,5]) = [5,4,3,2,1]; ranks([1,4,2,3,5]) = [5,2,4,3,1]
    // d^2 = 0+4+1+1+0 = 6; Spearman = 1 - 6*6/(5*24) = 0.7
    const r = spearmanCorrelation([1, 2, 3, 4, 5], [1, 4, 2, 3, 5]);
    expect(r).toBeCloseTo(0.7, 2);
  });
  it('konstante Werte -> 0 (Division durch 0 abgefangen)', () => {
    expect(spearmanCorrelation([1, 1, 1], [2, 3, 4])).toBe(0);
  });
});

describe('bewertungenToVirtuell', () => {
  it('mapt Bewertungen mit Confidence-Faktoren', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'KI', bewertung: 'kann_ich' },
      { aktenzeichen: 'A2', kategorie: 'KI', bewertung: 'teilweise' },
      { aktenzeichen: 'A3', kategorie: 'KI', bewertung: 'nicht_meins' },
    ];
    const v = bewertungenToVirtuell(b, 0.7, 0.3);
    expect(v.length).toBe(2);
    expect(v.find(x => x.antragId === 'A1')?.confidence).toBe(0.7);
    expect(v.find(x => x.antragId === 'A2')?.confidence).toBe(0.3);
    expect(v.find(x => x.antragId === 'A3')).toBeUndefined();
  });
  it('Confidence 0 -> nicht aufgenommen', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'KI', bewertung: 'kann_ich' },
    ];
    expect(bewertungenToVirtuell(b, 0, 0.3)).toEqual([]);
  });
});

describe('historicalAsVirtuell', () => {
  it('filtert nach Kuerzel + confidence=1.0', () => {
    const a = [
      makeAntrag('A1', { tib_kuerz: 'MUE' }),
      makeAntrag('A2', { tib_kuerz: 'SCH' }),
      makeAntrag('A3', { tib_kuerz: 'MUE' }),
    ];
    const v = historicalAsVirtuell(a, 'MUE');
    expect(v.length).toBe(2);
    expect(v.every(x => x.confidence === 1.0)).toBe(true);
    expect(v.map(x => x.antragId).sort()).toEqual(['A1', 'A3']);
  });
});

describe('calibrateSingle (Fallback-Mode ohne corpus)', () => {
  it('liefert Spearman + Top-3-Overlap', () => {
    const scope = [
      makeAntrag('A1', { techn_1: 'KI' }),
      makeAntrag('A2', { techn_1: 'Sensorik' }),
      makeAntrag('A3', { techn_1: 'KI' }),
    ];
    const hist = [{ antragId: 'A1', confidence: 1.0 }];
    const swipe = [{ antragId: 'A1', confidence: 0.7 }, { antragId: 'A3', confidence: 0.3 }];
    const r = calibrateSingle({ scope, histVirtuell: hist, swipeVirtuell: swipe });
    expect(r.spearman).toBeDefined();
    expect(r.top3Overlap).toBeGreaterThanOrEqual(0);
    expect(r.top3Overlap).toBeLessThanOrEqual(1);
  });
});

describe('gridSearchOptimalConfidence', () => {
  it('liefert ein bestes Paar mit nicht-leerer Grid', () => {
    const scope = [
      makeAntrag('A1', { techn_1: 'KI' }),
      makeAntrag('A2', { techn_1: 'KI' }),
    ];
    const hist = [{ antragId: 'A1', confidence: 1.0 }];
    const bw: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'KI', bewertung: 'kann_ich' },
    ];
    const r = gridSearchOptimalConfidence({ scope, histVirtuell: hist, bewertungen: bw });
    expect(r.grid.length).toBeGreaterThan(0);
    expect(r.best.kannIch).toBeGreaterThanOrEqual(0.1);
    expect(r.best.kannIch).toBeLessThanOrEqual(1.0);
    expect(r.best.teilweise).toBeLessThanOrEqual(r.best.kannIch);
  });
});

describe('klassifizierungsAccuracy', () => {
  const kats: UeberKategorie[] = [
    { id: 'IKT', name: 'IKT', farbe: 'blue', deskriptorenMapping: ['ki'] },
  ];
  it('alle hist. Antraege haben gemappte Deskriptoren -> 1.0', () => {
    const a = [makeAntrag('A1', { techn_1: 'KI' }), makeAntrag('A2', { techn_1: 'ki' })];
    expect(klassifizierungsAccuracy(a, kats)).toBe(1);
  });
  it('keine Deskriptoren -> 0', () => {
    const a = [makeAntrag('A1')];
    expect(klassifizierungsAccuracy(a, kats)).toBe(0);
  });
  it('leere Liste -> 1 (kein false-negative)', () => {
    expect(klassifizierungsAccuracy([], kats)).toBe(1);
  });
});

describe('aggregateGridResults', () => {
  it('gleichgewichtetes Mittel ueber MAs', () => {
    const g1 = [
      { kannIch: 0.5, teilweise: 0.2, spearman: 0.8, top3Overlap: 0.5 },
      { kannIch: 0.7, teilweise: 0.3, spearman: 0.6, top3Overlap: 0.5 },
    ];
    const g2 = [
      { kannIch: 0.5, teilweise: 0.2, spearman: 0.4, top3Overlap: 0.5 },
      { kannIch: 0.7, teilweise: 0.3, spearman: 0.8, top3Overlap: 0.5 },
    ];
    const r = aggregateGridResults([g1, g2]);
    // Mittel: 0.5/0.2 -> 0.6, 0.7/0.3 -> 0.7 -> best 0.7/0.3
    expect(r.best.kannIch).toBe(0.7);
    expect(r.best.spearman).toBeCloseTo(0.7, 5);
  });
});

describe('explainDeviation', () => {
  it('"Historisch aktiv, im Swipe abgelehnt"', () => {
    expect(explainDeviation(3, 18, 'nicht_meins', true)).toMatch(/Historisch aktiv/);
  });
  it('"Im Swipe bestätigt, historisch keine Projekte"', () => {
    expect(explainDeviation(22, 4, 'kann_ich', false)).toMatch(/Swipe|historisch keine/);
  });
});
