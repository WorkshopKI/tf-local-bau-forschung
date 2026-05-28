import { describe, it, expect } from 'vitest';
import {
  klassifiziereAntrag,
  matchDeskriptoren,
  matchEmbeddings,
  matchZukunftstechnologien,
  computeKategorieCentroids,
  splitInPrimaerUndAspekte,
} from '../services/klassifizierung-engine';
import type { Antrag } from '@/core/services/csv/types';
import { DEFAULT_UEBERKATEGORIEN, type UeberKategorie, type Klassifizierung } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeKategorie(id: string, mapping: string[], farbe: 'blue' = 'blue'): UeberKategorie {
  return { id, name: id, farbe, deskriptorenMapping: mapping };
}

describe('matchDeskriptoren', () => {
  it('matched eine Kategorie -> high (1.0)', () => {
    const kats = [makeKategorie('IKT', ['Künstliche Intelligenz', 'Big Data'])];
    const out = matchDeskriptoren(['künstliche intelligenz'], kats);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kategorieId: 'IKT', confidence: 1.0, methode: 'regel' });
  });

  it('matched zwei Kategorien -> medium (0.7) je', () => {
    const kats = [
      makeKategorie('IKT', ['ki']),
      makeKategorie('IND', ['sensorik']),
    ];
    const out = matchDeskriptoren(['ki', 'sensorik'], kats);
    expect(out).toHaveLength(2);
    expect(out.every(v => v.confidence === 0.7)).toBe(true);
  });

  it('keine Deskriptoren -> leer', () => {
    const kats = [makeKategorie('IKT', ['ki'])];
    expect(matchDeskriptoren([], kats)).toEqual([]);
  });

  it('keine Kategorien -> leer', () => {
    expect(matchDeskriptoren(['ki'], [])).toEqual([]);
  });

  it('Case-insensitive Match', () => {
    const kats = [makeKategorie('IKT', ['Künstliche Intelligenz'])];
    expect(matchDeskriptoren(['KÜNSTLICHE INTELLIGENZ'], kats)).toHaveLength(1);
  });

  it('keine ueberlappenden Werte -> leer', () => {
    const kats = [makeKategorie('IKT', ['ki'])];
    expect(matchDeskriptoren(['sensorik'], kats)).toEqual([]);
  });
});

describe('matchEmbeddings', () => {
  // Dummy 3-dim normalized vectors fuer die Tests
  const vIkt = [1, 0, 0];
  const vInd = [0, 1, 0];
  const vMed = [0, 0, 1];

  const kats: UeberKategorie[] = [
    { id: 'IKT', name: 'IKT', farbe: 'blue', deskriptorenMapping: [], referenzEmbedding: vIkt },
    { id: 'IND', name: 'IND', farbe: 'emerald', deskriptorenMapping: [], referenzEmbedding: vInd },
    { id: 'MED', name: 'MED', farbe: 'rose', deskriptorenMapping: [], referenzEmbedding: vMed },
  ];

  it('Query identisch zu IKT-Centroid -> Top-1 IKT mit hoher Confidence', () => {
    const out = matchEmbeddings(vIkt, kats, 0.15);
    expect(out[0]?.kategorieId).toBe('IKT');
    expect(out[0]?.confidence).toBeCloseTo(1.0, 5);
    expect(out[0]?.methode).toBe('embedding');
  });

  it('Query nahe IKT aber auch nahe IND -> Multi-Label wenn unter Schwellwert', () => {
    // Diagonal 0.7/0.7/0 -> normalisiert ergibt cosine 0.7 fuer beide
    const q = [0.7, 0.7, 0];
    const out = matchEmbeddings(q, kats, 0.15);
    // IKT und IND haben gleichen Score -> beide rein
    expect(out.length).toBe(2);
    expect(new Set(out.map(o => o.kategorieId))).toEqual(new Set(['IKT', 'IND']));
  });

  it('Multi-Label nur wenn Differenz < schwellwert', () => {
    // Query zeigt klar Richtung IKT
    const q = [0.99, 0.1, 0];
    const out = matchEmbeddings(q, kats, 0.15);
    expect(out.length).toBe(1);
    expect(out[0]?.kategorieId).toBe('IKT');
  });

  it('keine Centroids -> leer', () => {
    const out = matchEmbeddings(vIkt, [makeKategorie('IKT', [])], 0.15);
    expect(out).toEqual([]);
  });
});

describe('klassifiziereAntrag', () => {
  const kats = [
    makeKategorie('IKT', ['ki', 'machine learning']),
    makeKategorie('IND', ['sensorik', 'lasertechnik']),
  ];

  it('Stufe 1: Deskriptoren-Match -> Vorschlag mit methode=regel', () => {
    const a = makeAntrag('A1', { techn_1: 'KI' } as Partial<Antrag>);
    const k = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(k.status).toBe('vorgeschlagen');
    expect(k.vorgeschlagenePrimaer?.methode).toBe('regel');
    expect(k.vorgeschlagenePrimaer?.kategorieId).toBe('IKT');
    expect(k.freigegebenePrimaer).toBe('');
    expect(k.freigegebeneAspekte).toEqual([]);
  });

  it('Stufe 1 leer, Stage-2 aus -> leerer Vorschlag (manuelle Klass.)', () => {
    const a = makeAntrag('A2');
    const k = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(k.vorgeschlagenePrimaer).toBeNull();
    expect(k.vorgeschlageneAspekte).toEqual([]);
  });

  it('Stufe 1 leer + Stage-2 an mit Embedding -> embedding-Vorschlag', () => {
    const katsWithEmb: UeberKategorie[] = kats.map(k => ({
      ...k,
      referenzEmbedding: k.id === 'IKT' ? [1, 0, 0] : [0, 1, 0],
    }));
    const a = makeAntrag('A3');
    const k = klassifiziereAntrag({
      antrag: a,
      kategorien: katsWithEmb,
      stage2Aktiv: true,
      queryEmbedding: [1, 0, 0],
    });
    expect(k.vorgeschlagenePrimaer).not.toBeNull();
    expect(k.vorgeschlagenePrimaer?.methode).toBe('embedding');
    expect(k.vorgeschlagenePrimaer?.kategorieId).toBe('IKT');
  });

  it('Stufe 1 hit -> Stage 2 wird gar nicht aufgerufen (auch wenn aktiv)', () => {
    const katsWithEmb: UeberKategorie[] = kats.map(k => ({
      ...k,
      referenzEmbedding: k.id === 'IKT' ? [1, 0, 0] : [0, 1, 0],
    }));
    const a = makeAntrag('A4', { techn_1: 'KI' } as Partial<Antrag>);
    const k = klassifiziereAntrag({
      antrag: a,
      kategorien: katsWithEmb,
      stage2Aktiv: true,
      queryEmbedding: [0, 1, 0],   // wuerde IND vorschlagen — wird ignoriert
    });
    expect(k.vorgeschlagenePrimaer?.methode).toBe('regel');
    expect(k.vorgeschlagenePrimaer?.kategorieId).toBe('IKT');
  });

  it('Multi-Label: zwei matchende Kategorien in Stufe 1', () => {
    const a = makeAntrag('A5', {
      techn_1: 'KI',
      techn_2: 'Sensorik',
    } as Partial<Antrag>);
    const k = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(k.vorgeschlagenePrimaer).not.toBeNull();
    expect(k.vorgeschlageneAspekte.length).toBe(1);
    const allIds = [k.vorgeschlagenePrimaer?.kategorieId, ...k.vorgeschlageneAspekte.map(a => a.kategorieId)].filter(Boolean);
    expect(new Set(allIds)).toEqual(new Set(['IKT', 'IND']));
  });
});

describe('matchZukunftstechnologien (Stage 0)', () => {
  const kats = DEFAULT_UEBERKATEGORIEN;

  it('ZT-Spalte "Kuenstliche Intelligenz" -> DT (high)', () => {
    const a = makeAntrag('A1', { zt_kuenstliche_intelligenz_ki_tv: true } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out).toHaveLength(1);
    expect(out[0]?.kategorieId).toBe('DT');
    expect(out[0]?.confidence).toBe(1.0);
  });

  it('ZT-Spalte "Gesundes Leben" -> LG', () => {
    const a = makeAntrag('A2', { zt_gesundes_leben_tv: 'X' } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out[0]?.kategorieId).toBe('LG');
  });

  it('Multiple ZT-Spalten in unterschiedlichen Kategorien -> Multi-Label (0.8)', () => {
    const a = makeAntrag('A3', {
      zt_kuenstliche_intelligenz_ki_tv: 'X',
      zt_leichtbautechnologien_tv: '1',
    } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out.length).toBe(2);
    expect(new Set(out.map(x => x.kategorieId))).toEqual(new Set(['DT', 'IT']));
    expect(out.every(x => x.confidence === 0.8)).toBe(true);
  });

  it('Truthy-Werte: true, "X", "x", "1", "ja"', () => {
    for (const v of [true, 'X', 'x', '1', 'ja', 'Ja', 'JA', 'WAHR']) {
      const a = makeAntrag('A', { zt_cloud_computing_tv: v } as Partial<Antrag>);
      const out = matchZukunftstechnologien(a, kats);
      expect(out.length).toBe(1);
    }
  });

  it('Falsy-Werte: null, "", "0", "nein" -> kein Match', () => {
    for (const v of [null, undefined, '', '0', 'nein', 'false']) {
      const a = makeAntrag('A', { zt_cloud_computing_tv: v } as Partial<Antrag>);
      expect(matchZukunftstechnologien(a, kats)).toEqual([]);
    }
  });

  it('VB-Ebene-Spalten werden ebenfalls ausgewertet (Verbund-Inheritance)', () => {
    // Viele Deskriptoren sind nur auf Verbund-Ebene gesetzt — die TVs erben das.
    const a = makeAntrag('A', { zt_kuenstliche_intelligenz_ki_vb: 'X' } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out).toHaveLength(1);
    expect(out[0]?.kategorieId).toBe('DT');
  });

  it('TV + VB derselben Kategorie -> Single-Treffer (kein Doppel-Boost)', () => {
    const a = makeAntrag('A', {
      zt_kuenstliche_intelligenz_ki_tv: true,
      zt_kuenstliche_intelligenz_ki_vb: 'X',
    } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out.length).toBe(1);
    expect(out[0]?.kategorieId).toBe('DT');
    expect(out[0]?.confidence).toBe(1.0);
  });

  it('TV in Kategorie A + VB in Kategorie B -> Multi-Label', () => {
    const a = makeAntrag('A', {
      zt_kuenstliche_intelligenz_ki_tv: true,    // DT
      zt_leichtbautechnologien_vb: 'X',          // IT (nur Verbund)
    } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out.length).toBe(2);
    expect(new Set(out.map(x => x.kategorieId))).toEqual(new Set(['DT', 'IT']));
  });

  it('Filtert auf aktive Kategorien — wenn PL eine Kategorie geloescht hat', () => {
    const reduziert = kats.filter(k => k.id !== 'DT');
    const a = makeAntrag('A', { zt_kuenstliche_intelligenz_ki_tv: true } as Partial<Antrag>);
    expect(matchZukunftstechnologien(a, reduziert)).toEqual([]);
  });

  it('Wizard-NFD-Slug (kunstliche_intelligenz_ki) liefert DT genauso wie Fixture-Slug', () => {
    // Regression: vor dem Multi-Candidate-Patch wurden nur die hartcodierten
    // zt_<ue>_tv/_vb-Field-Namen erkannt. User-CSVs via Wizard mit Label-XLS
    // landen unter den NFD-Slugs (ue → u, kein Prefix, kein Suffix) und
    // wurden komplett verfehlt.
    const a = makeAntrag('A', { kunstliche_intelligenz_ki: 'X' } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out).toHaveLength(1);
    expect(out[0]?.kategorieId).toBe('DT');
    expect(out[0]?.confidence).toBe(1.0);
  });

  it('Wizard-ue-Slug ohne zt_-Prefix (kuenstliche_intelligenz_ki) wird erkannt', () => {
    const a = makeAntrag('A', { kuenstliche_intelligenz_ki: '1' } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out[0]?.kategorieId).toBe('DT');
  });

  it('Gemischte Konventionen: Fixture-KI + Wizard-Leichtbau → Multi-Label', () => {
    const a = makeAntrag('A', {
      zt_kuenstliche_intelligenz_ki_tv: 'X',  // Fixture-Style → DT
      leichtbautechnologien: 'ja',            // Wizard-Style ohne Prefix → IT
    } as Partial<Antrag>);
    const out = matchZukunftstechnologien(a, kats);
    expect(out.length).toBe(2);
    expect(new Set(out.map(x => x.kategorieId))).toEqual(new Set(['DT', 'IT']));
  });

  it('klassifiziereAntrag laeuft Stage 0 vor Stage 1 (ZT-Match dominiert)', () => {
    const a = makeAntrag('A', {
      zt_gesundes_leben_tv: true,
      techn_1: 'KI',   // wuerde sonst DT vorschlagen
    } as Partial<Antrag>);
    const k = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(k.vorgeschlagenePrimaer?.kategorieId).toBe('LG');
  });

  it('Kein ZT-Match -> Fallback auf Stage 1 Deskriptoren-Match', () => {
    const a = makeAntrag('A', { techn_1: 'KI' } as Partial<Antrag>);
    const k = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(k.vorgeschlagenePrimaer).not.toBeNull();
    expect(k.vorgeschlagenePrimaer?.kategorieId).toBe('DT');
  });
});

describe('DEFAULT_UEBERKATEGORIEN', () => {
  it('liefert genau 5 Kategorien mit IDs IT/DT/EU/LG/NM', () => {
    expect(DEFAULT_UEBERKATEGORIEN).toHaveLength(5);
    expect(DEFAULT_UEBERKATEGORIEN.map(k => k.id)).toEqual(['IT', 'DT', 'EU', 'LG', 'NM']);
  });

  it('jede Kategorie hat ein nicht-leeres Mapping', () => {
    for (const k of DEFAULT_UEBERKATEGORIEN) {
      expect(k.deskriptorenMapping.length).toBeGreaterThan(0);
    }
  });

  it('Klartext-Namen stimmen mit FZD-Vorgabe ueberein', () => {
    const byId = Object.fromEntries(DEFAULT_UEBERKATEGORIEN.map(k => [k.id, k.name]));
    expect(byId.IT).toBe('Industrielle Technologien');
    expect(byId.DT).toBe('Digitale Technologien');
    expect(byId.EU).toBe('Energie- und Umwelttechnologien');
    expect(byId.LG).toBe('Lebens- und Gesundheitswissenschaften');
    expect(byId.NM).toBe('Naturwissenschaftliche Methoden');
  });
});

describe('computeKategorieCentroids', () => {
  it('berechnet Mean-Centroid fuer jede Kategorie aus den Embeddings ihrer Antraege', () => {
    const kats = [
      makeKategorie('IKT', ['ki']),
      makeKategorie('IND', ['sensorik']),
    ];
    const klass: Klassifizierung[] = [
      {
        antragId: 'A1',
        vorgeschlagenePrimaer: { kategorieId: 'IKT', confidence: 1, methode: 'regel' },
        vorgeschlageneAspekte: [],
        freigegebenePrimaer: 'IKT',
        freigegebeneAspekte: [],
        status: 'freigegeben',
      },
      {
        antragId: 'A2',
        vorgeschlagenePrimaer: { kategorieId: 'IKT', confidence: 1, methode: 'regel' },
        vorgeschlageneAspekte: [],
        freigegebenePrimaer: 'IKT',
        freigegebeneAspekte: [],
        status: 'freigegeben',
      },
      {
        antragId: 'A3',
        vorgeschlagenePrimaer: { kategorieId: 'IND', confidence: 1, methode: 'regel' },
        vorgeschlageneAspekte: [],
        freigegebenePrimaer: 'IND',
        freigegebeneAspekte: [],
        status: 'freigegeben',
      },
    ];
    const embeddings = new Map<string, number[]>([
      ['A1', [1, 0, 0]],
      ['A2', [0.6, 0.8, 0]],
      ['A3', [0, 1, 0]],
    ]);
    const centroids = computeKategorieCentroids(klass, embeddings, kats);
    const cIkt = centroids.get('IKT')!;
    const cInd = centroids.get('IND')!;
    expect(cIkt).toBeDefined();
    expect(cInd).toBeDefined();
    // IKT-Centroid soll zwischen [1,0,0] und [0.6,0.8,0] liegen und normalisiert sein
    const normIkt = Math.sqrt(cIkt.reduce((s, v) => s + v * v, 0));
    expect(normIkt).toBeCloseTo(1.0, 5);
    // IND-Centroid nur ein Antrag -> identisch normalisiert zu [0,1,0]
    expect(cInd[0]).toBeCloseTo(0, 5);
    expect(cInd[1]).toBeCloseTo(1, 5);
  });

  it('Kategorie ohne Antraege -> kein Centroid', () => {
    const kats = [makeKategorie('IKT', ['ki'])];
    const klass: Klassifizierung[] = [];
    const embeddings = new Map<string, number[]>();
    expect(computeKategorieCentroids(klass, embeddings, kats).size).toBe(0);
  });

  it('1.17: Aspekte zaehlen NICHT — nur Primaer fliesst in Centroid', () => {
    const kats = [makeKategorie('IKT', ['ki']), makeKategorie('IND', ['sensorik'])];
    const klass: Klassifizierung[] = [{
      antragId: 'A1',
      vorgeschlagenePrimaer: { kategorieId: 'IKT', confidence: 0.9, methode: 'embedding' },
      vorgeschlageneAspekte: [{ kategorieId: 'IND', confidence: 0.4 }],
      freigegebenePrimaer: 'IKT',
      freigegebeneAspekte: ['IND'],
      status: 'freigegeben',
    }];
    const embeddings = new Map<string, number[]>([['A1', [1, 0, 0]]]);
    const centroids = computeKategorieCentroids(klass, embeddings, kats);
    // IKT bekommt den Vector, IND nicht (war nur Aspekt).
    expect(centroids.has('IKT')).toBe(true);
    expect(centroids.has('IND')).toBe(false);
  });
});

describe('splitInPrimaerUndAspekte (1.17)', () => {
  it('leere Liste → primaer=null, aspekte=[]', () => {
    expect(splitInPrimaerUndAspekte([])).toEqual({ primaer: null, aspekte: [] });
  });

  it('ein Vorschlag → primaer ohne Aspekte', () => {
    const result = splitInPrimaerUndAspekte([
      { kategorieId: 'IT', confidence: 0.9, methode: 'embedding' },
    ]);
    expect(result.primaer).toEqual({ kategorieId: 'IT', confidence: 0.9, methode: 'embedding' });
    expect(result.aspekte).toEqual([]);
  });

  it('mehrere Vorschlaege → erster primaer, Rest aspekte', () => {
    const result = splitInPrimaerUndAspekte([
      { kategorieId: 'IT', confidence: 0.9, methode: 'embedding' },
      { kategorieId: 'DT', confidence: 0.4, methode: 'embedding' },
      { kategorieId: 'EU', confidence: 0.3, methode: 'embedding' },
    ]);
    expect(result.primaer!.kategorieId).toBe('IT');
    expect(result.aspekte).toEqual([
      { kategorieId: 'DT', confidence: 0.4 },
      { kategorieId: 'EU', confidence: 0.3 },
    ]);
  });
});

describe('klassifiziereAntrag — neue Primaer+Aspekte-Rueckgabe (1.17)', () => {
  it('Stage-0-Treffer wird in primaer + aspekte gesplittet', () => {
    const kats = DEFAULT_UEBERKATEGORIEN;
    const a = makeAntrag('A1', {
      // Multi-ZT: Kuenstliche Intelligenz (DT) + Sensorik (IT)
      // (Achtung: ZT-Felder kommen aus default-labels; hier ein bekanntes Paar)
    } as Partial<Antrag>);
    // Setze ZT-Felder direkt:
    const rec = a as Record<string, unknown>;
    rec.zt_kuenstliche_intelligenz_ki_tv = 'X';
    rec.zt_kuenstliche_intelligenz_ki_vb = 'X';
    const result = klassifiziereAntrag({ antrag: a, kategorien: kats });
    // Mindestens primaer gesetzt
    expect(result.vorgeschlagenePrimaer).not.toBeNull();
    expect(result.vorgeschlagenePrimaer!.kategorieId).toBe('DT');
    expect(result.freigegebenePrimaer).toBe('');
    expect(result.freigegebeneAspekte).toEqual([]);
  });

  it('kein Match → primaer null + leere aspekte', () => {
    const kats = [makeKategorie('IKT', ['ki'])];
    const a = makeAntrag('A1');
    const result = klassifiziereAntrag({ antrag: a, kategorien: kats });
    expect(result.vorgeschlagenePrimaer).toBeNull();
    expect(result.vorgeschlageneAspekte).toEqual([]);
    expect(result.status).toBe('vorgeschlagen');
  });
});
