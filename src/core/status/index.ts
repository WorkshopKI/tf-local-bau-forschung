/**
 * Status-System — Barrel.
 *
 * Katalog + Snapshot-Anbindung, Historie, Erklärung, Navigator, To-do-Kaskade,
 * Wächter. **Keine Ableitungs-Engine**: die App liest den amtlichen Status, sie
 * rechnet keinen aus (Pitfall #44).
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
export {
  recordKey, leseFeldWert, feldLabel, kuerzelIndex, type KuerzelIndex,
} from './feld-zugriff';
export {
  baueFeldAufloesung, aufloesungFuer, sammleVorkommen, herkunftVon,
  type FeldAufloesung, type AufgeloestesFeld, type FeldVorkommen,
} from './feld-aufloesung';
export type { StatusEvent } from './event-typen';
export { appendEvents, getStatusEvents, getAlleEvents } from './event-store';
export { sortiereEvents, aufzeichnungsGrenze, eventZeitMs } from './event-sort';
export { ermittleReconcileEvents, reconcileStatusEvents, baueLetzteWerte, type ReconcileEingabe } from './reconcile';
export {
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, NEUTRAL_LABEL, MAIL_ROLLE,
  rollenVonFeld, istNeutral, betrifftRolle, rollenLabel, sortiereRollen, parseRollenSpalte,
  leseStatusRolle,
} from './rollen';
export {
  SONDER_KUERZEL, sonderKuerzel, istTestKuerzel, type SonderKuerzel, type SonderArt,
} from './sonderkuerzel';
export {
  loeseKategorieSpalten, kategorienMitDatumsfeldern, kategorieSpaltenSignatur,
} from './kategorie-projektion';
export {
  baueKontext, pruefeBedingung, bedingungFeldRefs, referenzierbareFelder,
  type BedingungsKontext,
} from './bedingung';
export { bedingungAlsText, bedingungSatz } from './bedingung-text';
export { normKey, loseKey } from './normalisierung';
// Die Snapshot-SETZER sind bewusst NICHT hier: sie haben genau einen Aufrufer
// (`snapshot.ts`), und was das Barrel anbietet, wird irgendwann benutzt.
export {
  ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL, ZAH_MARKER_LABEL, SEED_ZAH_PHASEN,
  SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES, SEED_PHASEN_SCHNITT,
  zahPhaseRang, zahPhaseLabel, zahPhasenVon, zahPhasenGeneration,
  geltenderSchnitt, phaseFuerCode, istMarkerCode, kategorieVorgabeVon,
  fristLaeuftVon,
  type PhasenSchnitt,
} from './zah-phasen';
export { schnittVon } from './phasen-schnitt';
export {
  MIN_PHASEN, MAX_PHASEN, pruefeZahPhasen, normalisiereReihenfolge,
  verwaisteZuordnungen, ohneVerwaiste, aendereZahPhase, fuegeZahPhaseHinzu,
  entferneZahPhase, verschiebeZahPhase, setzeCodePhasen,
  type VerwaisteZuordnungen,
} from './zah-phasen-edit';
export {
  kategorieFuerCode, kategorieFuerPhase, codeFuerStatusText, zahPhaseFuerStatusText,
  baueFoerderKategorieEintraege, baueFoerderSeedEintraege,
  NACHFORDERUNG_CODES, BEWILLIGT_CODE,
  type KategorieEintrag,
} from './kategorie-ableitung';
export { indexNachSchreibweise } from './wert-index';
export {
  BETRACHTUNGSBEREICH_SEED, bereichsProgramme, bereichsMenge, istImBereich,
  bereichWeichtVomSeedAb,
} from './betrachtungsbereich';
export {
  waehleZieltageVorschlaege, MIN_STICHPROBE,
  type ZieltageAuswahl, type ZieltageUebernahme,
} from './zieltage-vorschlag';
export {
  berechnePhasenVorschlag,
  type PhasenAuswahl, type PhasenVorschlag, type PhasenBeleg, type PhasenKonflikt,
  type PhasenKennzahlen, type QuellenAbweichung,
  type PhasenHerkunft, type PhasenQuelle, type OhneGrund,
} from './feld-phase-vorschlag';
export {
  baueHerleitung, herleitungAlsText, statusHerleitungKopf,
  type Herleitung, type HerleitungEingabe, type Datenstand, type StatusKurz,
  type VerlaufSchritt, type LetzterVorgang, type TriggerWirkungSatz,
} from './herleitung';
export {
  ermittleHaltedatum,
  type Haltedatum, type HaltedatumEingabe, type HaltedatumHerkunft,
} from './haltedatum';
// `frist-bezug` steht bewusst NICHT im Barrel: es zieht die Frist-Engine aus
// `core/services/csv` in jeden `@/core/status`-Import und verschiebt damit die
// Modul-Auswertung vor `idb.open()` — 20 `IDBStore not opened` beim Seitenstart.
// Aufrufer importieren `@/core/status/frist-bezug` direkt (wie `vorkommen.ts`
// es für seine Nachbarn ohnehin verlangt).
// Die Rohtabelle `kuerzel-katalog.data` ist bewusst NICHT hier: nachgeschlagen
// wird nur über `kuerzelAuskunft`, weil ein flacher Zugriff für 78,9 % der
// Anträge den falschen Klartext liefert (Guard `kuerzel-nie-flach`).
export {
  kuerzelAuskunft, heutigesKuerzel, projektformVonVbPhase, projektformLage,
  nachschlageformVonVbPhase, nachschlageformVonLage,
  projektformAbhaengigeKuerzel, strittigeKuerzel, uneinigeKuerzel,
  offeneBedeutungen, kuerzelKategorien,
  type Projektform, type ProjektformLage, type Nachschlageform,
  type BezeichnungsHerkunft, type UneinigesKuerzel,
  type KuerzelAuskunft, type KuerzelForm, type KuerzelEintrag,
} from './kuerzel-katalog';
// Die Entscheidungen der Klärrunde — Daten, keine Tür. Nachgeschlagen wird
// weiterhin über `kuerzelAuskunft`; diese Exporte tragen den BELEG in die
// Anzeige („Antwortrunde 1 · AnMa · 07.08.2026") und in den Bericht.
export {
  VEREINHEITLICHT, DIVERGENZ_BESTAETIGT, DS_BEDEUTUNG, QUELLKORREKTUREN,
  belegText, divergenzBestaetigt, dsBedeutungFuer, vereinheitlichtFuer,
  type KurationsBeleg, type KurationsStand,
  type VereinheitlichteBedeutung, type BestaetigteDivergenz,
  type DsBedeutung, type Quellkorrektur,
} from './kuerzel-kuration';
export {
  erklaereSegmente, erklaerKatalog, kuerzelErklaerung, statusErklaerung,
  ebeneErklaerung, empfaengerErklaerung,
  type ErklaertesSegment, type SegmentErklaerung, type ErklaerKatalog,
} from './trigger-erklaerung';
export {
  STATUS_CODE_KATALOG, KURZLABEL_MAX, baueStatusCodeIndex, findeStatusCode, statusCodeEintrag,
  reichereWerteAn, zaehleOhneCode,
  type StatusCodeEintrag, type StatusCodeIndex, type StatusCodeTreffer, type JoinArt,
} from './status-codes';
export {
  parseTriggerZeile, parseTriggerTabelle, parseStatusVergleich,
  referenzierteKuerzel, kuerzelListe,
  type TriggerRohzeile,
} from './trigger-parser';
export {
  triggerSatz, triggerSatzVon, triggerSegmente, triggerSegmenteVon, alsText,
  textbausteinName, baueLegende,
  type TextbausteinLegende, type TriggerSegment, type KuerzelHerkunft,
} from './trigger-satz';
export {
  herkunftZuStatus, richtlinienSatz,
  type StatusHerkunft, type HerkunftGruppe, type HerkunftWirkung, type HerkunftEbene,
} from './trigger-herkunft';
export {
  erhebeRegelWirkung, wirkungsSignatur,
  type RegelWirkung, type BewerteterLauf, type WirkungsSignatur,
} from './regel-wirkung';
export {
  vergleicheFassungen,
  type AenderungsBilanz, type AenderungsGruppe, type VerglichenerVorgang,
} from './regel-aenderung';
export {
  planeRotation, vereinigeArchiv, istKatalogArchiv,
  FASSUNGEN_IN_HAUPTDATEI, STATUS_KATALOG_ARCHIV_PATH,
  type StatusKatalogArchiv, type RotationsPlan,
} from './katalog-rotation';
export {
  erhebeTerminBefunde,
  type TerminBefunde, type TerminFall, type BefundGruppe,
  type PrecheckLuecke, type FeldPaar, type VerdeckungsBefund,
} from './termin-erhebung';
export {
  leseKatalogVomShare, schreibeKatalogAufShare, synchronisiereKatalogVomShare,
  uebernehmeKatalogVomShare, istKatalogDatei,
  leseKatalogNummer, vereinigeMitShare, umnummeriereEigeneFassung, leseKatalogArchiv,
  letzterKatalogAktivWechsel, quittiereKatalogAktivWechsel,
  STATUS_KATALOG_PATH, KATALOG_BACKUP_KEY,
  type StatusKatalogDatei, type KatalogSchreibErgebnis, type KatalogUebernahmeErgebnis,
} from './katalog-share';
export {
  planeVereinigung, findeKonflikt, istSelbeFassung, zaehleAbweichungen, leseNummerAusKopf,
  type KatalogKonflikt, type FremdeFassung, type Vereinigung,
} from './katalog-konflikt';
export {
  baueVerbundFelder, vorkommenAus, zaehleVorkommen, zuletztGesehen, csvSpaltenJeFeld,
  type VerbundFelder,
} from './cockpit-berechnung';
export {
  aendereWert, aendereFeld, fuegeWertHinzu, fuegeFeldHinzu,
  fuegeKategorieHinzu, aendereKategorie, entferneKategorie,
  ergaenzeSeedFelder, type ErgaenzungsErgebnis,
  seedTextAbweichungen, uebernimmSeedTexte, type TextAbweichung,
  uebernimmStatusCodes, aktuellerStatusCodeKatalog,
  vorgangssystemLuecke, ergaenzeVorgangssystemSeed, type VorgangssystemLuecke,
  todoRegelDrift, zieheTodoRegelnNach, type TodoRegelDrift,
  setzeZieltage, setzeFeldPhasen, setzeKurzLabel,
  relevanzLuecke, markiereRelevanz,
  kanonischeCodeDoppel, entdoppleKanonischeCodes,
  aendereTodoRegel, verschiebeTodoRegel, fuegeTodoRegelHinzu, codesMitRolle,
} from './katalog-edit';
export {
  katalogDrift, hatDrift, leereKatalogDrift,
  type KatalogDrift, type PhasenDrift, type PhaseKurz, type PhaseUmbenannt,
  type PhaseVerschoben, type PhaseVorgabe, type ZuordnungDrift, type ZieltagDrift,
  type WertKurz, type ProminenzDrift,
} from './katalog-drift';
export {
  ermittleTodo, ermittleTodosAlleRollen, baueTodoKontext, todoWerte,
  type TodoErgebnis, type TodoBeleg, type TodoOptionen,
} from './todo-engine';
export {
  REGELSATZ_DEFAULT, STRANG_PREFIX,
  regelsatzVon, sperreGiltFuer, sperrEintragTrifft, strangAusEintrag,
} from './regelsatz';
export { jederVorgang, type VorgangsRohsatz } from './vorgangs-quelle';
export {
  ladeVorkommen, zaehleCodes, codeAusSatz, kuerzelEinesVorgangs, type VorkommenStand,
} from './vorkommen';
// Das Import-Diff-Journal hat ein eigenes Barrel (`./journal`); hier stehen nur
// die Stellen, die andere Module ohnehin über `@/core/status` beziehen.
export {
  chronikFuerAntrag, letzterNachtLauf, letzteAenderungJeAntrag,
  journalFrische, JOURNAL_FRISCHE_WARNUNG_TAGE,
  type AntragsChronik, type FeldChronik, type JournalEintrag, type JournalFrische,
  type NachtLauf,
} from './journal';
export {
  erhebePlatzhalter, fassePlatzhalterZusammen, BEISPIELE_MAX, PAAR_ALTBESTAND_TAGE,
  erhebeBlindeFlecken, erhebeKuerzelKarte,
  type ErhebungsFall, type BewerteterVorgang, type PlatzhalterGruppe,
  type PlatzhalterErhebung, type RollenBilanz,
  type BlinderFleck, type BlindeFleckenErhebung, type FleckenBlock, type FleckenFall,
  type KuerzelKarteZeile,
} from './fb-erhebung';
export {
  AB_TODO_REGELN, baueTodoRegelSeed, ENTFALLENE_REGEL_IDS, feld as todoFeld,
} from './todo-regeln.seed';
export {
  pruefeStillstand, letzteAktivitaetVon, zieltageFuer, medianLiegezeit, KUERZEL_PAARE,
  findeOffenePaare,
  type WaechterEingabe, type WaechterErgebnis, type WaechterUrteil, type OffenesPaar,
  type AnstehenderTermin, type Zeitachse,
} from './waechter';
export {
  navigatorKandidaten, wirkungZeilen, wirkungGruppen,
  type NavigatorEingabe, type NavigatorErgebnis, type NavigatorKandidat,
  type TriggerWirkung, type BedingungsUrteil, type WirkungsZeile, type WirkungsGruppe,
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
  baueChronik, gruppiereNachMonat, monateDazwischen, teileChronik, traegerLabel,
  type ChronikEintrag, type ChronikMonat,
} from './chronik';
// Die Verlaufsableitung hat ein eigenes Barrel (`./verlauf`), wie das Journal.
// Sie steht bewusst NICHT hier: dieses Barrel speist auch den Pfad, der den
// GELTENDEN Status bestimmt, und die Rekonstruktion der Vergangenheit darf dort
// nie hineinreichen (Pitfall #44, Guard `verlauf-leitet-keinen-status-ab`).

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
