/**
 * Tests fuer verbund-aggregation.ts.
 *
 * Fokus: `isSolo`-Flag entscheidet, ob in der Klassifizierungs-Tabelle
 * zusaetzlich zur Header-Row noch TV-Sub-Rows gerendert werden. Bei Einzel-TV-
 * Verbuenden waeren die Sub-Rows redundant (identische Daten wie der Header).
 * Vor dem Fix wurde `isSolo` falsch auf "verbund_id leer?" geprueft — Einzel-
 * Antraege mit gesetzter verbund_id bekamen so eine doppelte Zeile.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  buildVerbundClassificationViews,
  invalidateVerbundClassificationCache,
} from '../services/verbund-aggregation';

beforeEach(() => {
  // Modul-globaler Closure-Cache (Hebel A) wuerde sonst Test-Isolation brechen,
  // wenn zwei Tests zufaellig die gleichen Array-Refs uebergeben.
  invalidateVerbundClassificationCache();
});

function makeAntrag(overrides: Partial<Antrag> & Pick<Antrag, 'aktenzeichen'>): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

function makeVerbund(overrides: Partial<Verbund> & Pick<Verbund, 'verbund_id'>): Verbund {
  return {
    programm_id: 'p1',
    teilantrags_ids: [],
    ...overrides,
  } as Verbund;
}

describe('buildVerbundClassificationViews — isSolo', () => {
  it('Einzel-Antrag OHNE verbund_id → isSolo=true (1 Zeile in UI)', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1', akronym: 'SOLO' })];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
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
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views).toHaveLength(1);
    expect(views[0]?.isSolo).toBe(true);
    expect(views[0]?.tvs).toHaveLength(1);
  });

  it('Echter Verbund mit 2 TVs → isSolo=false (UI rendert 2 TV-Sub-Rows)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: '16KN127430', akronym: 'AggloDiEx', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: '16KN127431', akronym: 'AggloDiEx', verbund_id: 'V1' }),
    ];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
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
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
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
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views).toHaveLength(4);
    const soloFlags = views.map(v => v.isSolo).sort();
    expect(soloFlags).toEqual([false, true, true, true]);
  });
});

describe('buildVerbundClassificationViews — verbuendeById (Verbund-Store-Lookup)', () => {
  it('Verbund-Objekt vorhanden → titel + akronym aus dem Verbund-Store', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: '16KN127430', verbund_id: 'V1', titel: 'H2Select - EcoPlay / Entwicklung der Extrusionsparameter' }),
      makeAntrag({ aktenzeichen: '16KN127431', verbund_id: 'V1', titel: 'H2Select - EcoPlay / Entwicklung Inline-Messeinrichtungen' }),
    ];
    const verbuendeById = new Map<string, Verbund>([
      ['V1', makeVerbund({ verbund_id: 'V1', titel: 'EcoPlay-Verbund', akronym: 'ECOPLAY' })],
    ]);
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, [...verbuendeById.values()]);
    expect(views[0]?.verbundTitel).toBe('EcoPlay-Verbund');
    expect(views[0]?.akronym).toBe('ECOPLAY');
  });

  it('Verbund-Objekt fehlt → Fallback auf Antrag-Felder (Solo-Antrag)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', akronym: 'SOLO-AK', titel: 'Solo-Titel' }),
    ];
    const verbuendeById = new Map<string, Verbund>();
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, [...verbuendeById.values()]);
    expect(views[0]?.akronym).toBe('SOLO-AK');
    expect(views[0]?.verbundTitel).toBe('Solo-Titel');
  });

  it('Verbund-Objekt mit leerem titel → Fallback auf TV1.verbund_titel/titel', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'B1', verbund_id: 'V2', titel: 'TV1-Titel-Fallback' }),
    ];
    const verbuendeById = new Map<string, Verbund>([
      ['V2', makeVerbund({ verbund_id: 'V2', titel: '', akronym: '' })],
    ]);
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, [...verbuendeById.values()]);
    expect(views[0]?.verbundTitel).toBe('TV1-Titel-Fallback');
  });

  it('Backward-Kompat: verbuendeById === undefined → Verhalten wie zuvor', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'C1', titel: 'Default-Titel' }),
    ];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views[0]?.verbundTitel).toBe('Default-Titel');
  });

  it('Multi-TV-Verbund mit Verbund-Objekt → ein View mit Verbund-Titel + 2 TVs', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'X1', verbund_id: 'VX', titel: 'XTV1' }),
      makeAntrag({ aktenzeichen: 'X2', verbund_id: 'VX', titel: 'XTV2' }),
    ];
    const verbuendeById = new Map<string, Verbund>([
      ['VX', makeVerbund({ verbund_id: 'VX', titel: 'Gemeinsamer Verbund-Titel', akronym: 'GVT' })],
    ]);
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, [...verbuendeById.values()]);
    expect(views).toHaveLength(1);
    expect(views[0]?.verbundTitel).toBe('Gemeinsamer Verbund-Titel');
    expect(views[0]?.tvs).toHaveLength(2);
    expect(views[0]?.isSolo).toBe(false);
  });
});
