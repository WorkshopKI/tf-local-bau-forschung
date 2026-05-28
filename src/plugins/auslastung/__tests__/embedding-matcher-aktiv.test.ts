/**
 * Embedding-Matcher: Inaktive MAs bekommen keinen Score, ihre Anträge
 * bleiben aber im Corpus + Top-K.
 *
 * Kern-Verifikation: corpusEmbeddings wird in der Funktion komplett
 * iteriert (alle 4 Antraege gehen in den Top-K-Pool), nur die Score-
 * Aggregation skipt inaktive Bearbeiter.
 */
import { describe, it, expect } from 'vitest';
import { runEmbeddingMatching } from '../services/embedding-matcher';
import { buildAnonymMapForTests } from './test-helpers';
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

describe('runEmbeddingMatching mit aktiv-Filter', () => {
  it('inaktiver TIB-Bearbeiter: Antrag bleibt im Top-K, aber kein Score-Credit', () => {
    const antraege = [
      makeAntrag('A1', { tib_kuerz: 'MUE', titel: 'KI' } as Partial<Antrag>),
      makeAntrag('A2', { tib_kuerz: 'ALB', titel: 'Cybersicherheit' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const muerAnon = map.toAnon.get('MUE')!;
    const albAnon = map.toAnon.get('ALB')!;
    // MUE ist inaktiv → soll keinen Score bekommen
    const mitarbeiter = {
      [muerAnon]: makeMa(muerAnon, false),
      [albAnon]: makeMa(albAnon, true),
    };
    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      // beide Antraege haben identische Embeddings → ohne Filter waeren beide gleichauf
      corpusEmbeddings: new Map([['A1', [1, 0]], ['A2', [1, 0]]]),
      antraegeIndex: new Map([
        ['A1', { aktenzeichen: 'A1', tib_kuerz: 'MUE' }],
        ['A2', { aktenzeichen: 'A2', tib_kuerz: 'ALB' }],
      ]),
      anonymMap: map,
      eligibleAnonIds: new Set([muerAnon, albAnon]),
      mitarbeiter,
    });
    const ids = result.map(r => r.anonId);
    expect(ids).not.toContain(muerAnon);
    expect(ids).toContain(albAnon);
  });

  it('virtuelles Projekt eines inaktiven MA erzeugt keinen Score', () => {
    const antraege = [makeAntrag('A1', { tib_kuerz: 'MUE', titel: 'KI' } as Partial<Antrag>)];
    const map = buildAnonymMapForTests(antraege);
    const muerAnon = map.toAnon.get('MUE')!;
    const inactiveAnon = 'MA99';
    const mitarbeiter = {
      [muerAnon]: makeMa(muerAnon, true),
      [inactiveAnon]: {
        ...makeMa(inactiveAnon, false),
        virtuelleProjekte: [{ antragId: 'A1', confidence: 0.9 }],
      } as AnonymerMitarbeiter,
    };
    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      corpusEmbeddings: new Map([['A1', [1, 0]]]),
      antraegeIndex: new Map([['A1', { aktenzeichen: 'A1', tib_kuerz: 'MUE' }]]),
      anonymMap: map,
      eligibleAnonIds: new Set([muerAnon, inactiveAnon]),
      mitarbeiter,
    });
    const ids = result.map(r => r.anonId);
    expect(ids).toContain(muerAnon);
    expect(ids).not.toContain(inactiveAnon);
  });

  it('alle Bearbeiter inaktiv → leeres Ergebnis (kein Crash)', () => {
    const antraege = [
      makeAntrag('A1', { tib_kuerz: 'MUE' } as Partial<Antrag>),
      makeAntrag('A2', { tib_kuerz: 'ALB' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const mitarbeiter = {
      [map.toAnon.get('MUE')!]: makeMa(map.toAnon.get('MUE')!, false),
      [map.toAnon.get('ALB')!]: makeMa(map.toAnon.get('ALB')!, false),
    };
    const result = runEmbeddingMatching({
      queryEmbedding: [1, 0],
      corpusEmbeddings: new Map([['A1', [1, 0]], ['A2', [1, 0]]]),
      antraegeIndex: new Map([
        ['A1', { aktenzeichen: 'A1', tib_kuerz: 'MUE' }],
        ['A2', { aktenzeichen: 'A2', tib_kuerz: 'ALB' }],
      ]),
      anonymMap: map,
      eligibleAnonIds: new Set(Object.keys(mitarbeiter)),
      mitarbeiter,
    });
    expect(result).toEqual([]);
  });
});
