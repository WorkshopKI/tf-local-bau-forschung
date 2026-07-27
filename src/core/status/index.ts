/**
 * Status-System neu — Barrel.
 *
 * Schicht 1 (Katalog) + Snapshot-Anbindung. Historie (Schicht 2) und
 * Ableitungs-Engine (Schicht 3) kommen in den Folgephasen dazu.
 */
export * from './typen';
export { STATUS_KATALOG_STORE, STATUS_EVENT_STORE } from './stores';
export { baueSeedVersion } from './seed';
export { SEED_KATEGORIEN, LEERE_SEED_KATEGORIEN } from './seed-kategorien';
export { baueSeedCodeFelder, ebeneVonCode, SEED_CODE_TABELLE } from './seed-codes';
export { setStatusKatalogSnapshot, getAktiveVersion } from './snapshot';
export {
  listeVersionen, getVersion, speichereVersion,
  getAktiveVersionsnummer, setzeAktiv, ladeAktiveVersion, naechsteVersionsnummer,
  ladeUnkuratiert, speichereUnkuratiert, ladeUnkuratierteFelder, speichereUnkuratierteFelder,
} from './katalog-store';
export {
  ermittleNeueUnkuratierte, pruneKuratierte, ermittleNeueFelder, pruneKuratierteFelder,
  codeAusSpalte, type BeobachteterWert,
} from './entdecke';
export {
  entdeckeUnkuratiertNachImport, entdeckeNeueFelderNachImport, nachImportStatusPflege,
} from './import-integration';
export { recordKey, leseFeldWert, feldLabel } from './feld-zugriff';
export {
  baueFeldAufloesung, aufloesungFuer, sammleVorkommen, herkunftVon,
  type FeldAufloesung, type AufgeloestesFeld, type FeldVorkommen,
} from './feld-aufloesung';
export type { StatusEvent } from './event-typen';
export { appendEvents, getStatusEvents, getAlleEvents } from './event-store';
export { sortiereEvents, aufzeichnungsGrenze, eventZeitMs } from './event-sort';
export { ermittleReconcileEvents, reconcileStatusEvents, baueLetzteWerte, type ReconcileEingabe } from './reconcile';
export { leiteStatusAb, KONFLIKT_SCHWELLE } from './ableitung';
export { KATEGORIE_ZU_SPINE, SPINE_ZU_KATEGORIE, kategorieFuerFeld } from './spine-kategorie';
export {
  loeseKategorieSpalten, kategorienMitDatumsfeldern, kategorieSpaltenSignatur,
} from './kategorie-projektion';
export { baueKontext, pruefeBedingung, type BedingungsKontext } from './bedingung';
export {
  leseKatalogVomShare, schreibeKatalogAufShare, synchronisiereKatalogVomShare,
  uebernehmeKatalogVomShare, istKatalogDatei,
  STATUS_KATALOG_PATH, KATALOG_BACKUP_KEY, type StatusKatalogDatei,
} from './katalog-share';
export {
  baueVerbundFelder, zaehleVorkommen, simuliere, verteilung, diffPhasen, zuletztGesehen,
  csvSpaltenJeFeld,
  SPINE_REIHENFOLGE, type VerbundFelder, type SimErgebnis, type PhasenWechsel,
} from './cockpit-berechnung';
export {
  aendereWert, aendereFeld, aendereRegel, fuegeWertHinzu, fuegeFeldHinzu,
  fuegeKategorieHinzu, aendereKategorie, entferneKategorie,
  ergaenzeSeedFelder, type ErgaenzungsErgebnis,
} from './katalog-edit';
export {
  NICHT_ZUGEORDNET_ID, kategorieIndex, kategoriePfad, kategoriePfadLabel,
  kinderVon, flacheBaumListe, erzeugtZyklus, findeZyklus,
} from './kategorien';
export { exportiereVersion, validiereImport, type ImportErgebnis } from './export-import';
export {
  eventProminenz, baueLanes, clustere,
  type TimelineEvent, type TimelineLanes, type Cluster,
} from './timeline';

import type { IDBStore } from '@/core/services/storage';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { ladeAktiveVersion } from './katalog-store';
import { synchronisiereKatalogVomShare } from './katalog-share';
import { setStatusKatalogSnapshot } from './snapshot';

/**
 * Einmalige Initialisierung beim App-Start (nach `storage.init()`):
 * (1) Team-Fassung vom Daten-Share holen, falls vorhanden, (2) aktive Version
 * laden (seedet Version 1 beim allerersten Mal), (3) In-Memory-Snapshot setzen,
 * aus dem `getStatusCategory` liest. No-op ohne Flag.
 *
 * Der Share-Abgleich läuft **genau hier einmal** und nicht in `ladeAktiveVersion`:
 * die wird bei jedem Import aufgerufen (Reconcile, Auto-Discovery) und darf
 * nicht jedes Mal SMB anfassen. Best-effort — ohne erreichbaren Share bleibt der
 * lokale Stand maßgeblich und die App startet wie zuvor.
 */
export async function initStatusKatalog(idb: IDBStore): Promise<void> {
  if (!isStatusCockpitEnabled()) return;
  await synchronisiereKatalogVomShare(idb);
  const version = await ladeAktiveVersion(idb);
  setStatusKatalogSnapshot(version);
}
