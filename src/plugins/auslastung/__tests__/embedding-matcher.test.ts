import { describe, it, expect } from 'vitest';
import { runEmbeddingMatching } from '../services/embedding-matcher';
import { buildAnonymMapForTests } from './test-helpers';
import { cosineSimilarity } from '@/core/services/embedding-corpus';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeMa(anonId: string, aktiv = true): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: 1600,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IKT',
    nebenKategorien: [],
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv,
  };
}

describe('cosineSimilarity', () => {
  it('identische Vektoren -> 1.0', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
  });
  it('orthogonale -> 0', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });
  it('verschiedene Dimensionen -> 0', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe('runEmbeddingMatching', () => {
  it('MA dessen TIB an aehnlichstem Antrag arbeitete bekommt hoechsten Score', () => {
    // Setup: 3 historische Antraege, 2 MAs
    const antraege = [
      makeAntrag('A1', { tib_kuerz: 'MUE', titel: 'KI-Projekt' } as Partial<Antrag>),
      makeAntrag('A2', { tib_kuerz: 'SCH', titel: 'Laser-Projekt' } as Partial<Antrag>),
      makeAntrag('A3', { tib_kuerz: 'MUE', titel: 'Auch-KI' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const muerAnon = map.toAnon.get('MUE')!;
    const schAnon = map.toAnon.get('SCH')!;

    const query = [1, 0, 0];
    const corpus = new Map<string, number[]>([
      ['A1', [1, 0, 0]],     // sehr aehnlich
      ['A2', [0, 1, 0]],     // orthogonal
      ['A3', [0.9, 0.1, 0]], // aehnlich
    ]);

    const index = new Map<string, { aktenzeichen: string; tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown }>();
    for (const a of antraege) {
      index.set(a.aktenzeichen, {
        aktenzeichen: a.aktenzeichen,
        tib_kuerz: a.tib_kuerz,
        titel: a.titel,
      });
    }

    const result = runEmbeddingMatching({
      queryEmbedding: query,
      corpusEmbeddings: corpus,
      antraegeIndex: index,
      anonymMap: map,
      eligibleAnonIds: new Set([muerAnon, schAnon]),
      mitarbeiter: { [muerAnon]: makeMa(muerAnon), [schAnon]: makeMa(schAnon) },
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.anonId).toBe(muerAnon);
    // MUE hat 2 aehnliche Antraege -> aehnlicheProjekte sollten gefuellt sein
    expect(result[0]?.aehnlicheProjekte.length).toBeGreaterThan(0);
  });

  it('filtert MAs nicht in eligibleAnonIds raus', () => {
    const antraege = [
      makeAntrag('A1', { tib_kuerz: 'MUE', titel: 'X' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const muerAnon = map.toAnon.get('MUE')!;

    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      corpusEmbeddings: new Map([['A1', [1, 0]]]),
      antraegeIndex: new Map([['A1', { aktenzeichen: 'A1', tib_kuerz: 'MUE' }]]),
      anonymMap: map,
      eligibleAnonIds: new Set(),     // leer
      mitarbeiter: { [muerAnon]: makeMa(muerAnon) },
    });
    expect(result).toEqual([]);
  });

  it('virtuelles Projekt (confidence 0.7) gibt MA Score wenn er sonst keine Antraege hatte', () => {
    const antraege = [
      makeAntrag('A1', { tib_kuerz: 'MUE', titel: 'KI' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const muerAnon = map.toAnon.get('MUE')!;

    const newMaAnon = 'MA99';
    const newMa: AnonymerMitarbeiter = {
      ...makeMa(newMaAnon),
      virtuelleProjekte: [{ antragId: 'A1', confidence: 0.7 }],
    };

    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      corpusEmbeddings: new Map([['A1', [1, 0]]]),
      antraegeIndex: new Map([['A1', { aktenzeichen: 'A1', tib_kuerz: 'MUE' }]]),
      anonymMap: map,
      eligibleAnonIds: new Set([muerAnon, newMaAnon]),
      mitarbeiter: { [muerAnon]: makeMa(muerAnon), [newMaAnon]: newMa },
    });

    expect(result.length).toBe(2);
    // MUE (echter TIB, gewichtung 1.0) > MA99 (virtuell, gewichtung 0.7)
    expect(result[0]?.anonId).toBe(muerAnon);
    expect(result[1]?.anonId).toBe(newMaAnon);
    expect(result[1]?.embeddingScore).toBeGreaterThan(0);
  });

  it('leerer Corpus -> leere Liste', () => {
    const map = buildAnonymMapForTests([]);
    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      corpusEmbeddings: new Map(),
      antraegeIndex: new Map(),
      anonymMap: map,
      eligibleAnonIds: new Set(['MA01']),
      mitarbeiter: { MA01: makeMa('MA01') },
    });
    expect(result).toEqual([]);
  });
});
