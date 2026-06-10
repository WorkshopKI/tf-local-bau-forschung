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
  collectVerbundTHints,
  groupFreigegebeneByVerbund,
  hatDXtecDatum,
  hatDAdvDatum,
  invalidateVerbundClassificationCache,
  istUnvollstaendig,
  istVollstaendigFuerTyp,
  istZuVerteilen,
  type VollstaendigkeitsGate,
  type VollstaendigkeitsGateAz,
} from '../services/verbund-aggregation';
import type { Klassifizierung } from '../types';
import type { KlassifizierungsView } from '../hooks/useKlassifizierungen';

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

describe('buildVerbundClassificationViews — manuell-Flag (v2.34)', () => {
  function klMethode(antragId: string, methode: 'regel' | 'manuell' | 'llm'): Klassifizierung {
    return {
      antragId,
      vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 1.0, methode },
      vorgeschlageneAspekte: [],
      freigegebenePrimaer: '',
      freigegebeneAspekte: [],
      status: 'vorgeschlagen',
    };
  }

  it('persistierte methode "manuell" → manuell=true (grüner Von-Hand-Punkt)', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1' })];
    const views = buildVerbundClassificationViews(antraege, null, [], [klMethode('A1', 'manuell')], undefined, false, []);
    expect(views[0]?.manuell).toBe(true);
  });

  it('methode "regel"/"llm" → manuell=false', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1' }), makeAntrag({ aktenzeichen: 'A2' })];
    const views = buildVerbundClassificationViews(
      antraege, null, [],
      [klMethode('A1', 'regel'), klMethode('A2', 'llm')],
      undefined, false, [],
    );
    expect(views.find(v => v.verbundId === 'A1')?.manuell).toBe(false);
    expect(views.find(v => v.verbundId === 'A2')?.manuell).toBe(false);
  });

  it('keine Primär (vorgeschlagenePrimaer null) → manuell=false', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1' })];
    const noPrimaer: Klassifizierung = {
      antragId: 'A1', vorgeschlagenePrimaer: null, vorgeschlageneAspekte: [],
      freigegebenePrimaer: '', freigegebeneAspekte: [], status: 'vorgeschlagen',
    };
    const views = buildVerbundClassificationViews(antraege, null, [], [noPrimaer], undefined, false, []);
    expect(views[0]?.manuell).toBe(false);
  });
});

describe('buildVerbundClassificationViews — antragsdatum (zuletzt eingegangenes TV)', () => {
  it('Verbund-Header-Datum = spätestes TV-Antragsdatum, nicht das des Lead-TV', () => {
    // TORAERO-Fall aus dem Screenshot: Lead (FKZ-first) hat das früheste Datum.
    const antraege = [
      makeAntrag({ aktenzeichen: '16KN092877', verbund_id: 'V1', antragsdatum: '2026-03-13' }),
      makeAntrag({ aktenzeichen: '16KN092878', verbund_id: 'V1', antragsdatum: '2026-03-30' }),
      makeAntrag({ aktenzeichen: '16KN092879', verbund_id: 'V1', antragsdatum: '2026-04-02' }),
    ];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views).toHaveLength(1);
    expect(views[0]?.antragsdatum).toBe('2026-04-02');
  });

  it('Solo-Antrag: antragsdatum = eigenes Datum', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-01-15' })];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views[0]?.antragsdatum).toBe('2026-01-15');
  });
});

describe('groupFreigegebeneByVerbund', () => {
  function makeView(
    antrag: Antrag,
    primaer: string,
    confidence: KlassifizierungsView['confidence'] = 'high',
  ): KlassifizierungsView {
    const klassifizierung: Klassifizierung = {
      antragId: antrag.aktenzeichen,
      vorgeschlagenePrimaer: null,
      vorgeschlageneAspekte: [],
      freigegebenePrimaer: primaer,
      freigegebeneAspekte: [],
      status: 'freigegeben',
    };
    return { antrag, klassifizierung, confidence };
  }

  it('bündelt TVs desselben Verbundes zu EINER Zeile (Lead = erster FKZ)', () => {
    const views = [
      makeView(makeAntrag({ aktenzeichen: '16KN127431', verbund_id: 'V1' }), 'IT'),
      makeView(makeAntrag({ aktenzeichen: '16KN127430', verbund_id: 'V1' }), 'IT'),
    ];
    const verbuendeById = new Map<string, Verbund>([
      ['V1', makeVerbund({ verbund_id: 'V1', titel: 'Verbund-Titel', akronym: 'AKR' })],
    ]);
    const rows = groupFreigegebeneByVerbund(views, verbuendeById);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.leadAktenzeichen).toBe('16KN127430'); // FKZ-sortiert
    expect(rows[0]?.verbundTitel).toBe('Verbund-Titel');
    expect(rows[0]?.akronym).toBe('AKR');
    expect(rows[0]?.tvCount).toBe(2);
    expect(rows[0]?.tvAktenzeichen.sort()).toEqual(['16KN127430', '16KN127431']);
    expect(rows[0]?.klassifizierung.freigegebenePrimaer).toBe('IT');
  });

  it('übernimmt das SPÄTESTE antragsdatum (zuletzt eingegangenes TV), nicht das des Lead-TV', () => {
    const views = [
      // Lead (FKZ-sortiert) ist '16KN127430' mit dem FRÜHEREN Datum — das spätere
      // Datum des anderen TV ist maßgeblich für den Gesamtverbund.
      makeView(makeAntrag({ aktenzeichen: '16KN127430', verbund_id: 'V1', antragsdatum: '2026-02-01' }), 'IT'),
      makeView(makeAntrag({ aktenzeichen: '16KN127431', verbund_id: 'V1', antragsdatum: '2026-05-09' }), 'IT'),
    ];
    const rows = groupFreigegebeneByVerbund(views, new Map());
    // Lead-Auswahl (Selektion/Zuweisung) bleibt FKZ-sortiert; nur das Antragsdatum
    // kommt vom zuletzt eingegangenen TV.
    expect(rows[0]?.leadAktenzeichen).toBe('16KN127430');
    expect(rows[0]?.antragsdatum).toBe('2026-05-09');
  });

  it('antragsdatum leer wenn nicht gesetzt', () => {
    const views = [makeView(makeAntrag({ aktenzeichen: 'A1' }), 'DT')];
    const rows = groupFreigegebeneByVerbund(views, new Map());
    expect(rows[0]?.antragsdatum).toBe('');
  });

  it('Solo-Antrag ohne verbund_id → eigene 1er-Zeile, Titel-Fallback auf Antrag', () => {
    const views = [makeView(makeAntrag({ aktenzeichen: 'A1', akronym: 'SOLO', titel: 'Solo-Titel' }), 'DT')];
    const rows = groupFreigegebeneByVerbund(views, new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.verbundId).toBe('A1');
    expect(rows[0]?.leadAktenzeichen).toBe('A1');
    expect(rows[0]?.tvCount).toBe(1);
    expect(rows[0]?.verbundTitel).toBe('Solo-Titel');
    expect(rows[0]?.akronym).toBe('SOLO');
  });

  it('Mix: 1 Verbund (2 TVs) + 1 Solo → 2 Zeilen', () => {
    const views = [
      makeView(makeAntrag({ aktenzeichen: 'B1', verbund_id: 'M' }), 'IT'),
      makeView(makeAntrag({ aktenzeichen: 'B2', verbund_id: 'M' }), 'IT'),
      makeView(makeAntrag({ aktenzeichen: 'C1' }), 'EU'),
    ];
    const rows = groupFreigegebeneByVerbund(views, new Map());
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.tvCount).sort()).toEqual([1, 2]);
  });

  it('manuell-Flag aus der Lead-Klassifizierung (v2.34)', () => {
    const antrag = makeAntrag({ aktenzeichen: 'A1', verbund_id: 'V1' });
    const view: KlassifizierungsView = {
      antrag,
      klassifizierung: {
        antragId: 'A1',
        vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 1.0, methode: 'manuell' },
        vorgeschlageneAspekte: [],
        freigegebenePrimaer: 'IT',
        freigegebeneAspekte: [],
        status: 'freigegeben',
      },
      confidence: 'high',
    };
    expect(groupFreigegebeneByVerbund([view], new Map())[0]?.manuell).toBe(true);
  });
});

describe('Vollständigkeit pro Antragstyp (D_XTEC / D_ADV)', () => {
  // vb_phase-Mapping: FuE=3, DS=5, DL=4, NW=1|2 (getKategorieLabel).
  const GATE_BEIDE: VollstaendigkeitsGate = { dxtec: true, dadv: true, xtecFeld: 'd_xtec', advFeld: 'd_adv' };
  const GATE_NUR_XTEC: VollstaendigkeitsGate = { dxtec: true, dadv: false, xtecFeld: 'd_xtec', advFeld: 'd_adv' };

  it('hatDXtecDatum: nur ein GÜLTIGES Datum zählt (ISO + dt.); Platzhalter/unsichtbar/leer = false', () => {
    // Gültige Datumswerte → true (ISO wie vom Merger normalisiert, plus dt. Format).
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '2026-05-01' }))).toBe(true);
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '25.05.2026' }))).toBe(true);
    // Leer / Whitespace / fehlend → false.
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '   ' }))).toBe(false);
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '' }))).toBe(false);
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A' }))).toBe(false);
    // Regression: „leer aussehende" Nicht-Datums-Werte → false (sonst fälschlich vollständig).
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '​' }))).toBe(false); // zero-width space
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '00.00.0000' }))).toBe(false);
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '0' }))).toBe(false);
    expect(hatDXtecDatum(makeAntrag({ aktenzeichen: 'A', d_xtec: '.' }))).toBe(false);
  });

  it('hatDAdvDatum: nur ein GÜLTIGES Datum zählt; Platzhalter/unsichtbar/leer = false', () => {
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A', d_adv: '2026-05-01' }))).toBe(true);
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A', d_adv: '25.05.2026' }))).toBe(true);
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A', d_adv: '   ' }))).toBe(false);
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A' }))).toBe(false);
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A', d_adv: '​' }))).toBe(false);
    expect(hatDAdvDatum(makeAntrag({ aktenzeichen: 'A', d_adv: '00.00.0000' }))).toBe(false);
  });

  it('Regression: FuE mit „leer aussehendem" D_XTEC-Platzhalter gilt als UNVOLLSTÄNDIG', () => {
    // Genau der gemeldete Bug: D_XTEC-Zelle sieht leer aus, traegt aber einen
    // unsichtbaren/Platzhalter-Wert → darf NICHT als vollstaendig zaehlen.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_xtec: '​' }), GATE_BEIDE)).toBe(false);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_xtec: '00.00.0000' }), GATE_BEIDE)).toBe(false);
    // D_ADV gefuellt ist fuer FuE irrelevant → bleibt unvollstaendig.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_xtec: '​', d_adv: '2026-05-01' }), GATE_BEIDE)).toBe(false);
  });

  it('istVollstaendigFuerTyp liest das schema-aufgelöste Feld (D_XTEC als Eigenes Feld)', () => {
    // Gemeldeter Real-Fall: D_XTEC ist als Eigenes Feld gemappt → Wert liegt unter
    // `alle_antrage_in_c16_eingegeben`, nicht unter `d_xtec`. Das Gate traegt das
    // aufgeloeste Feld; die Pruefung muss DORT lesen.
    const gate: VollstaendigkeitsGate = {
      dxtec: true, dadv: true,
      xtecFeld: 'alle_antrage_in_c16_eingegeben', advFeld: 'antrag_in_c16_eingestellt',
    };
    // FuE: gueltiges Datum im Custom-Feld → vollstaendig.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, alle_antrage_in_c16_eingegeben: '2026-05-01' }), gate)).toBe(true);
    // FuE: Custom-Feld leer, aber kanonisches d_xtec gesetzt → trotzdem UNVOLLSTAENDIG
    //      (das aufgeloeste Feld ist maßgeblich, nicht d_xtec).
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_xtec: '2026-05-01' }), gate)).toBe(false);
    // DL: gueltiges Datum im D_ADV-Custom-Feld → vollstaendig.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'D', vb_phase: 4, antrag_in_c16_eingestellt: '2026-05-01' }), gate)).toBe(true);
  });

  it('FuE/DS brauchen D_XTEC, DL/NW brauchen D_ADV (Gate beide aktiv)', () => {
    // FuE (vb_phase 3) + DS (vb_phase 5) → D_XTEC maßgeblich.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3 }), GATE_BEIDE)).toBe(false);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_xtec: '2026-05-01' }), GATE_BEIDE)).toBe(true);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'S', vb_phase: 5 }), GATE_BEIDE)).toBe(false);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'S', vb_phase: 5, d_xtec: '2026-05-01' }), GATE_BEIDE)).toBe(true);
    // FuE mit D_ADV (falscher Spalte) bleibt unvollständig.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3, d_adv: '2026-05-01' }), GATE_BEIDE)).toBe(false);

    // DL (vb_phase 4) + NW (vb_phase 1|2) → D_ADV maßgeblich.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'D', vb_phase: 4 }), GATE_BEIDE)).toBe(false);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'D', vb_phase: 4, d_adv: '2026-05-01' }), GATE_BEIDE)).toBe(true);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'N', vb_phase: 1, d_adv: '2026-05-01' }), GATE_BEIDE)).toBe(true);
    // DL mit D_XTEC (falscher Spalte) bleibt unvollständig.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'D', vb_phase: 4, d_xtec: '2026-05-01' }), GATE_BEIDE)).toBe(false);
  });

  it('Transitions-Schutz: Gate inaktiv (Spalte nicht befüllt) → immer vollständig', () => {
    // D_ADV nirgends befüllt (gate.dadv=false) → DL/NW ungated trotz fehlendem Datum.
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'D', vb_phase: 4 }), GATE_NUR_XTEC)).toBe(true);
    // FuE bleibt gegen D_XTEC geprüft (gate.dxtec=true).
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'F', vb_phase: 3 }), GATE_NUR_XTEC)).toBe(false);
  });

  it('Unbekannter Antragstyp (vb_phase nicht 1–5 / fehlt) → immer vollständig', () => {
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'X', vb_phase: 7 }), GATE_BEIDE)).toBe(true);
    expect(istVollstaendigFuerTyp(makeAntrag({ aktenzeichen: 'X' }), GATE_BEIDE)).toBe(true);
  });

  it('istUnvollstaendig: unvollständig nur, wenn Vollständigkeits-Datum fehlt UND kein TIB', () => {
    const gate = GATE_BEIDE;
    expect(istUnvollstaendig(makeAntrag({ aktenzeichen: 'A', vb_phase: 3 }), gate)).toBe(true);
    expect(istUnvollstaendig(makeAntrag({ aktenzeichen: 'A', vb_phase: 3, d_xtec: '2026-05-01' }), gate)).toBe(false);
    // bereits vergeben (TIB) → nicht markiert, egal ob vollständig.
    expect(istUnvollstaendig(makeAntrag({ aktenzeichen: 'A', vb_phase: 3, tib_kuerz: 'ABC' }), gate)).toBe(false);
    // DL ohne D_ADV → unvollständig (nicht fälschlich gegen D_XTEC).
    expect(istUnvollstaendig(makeAntrag({ aktenzeichen: 'A', vb_phase: 4 }), gate)).toBe(true);
    expect(istUnvollstaendig(makeAntrag({ aktenzeichen: 'A', vb_phase: 4, d_adv: '2026-05-01' }), gate)).toBe(false);
  });

  it('istZuVerteilen bleibt unverändert: D_XTEC/D_ADV ändern die Pool-Membership NICHT', () => {
    const cutoff = '2026-01-01';
    const ohne = makeAntrag({ aktenzeichen: 'A', vb_phase: 3, antragsdatum: '2026-04-01' });
    const mit = makeAntrag({ aktenzeichen: 'B', vb_phase: 3, antragsdatum: '2026-04-01', d_xtec: '2026-05-01' });
    // Beide ohne TIB, Datum im Fenster → beide im Pool (Sichtbarkeit unverändert).
    expect(istZuVerteilen(ohne, cutoff)).toBe(true);
    expect(istZuVerteilen(mit, cutoff)).toBe(true);
  });

  it('VerbundView.vollstaendig: nur true, wenn ALLE TVs vollständig (every)', () => {
    // v2.63: View-Builder nutzt das Az-Set-Gate (Sets wie der Stream-Pass sie baut).
    const gate: VollstaendigkeitsGateAz = { dxtec: true, dadv: false, xtecAzSet: new Set(['A1']), advAzSet: new Set() };
    // Verbund mit 2 FuE-TVs, nur einer hat D_XTEC → unvollständig.
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', vb_phase: 3, verbund_id: 'V1', d_xtec: '2026-05-01' }),
      makeAntrag({ aktenzeichen: 'A2', vb_phase: 3, verbund_id: 'V1' }),
    ];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, [], gate);
    expect(views).toHaveLength(1);
    expect(views[0]?.vollstaendig).toBe(false);

    // Beide TVs mit D_XTEC → vollständig.
    invalidateVerbundClassificationCache();
    const antraege2 = [
      makeAntrag({ aktenzeichen: 'B1', vb_phase: 3, verbund_id: 'V2', d_xtec: '2026-05-01' }),
      makeAntrag({ aktenzeichen: 'B2', vb_phase: 3, verbund_id: 'V2', d_xtec: '2026-05-02' }),
    ];
    const gate2: VollstaendigkeitsGateAz = { dxtec: true, dadv: false, xtecAzSet: new Set(['B1', 'B2']), advAzSet: new Set() };
    const views2 = buildVerbundClassificationViews(antraege2, null, [], [], undefined, false, [], gate2);
    expect(views2[0]?.vollstaendig).toBe(true);
  });
});

describe('collectVerbundTHints — T_HINT verbund-weit', () => {
  it('distinkte, nicht-leere Werte über alle TVs (reihenfolgestabil)', () => {
    const tvs = [
      makeAntrag({ aktenzeichen: 'A1', t_hint: 'Bemerkung A' }),
      makeAntrag({ aktenzeichen: 'A2', t_hint: '   ' }),         // whitespace → raus
      makeAntrag({ aktenzeichen: 'A3', t_hint: 'Bemerkung B' }),
      makeAntrag({ aktenzeichen: 'A4', t_hint: 'Bemerkung A' }), // Dublette → raus
      makeAntrag({ aktenzeichen: 'A5' }),                        // kein t_hint
    ];
    expect(collectVerbundTHints(tvs)).toEqual(['Bemerkung A', 'Bemerkung B']);
  });

  it('trimmt + leere Liste → []', () => {
    expect(collectVerbundTHints([])).toEqual([]);
    expect(collectVerbundTHints([makeAntrag({ aktenzeichen: 'A', t_hint: '  x  ' })])).toEqual(['x']);
  });

  it('Bemerkung auf Nicht-Lead-TV wird erfasst', () => {
    const tvs = [
      makeAntrag({ aktenzeichen: 'L1' }),                        // Lead, ohne Bemerkung
      makeAntrag({ aktenzeichen: 'L2', t_hint: 'nur auf TV2' }),
    ];
    expect(collectVerbundTHints(tvs)).toEqual(['nur auf TV2']);
  });
});
