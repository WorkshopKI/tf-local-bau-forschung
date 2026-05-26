/**
 * Tests fuer verbund-aggregation.ts.
 *
 * Fokus: `isSolo`-Flag entscheidet, ob in der Klassifizierungs-Tabelle
 * zusaetzlich zur Header-Row noch TV-Sub-Rows gerendert werden. Bei Einzel-TV-
 * Verbuenden waeren die Sub-Rows redundant (identische Daten wie der Header).
 * Vor dem Fix wurde `isSolo` falsch auf "verbund_id leer?" geprueft — Einzel-
 * Antraege mit gesetzter verbund_id bekamen so eine doppelte Zeile.
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { buildVerbundClassificationViews } from '../services/verbund-aggregation';

function makeAntrag(overrides: Partial<Antrag> & Pick<Antrag, 'aktenzeichen'>): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

describe('buildVerbundClassificationViews — isSolo', () => {
  it('Einzel-Antrag OHNE verbund_id → isSolo=true (1 Zeile in UI)', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1', akronym: 'SOLO' })];
    const views = buildVerbundClassificationViews(antraege, [], []);
    expect(views).toHaveLength(1);
    expect(views[0]?.isSolo).toBe(true);
    expect(views[0]?.tvs).toHaveLength(1);
  });

  it('Einzel-Antrag MIT verbund_id → trotzdem isSolo=true (Regression-Test)', () => {
    // Vor dem Fix wurde isSolo = verbund_id.length === 0 berechnet, was bei
    // Einzelantraegen mit verbund_id eine redundante TV-Sub-Row erzeugte.
    const antraege = [
      makeAntrag({ aktenzeichen: '16DS261161', akronym: '2-Takt-Hybridantrieb', verbund_id: 'VERBUND-12345' }),
    ];
    const views = buildVerbundClassificationViews(antraege, [], []);
    expect(views).toHaveLength(1);
    expect(views[0]?.isSolo).toBe(true);
    expect(views[0]?.tvs).toHaveLength(1);
  });

  it('Echter Verbund mit 2 TVs → isSolo=false (UI rendert 2 TV-Sub-Rows)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: '16KN127430', akronym: 'AggloDiEx', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: '16KN127431', akronym: 'AggloDiEx', verbund_id: 'V1' }),
    ];
    const views = buildVerbundClassificationViews(antraege, [], []);
    expect(views).toHaveLength(1);
    expect(views[0]?.isSolo).toBe(false);
    expect(views[0]?.tvs).toHaveLength(2);
  });

  it('Echter Verbund mit 4 TVs → isSolo=false', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV3', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV4', verbund_id: 'V1' }),
    ];
    const views = buildVerbundClassificationViews(antraege, [], []);
    expect(views[0]?.isSolo).toBe(false);
    expect(views[0]?.tvs).toHaveLength(4);
  });

  it('Mix: 3 Einzel + 1 Echter-Verbund → 4 Views, nur der Verbund mit isSolo=false', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', verbund_id: 'SOLO-1' }),
      makeAntrag({ aktenzeichen: 'A2', verbund_id: 'SOLO-2' }),
      makeAntrag({ aktenzeichen: 'B1', verbund_id: 'MULTI' }),
      makeAntrag({ aktenzeichen: 'B2', verbund_id: 'MULTI' }),
      makeAntrag({ aktenzeichen: 'C1' }),  // kein verbund_id
    ];
    const views = buildVerbundClassificationViews(antraege, [], []);
    expect(views).toHaveLength(4);
    const soloFlags = views.map(v => v.isSolo).sort();
    expect(soloFlags).toEqual([false, true, true, true]);
  });
});
