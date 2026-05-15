/**
 * Berechnet live die Klassifizierungs-Vorschlaege fuer alle Antraege des
 * aktiven Programms — basierend auf dem Stage-1-Regel-Mapping. Stage 2 wird
 * NICHT live ausgeloest (asynchron, gross) — der Caller (Admin-Tab) loest
 * das beim Build aus und persistiert die Klassifizierungs-Records.
 */
import { useMemo } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import {
  klassifiziereAntrag,
} from '../services/klassifizierung-engine';
import type { Klassifizierung, UeberKategorie } from '../types';

export interface KlassifizierungsView {
  antrag: Antrag;
  klassifizierung: Klassifizierung;
  confidence: 'high' | 'medium' | 'low';
}

export function buildKlassifizierungsView(
  antraege: Antrag[],
  kategorien: UeberKategorie[],
  persisted: Klassifizierung[],
): KlassifizierungsView[] {
  const persistedById = new Map(persisted.map(k => [k.antragId, k]));
  return antraege.map(a => {
    const existing = persistedById.get(a.aktenzeichen);
    let kl: Klassifizierung;
    if (existing) {
      kl = existing;
    } else {
      kl = klassifiziereAntrag({ antrag: a, kategorien });
    }
    return {
      antrag: a,
      klassifizierung: kl,
      confidence: confidenceFor(kl),
    };
  });
}

function confidenceFor(kl: Klassifizierung): 'high' | 'medium' | 'low' {
  if (kl.vorgeschlageneKategorien.length === 0) return 'low';
  const top = kl.vorgeschlageneKategorien.reduce((a, b) => a.confidence > b.confidence ? a : b);
  if (top.confidence >= 0.7) return 'high';
  if (top.confidence >= 0.4) return 'medium';
  return 'low';
}

/** Hook-Variante mit Memoisierung. */
export function useKlassifizierungenView(
  antraege: Antrag[],
  kategorien: UeberKategorie[],
  persisted: Klassifizierung[],
): KlassifizierungsView[] {
  return useMemo(
    () => buildKlassifizierungsView(antraege, kategorien, persisted),
    [antraege, kategorien, persisted],
  );
}
