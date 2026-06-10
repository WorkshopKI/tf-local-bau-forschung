/**
 * Live-Klassifizierungs-Cache (Klick-Lag-Fix).
 *
 * `buildVerbundClassificationViews` ruft fuer jeden NOCH UNklassifizierten
 * Verbund `klassifiziereAntrag` (Stage-2-Embedding, ~690 ms bei 138 Verbuenden).
 * Diese Live-Ergebnisse haengen NICHT vom persistierten Stand anderer Verbuende
 * ab. Vor dem Fix bustete jeder Pill-Klick (neue `persisted`-Array-Ref) den
 * Cache → voller Recompute inkl. aller Live-Klassifizierungen.
 *
 * Dieser Test prueft, dass eine reine `persisted`-Aenderung KEINE erneuten
 * `klassifiziereAntrag`-Aufrufe ausloest (Live-Cache greift), aber eine
 * Aenderung der echten Live-Deps (kategorien-Ref) den Cache invalidiert.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import type { Klassifizierung, UeberKategorie } from '../types';

// v2.63: der View-Builder ruft die Lookup-Variante (Slim-Cache) — der Spy
// zaehlt deren Aufrufe; die Cache-Semantik (das Testziel) ist unveraendert.
const klassifiziereAntragSpy = vi.fn((input: { aktenzeichen: string }): Klassifizierung => ({
  antragId: input.aktenzeichen,
  vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 0.9, methode: 'embedding' },
  vorgeschlageneAspekte: [],
  freigegebenePrimaer: '',
  freigegebeneAspekte: [],
  status: 'vorgeschlagen',
}));

vi.mock('../services/klassifizierung-engine', () => ({
  klassifiziereAntragFromLookup: (input: unknown) => klassifiziereAntragSpy(input as { aktenzeichen: string }),
}));

import {
  buildVerbundClassificationViews,
  invalidateVerbundClassificationCache,
} from '../services/verbund-aggregation';

function makeAntrag(aktenzeichen: string, verbund_id?: string): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    aktenzeichen,
    ...(verbund_id ? { verbund_id } : {}),
  } as Antrag;
}

function freigegeben(antragId: string): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 0.9, methode: 'embedding' },
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: 'IT',
    freigegebeneAspekte: [],
    status: 'freigegeben',
  };
}

const KATEGORIEN: UeberKategorie[] = [
  { id: 'IT', name: 'IT', farbe: '#000', deskriptorenMapping: [], referenzEmbedding: [] } as unknown as UeberKategorie,
];

describe('buildVerbundClassificationViews — Live-Klassifizierungs-Cache', () => {
  beforeEach(() => {
    invalidateVerbundClassificationCache();
    klassifiziereAntragSpy.mockClear();
  });

  it('persisted-Aenderung loest KEINE erneute Live-Klassifizierung aus', () => {
    // Stabile Refs fuer die echten Live-Deps.
    const antraege = [
      makeAntrag('A1', 'V1'),
      makeAntrag('A2', 'V2'),
      makeAntrag('A3', 'V3'),
    ];
    const embeddings = new Map<string, number[]>();

    // 1. Build: alle 3 unklassifiziert → 3 Live-Klassifizierungen.
    buildVerbundClassificationViews(antraege, null, KATEGORIEN, [], embeddings, true, []);
    expect(klassifiziereAntragSpy).toHaveBeenCalledTimes(3);

    klassifiziereAntragSpy.mockClear();

    // 2. Build: ein Verbund wird freigegeben (NEUES persisted-Array, gleiche
    //    antraege/kategorien/embeddings/stage2-Refs). Die anderen beiden bleiben
    //    unklassifiziert — duerfen aber NICHT neu klassifiziert werden (Cache).
    const persisted = [freigegeben('A1')];
    const views = buildVerbundClassificationViews(antraege, null, KATEGORIEN, persisted, embeddings, true, []);
    expect(klassifiziereAntragSpy).toHaveBeenCalledTimes(0);

    // Sanity: der freigegebene Verbund hat den persistierten Stand.
    const v1 = views.find(v => v.verbundId === 'V1');
    expect(v1?.klassifizierung.status).toBe('freigegeben');
  });

  it('Aenderung der kategorien-Ref invalidiert den Live-Cache', () => {
    const antraege = [makeAntrag('A1', 'V1')];
    const embeddings = new Map<string, number[]>();

    buildVerbundClassificationViews(antraege, null, KATEGORIEN, [], embeddings, true, []);
    expect(klassifiziereAntragSpy).toHaveBeenCalledTimes(1);
    klassifiziereAntragSpy.mockClear();

    // Neue kategorien-Ref (z.B. PL hat eine Kategorie editiert) → Live-Cache muss
    // verworfen werden, Live-Klassifizierung laeuft erneut.
    const neueKategorien = [...KATEGORIEN];
    buildVerbundClassificationViews(antraege, null, neueKategorien, [], embeddings, true, []);
    expect(klassifiziereAntragSpy).toHaveBeenCalledTimes(1);
  });
});
