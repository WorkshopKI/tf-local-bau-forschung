/**
 * Barrel des Import-Diff-Journals.
 *
 * Konzept + Begründungen: `docs/architecture/vorgangssystem.md`, Abschnitt
 * „Import-Diff-Journal". Die harten Regeln stehen als Pitfall #48 in CLAUDE.md.
 */
export {
  VERARBEITET_MAX,
  type EintragsArt, type JournalEintrag, type JournalStand, type JournalWert,
  type JournalWerte, type Stempel,
} from './typen';
export {
  JOURNAL_AUSGESCHLOSSEN, KUERZEL_PRAEFIX, STATUS_SPALTEN,
  baueJournalFelder, istJournalSpalte, type JournalFeld,
} from './felder';
export { alsTagesZahl, projiziereAntrag, projiziereExport } from './projektion';
export { berechneDiff, dedupliziere, istUnscharf, type DiffMeta } from './diff';
export { JOURNAL_DIR, JOURNAL_STAND_PATH, journalMonatsPfad, monateZwischen } from './pfade';
export { STEMPEL_LAENGE, alsIsoTag, berechneStempel } from './stempel';
export { haengeEintraegeAn, leseStand, merkeStempel, schreibeStand } from './stand';
export { laufeJournal, type LaufEingabe, type LaufErgebnis } from './lauf';
export {
  journalisiereImport, stempelBekannt, type AnbindungsErgebnis,
} from './import-anbindung';
export {
  chronikFuerAntrag, letzterNachtLauf, letzteAenderungJeAntrag, leereJournalCache,
  bewerteAlter, journalFrische, JOURNAL_FRISCHE_WARNUNG_TAGE,
  type AntragsChronik, type FeldChronik, type JournalFrische, type NachtLauf,
} from './lesen';
