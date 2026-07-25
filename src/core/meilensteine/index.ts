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
