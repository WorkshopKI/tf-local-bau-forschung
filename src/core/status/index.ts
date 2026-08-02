/**
 * Status-System neu — Barrel.
 *
 * Schicht 1 (Katalog) + Snapshot-Anbindung. Historie (Schicht 2) und
 * Ableitungs-Engine (Schicht 3) kommen in den Folgephasen dazu.
 */
export * from './typen';
export { STATUS_KATALOG_STORE, STATUS_EVENT_STORE } from './stores';
export {
  baueSeedVersion, baueSeedCodeFelderOhneKanonische, KANONISCHE_CODE_FELDER,
} from './seed';
export { SEED_KATEGORIEN, LEERE_SEED_KATEGORIEN } from './seed-kategorien';
export {
  baueSeedCodeFelder, ebeneVonCode, SEED_CODE_TABELLE, AB_DASHBOARD_RELEVANZ,
} from './seed-codes';
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
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, NEUTRAL_LABEL, MAIL_ROLLE,
  rollenVonFeld, istNeutral, betrifftRolle, rollenLabel, sortiereRollen, parseRollenSpalte,
  leseStatusRolle,
} from './rollen';
export {
  loeseKategorieSpalten, kategorienMitDatumsfeldern, kategorieSpaltenSignatur,
} from './kategorie-projektion';
export {
  baueKontext, pruefeBedingung, bedingungFeldRefs, type BedingungsKontext,
} from './bedingung';
export { bedingungAlsText, bedingungSatz } from './bedingung-text';
export { normKey, loseKey } from './normalisierung';
export {
  ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL, ZAH_MARKER_LABEL, SEED_ZAH_PHASEN,
  SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES, ZAH_ZU_SPINE,
  zahPhaseRang, zahPhaseLabel, zahPhasenVon,
} from './zah-phasen';
export {
  baueHerleitung, herleitungAlsText, statusKurz,
  type Herleitung, type HerleitungEingabe, type Datenstand, type StatusKurz,
  type VerlaufSchritt, type LetzterVorgang,
} from './herleitung';
export {
  STATUS_CODE_KATALOG, baueStatusCodeIndex, findeStatusCode, statusCodeEintrag,
  reichereWerteAn, zaehleOhneCode,
  type StatusCodeEintrag, type StatusCodeIndex, type StatusCodeTreffer, type JoinArt,
} from './status-codes';
export {
  parseTriggerZeile, parseTriggerTabelle, triggerSatz, triggerSatzVon, parseStatusVergleich,
  textbausteinName, referenzierteKuerzel, kuerzelListe, baueLegende,
  type TriggerRohzeile, type TextbausteinLegende,
} from './trigger-parser';
export {
  vergleichePhasen, vergleichZusammenfassung, abweichungsMuster,
  type PhasenVergleich, type PhasenVergleichZeile, type AbweichungsMuster,
} from './phasen-vergleich';
export {
  leseKatalogVomShare, schreibeKatalogAufShare, synchronisiereKatalogVomShare,
  uebernehmeKatalogVomShare, istKatalogDatei,
  STATUS_KATALOG_PATH, KATALOG_BACKUP_KEY, type StatusKatalogDatei,
} from './katalog-share';
export {
  baueVerbundFelder, vorkommenAus, zaehleVorkommen, simuliere, verteilung, diffPhasen,
  zuletztGesehen, csvSpaltenJeFeld,
  SPINE_REIHENFOLGE, type VerbundFelder, type SimErgebnis, type PhasenWechsel,
} from './cockpit-berechnung';
export {
  aendereWert, aendereFeld, aendereRegel, fuegeWertHinzu, fuegeFeldHinzu,
  fuegeKategorieHinzu, aendereKategorie, entferneKategorie,
  ergaenzeSeedFelder, type ErgaenzungsErgebnis,
  seedTextAbweichungen, uebernimmSeedTexte, type TextAbweichung,
  uebernimmStatusCodes, aktuellerStatusCodeKatalog,
  vorgangssystemLuecke, ergaenzeVorgangssystemSeed, type VorgangssystemLuecke,
  relevanzLuecke, markiereRelevanz,
  kanonischeCodeDoppel, entdoppleKanonischeCodes,
  aendereTodoRegel, verschiebeTodoRegel,
} from './katalog-edit';
export {
  ermittleTodo, baueTodoKontext, todoWerte,
  type TodoErgebnis, type TodoBeleg,
} from './todo-engine';
export { AB_TODO_REGELN, baueTodoRegelSeed, feld as todoFeld } from './todo-regeln.seed';
export {
  pruefeStillstand, letzteAktivitaetVon, zieltageFuer, medianLiegezeit, KUERZEL_PAARE,
  type WaechterEingabe, type WaechterErgebnis, type WaechterUrteil, type OffenesPaar,
  type AnstehenderTermin, type Zeitachse,
} from './waechter';
export {
  navigatorKandidaten, wirkungZeilen,
  type NavigatorEingabe, type NavigatorErgebnis, type NavigatorKandidat,
  type TriggerWirkung, type BedingungsUrteil, type WirkungsZeile,
} from './navigator';
export { leseSidecar, schreibeSidecar } from './sidecar-datei';
export {
  ladeTrigger, speichereTrigger, triggerFuerKuerzel, triggerFuerProgramm,
  programmeInTrigger, heileTriggerDatei, zeilenOhneProgramm, istTriggerDatei,
  STATUS_TRIGGER_PATH, TRIGGER_CACHE_KEY,
  type TriggerDatei, type TriggerStand, type TriggerHerkunft,
} from './trigger-share';
export {
  importiereStatusKatalog, importiereTriggerTabelle, triggerSchluessel,
  berechneDiff, diffZusammenfassung, TRIGGER_BLATT, PARAMETER_BLATT,
  type StatusKatalogImportErgebnis, type TriggerImportErgebnis,
  type ProgrammStatistik, type NichtInterpretiert,
  type ZeilenBilanz, type EbenenHinweis,
  type Diff, type DiffEintrag, type DiffArt,
} from './import';
export {
  NICHT_ZUGEORDNET_ID, kategorieIndex, kategoriePfad, kategoriePfadLabel,
  kinderVon, flacheBaumListe, baumVon, type KategorieKnoten,
  erzeugtZyklus, findeZyklus,
} from './kategorien';
export { exportiereVersion, validiereImport, type ImportErgebnis } from './export-import';
export {
  eventProminenz, baueLanes, clustere,
  type TimelineEvent, type TimelineLanes, type Cluster,
} from './timeline';
export {
  baueChronik, gruppiereNachMonat,
  type ChronikEintrag, type ChronikMonat,
} from './chronik';

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
