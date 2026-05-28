/**
 * Berechnet live die Klassifizierungs-Vorschlaege fuer alle Antraege des
 * aktiven Programms.
 *
 * Standard-Aufruf nutzt Stage 0 (ZT-Boolean) + Stage 1 (Deskriptor-Regel).
 * Wenn `corpusEmbeddings` + `stage2Aktiv: true` gereicht werden, wird
 * zusaetzlich Stage 2 (Embedding-Centroid-Match) aktiviert — fuer neue
 * Antraege ohne gesetzte Deskriptoren die einzige automatische Lösung
 * (Bearbeiter setzt Deskriptoren erst NACH Antragsbearbeitung). Stage 2
 * braucht zusätzlich `referenzEmbedding` pro Kategorie — bei Greenfield
 * (noch keine freigegebenen Klassifizierungen) muss der User erst ein
 * paar Beispiele pro Kategorie seedan und Corpus-Build laufen lassen.
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
  corpusEmbeddings?: Map<string, number[]>,
  stage2Aktiv?: boolean,
): KlassifizierungsView[] {
  const persistedById = new Map(persisted.map(k => [k.antragId, k]));
  return antraege.map(a => {
    const existing = persistedById.get(a.aktenzeichen);
    let kl: Klassifizierung;
    if (existing) {
      kl = existing;
    } else {
      const queryEmbedding = corpusEmbeddings?.get(a.aktenzeichen);
      kl = klassifiziereAntrag({
        antrag: a,
        kategorien,
        queryEmbedding,
        stage2Aktiv: stage2Aktiv === true,
      });
    }
    return {
      antrag: a,
      klassifizierung: kl,
      confidence: confidenceFor(kl),
    };
  });
}

function confidenceFor(kl: Klassifizierung): 'high' | 'medium' | 'low' {
  const primaer = kl.vorgeschlagenePrimaer;
  if (!primaer) return 'low';
  if (primaer.confidence >= 0.7) return 'high';
  if (primaer.confidence >= 0.4) return 'medium';
  return 'low';
}

/** Hook-Variante mit Memoisierung. */
export function useKlassifizierungenView(
  antraege: Antrag[],
  kategorien: UeberKategorie[],
  persisted: Klassifizierung[],
  corpusEmbeddings?: Map<string, number[]>,
  stage2Aktiv?: boolean,
): KlassifizierungsView[] {
  return useMemo(
    () => buildKlassifizierungsView(antraege, kategorien, persisted, corpusEmbeddings, stage2Aktiv),
    [antraege, kategorien, persisted, corpusEmbeddings, stage2Aktiv],
  );
}
