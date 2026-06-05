/**
 * Manueller MA-Eintrag (v2.19) — baut eine `MatchResult` fuer einen von der PL
 * von Hand ausgewaehlten MA, der vom Matcher NICHT vorgeschlagen wurde.
 *
 * Die Card zeigt bewusst KEINEN Score (alle Score-Felder 0, `manuell: true`),
 * aber dieselben Kapazitaets-/Kontingent-Angaben wie eine echte Vorschlags-Card.
 * Dafuer werden exakt dieselben Helfer wie in der Matching-Engine genutzt
 * (`computeKapazitaet` + `kontingentInfoFor`), damit „X TVs frei" und
 * „Typ-Kontingent: r/N TVs" konsistent sind.
 */
import {
  stundenProTVFor,
  type AnonymerMitarbeiter,
  type AntragstypBucket,
  type AuslastungConfig,
  type MatchResult,
} from '../types';
import { computeKapazitaet } from './kapazitaet';
import { kontingentInfoFor } from './kontingent';
import type { MaQuartalsAuslastung } from './quartals-auslastung';

export function buildManualMatch(
  ma: AnonymerMitarbeiter,
  antragBucket: AntragstypBucket | null,
  auslastung: MaQuartalsAuslastung | undefined,
  verbrauch: Partial<Record<AntragstypBucket, number>> | undefined,
  config: AuslastungConfig,
  benoetigteStunden: number,
): MatchResult {
  // v2.31: Pro-Typ-Stunden-Faktor fuer die Kontingent-Anzeige (Bucket bekannt).
  const stundenProTV = stundenProTVFor(config, antragBucket);
  const kap = computeKapazitaet(ma, auslastung, config);
  const kInfo = kontingentInfoFor(ma, antragBucket, verbrauch, stundenProTV);

  return {
    anonId: ma.anonId,
    // Kein Match-Score — manuell hinzugefuegt.
    bm25Score: 0,
    embeddingScore: 0,
    kompetenzScore: 0,
    balanceScore: 0,
    finalScore: 0,
    matchendeTechnologien: [],
    aehnlicheProjekte: [],
    matchStufe: 1,
    confidence: 'low',
    astMatchCount: 0,
    astBoost: 0,
    // Kapazitaet (identisch zur Engine-Berechnung).
    restKapazitaet: kap.restStunden,
    quartalsKapazitaet: kap.effektivStunden,
    ueberbuchung: kap.ueberbuchung,
    benoetigteStunden,
    // Typ-Kontingent fuer die „r/N TVs"-Anzeige.
    kontingentRest: kInfo.rest ?? undefined,
    kontingentQuartal: kInfo.kontingentQ ?? undefined,
    kontingentScore: kInfo.score,
    manuell: true,
  };
}
