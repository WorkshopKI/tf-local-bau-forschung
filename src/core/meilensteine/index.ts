/**
 * Bearbeitungs-Meilensteine & Fristen-Monitoring — Barrel.
 *
 * Datenmodell + Auslieferungs-Plan (P0), Feld-Auflösung, Bewertungs-Engine und
 * Auswertung (P1). Persistenz und UI kommen in den Folgephasen dazu.
 */
export * from './typen';
export { baueSeedPlan, baueSeedKnoten, SEED_STAND, SEED_GESAMTFRIST_TAGE } from './seed';
export {
  benoetigteFelder, feldRefsAusBedingung, feldRefsAusKnoten, loeseFelderAuf,
  baueMeilensteinKontext, type FeldAufloesung,
} from './felder';
export { bewerteVerbund, FAELLIG_FENSTER_TAGE, type BewertungsEingabe } from './bewertung';
export {
  werteDauernAus, werteKnotenAus, zaehlePrognosen, bearbeitungsdauerTage, dauerBucket,
  DAUER_BUCKETS, DAUER_BUCKET_GRENZE,
  type AbschlussFall, type DauerAuswertung, type DauerBucket, type KnotenAuswertung,
} from './auswertung';
export {
  ladePlan, readPlanVomShare, schreibePlanAufShare, cachePlan, readCachedPlan,
  freigegebeneFassung, normalisierePlan, normalisiereKnoten, normalisiereBedingung,
  MEILENSTEIN_PLAN_PATH, MEILENSTEIN_PLAN_CACHE_KEY, type GeladenerPlan,
} from './plan-storage';
export {
  neueFassung, freigeben, zurueckInEntwurf, uebernimmFassung, MAX_HISTORIE,
  type FassungsEingabe,
} from './versionierung';
export {
  baueSignatur, berechneProjektion, holeProjektion, ladeProjektion, speichereProjektion,
  projektionsKey, type MeilensteinProjektion,
} from './projektion';
export { nachImportMeilensteinPflege } from './import-integration';
export {
  baueSpaltenKatalog, bekannteStatusWerte, STATUS_FELDER,
  type SpaltenEintrag, type SpaltenTyp,
} from './spalten-katalog';
export {
  aendereKnoten, darfUmhaengen, entferneKnoten, fuegeKnotenHinzu, haengeKnotenUm,
  hebeKnotenAn, istNachfahre, kinderVon, naechsteKnotenId, nummeriereNeu,
  sortiereKnoten, tiefeVon, verschiebeKnoten,
} from './knoten-edit';
export {
  ergaenzeRisiko, erledigeRisiko, istRisikoDatei, leseEigeneRisiken, leseRisikenAusOrdner,
  offeneRisiken, schreibeEigeneRisiken, RISIKO_CACHE_KEY, type RisikoDatei,
} from './risiko-storage';
