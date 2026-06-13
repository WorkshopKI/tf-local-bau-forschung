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
import type { Antrag, AntragOderSlim } from '@/core/services/csv/types';
import {
  klassifiziereAntrag,
} from '../services/klassifizierung';
import type { Klassifizierung, UeberKategorie } from '../types';

export interface KlassifizierungsView {
  antrag: AntragOderSlim;
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

/**
 * Persisted-only-Variante (v2.63 Slim-Cache): baut Views NUR fuer Antraege
 * mit persistierter Klassifizierung — KEINE Live-Klassifizierung (Stage 0/1
 * Deskriptor-Reads) ueber den ganzen Pool. Das Zuweisungs-Cockpit konsumiert
 * ausschliesslich `status === 'freigegeben'`-Zeilen, die immer persistiert
 * sind — die Live-Klassifizierung aller unklassifizierten Antraege war dort
 * reine CPU-Verschwendung und der letzte Grund, volle Records zu brauchen.
 * Reihenfolge folgt `antraege` (wie das Live-Pendant).
 */
export function buildPersistedKlassifizierungsView(
  antraege: ReadonlyArray<AntragOderSlim>,
  persisted: Klassifizierung[],
): KlassifizierungsView[] {
  const persistedById = new Map(persisted.map(k => [k.antragId, k]));
  const out: KlassifizierungsView[] = [];
  for (const a of antraege) {
    const kl = persistedById.get(a.aktenzeichen);
    if (!kl) continue;
    out.push({ antrag: a, klassifizierung: kl, confidence: confidenceFor(kl) });
  }
  return out;
}

/** Memoisierte Hook-Variante von `buildPersistedKlassifizierungsView`. */
export function usePersistedKlassifizierungenView(
  antraege: ReadonlyArray<AntragOderSlim>,
  persisted: Klassifizierung[],
): KlassifizierungsView[] {
  return useMemo(
    () => buildPersistedKlassifizierungsView(antraege, persisted),
    [antraege, persisted],
  );
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
