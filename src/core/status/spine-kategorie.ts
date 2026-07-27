/**
 * Die Brücke zwischen Status-Kategorie und Spine-Phase — beide Richtungen an
 * **einer** Stelle.
 *
 * Bei Wert-Feldern trägt der Wert seine Kategorie, und die Spine-Phase leitet
 * sich daraus ab (`KATEGORIE_ZU_SPINE`, so seedet `seed.ts` den Katalog).
 * Datums- und Textfelder haben kein Wert-Enum: dort trägt das FELD die Phase,
 * und die Kategorie muss rückwärts abgeleitet werden — sonst hätte ein Beitrag
 * aus einem Datumsfeld keine Kategorie, obwohl `AbleitungsErgebnis` eine führt.
 *
 * Zwei Richtungen in einer Datei, weil sie zueinander passen müssen; ein Test
 * hält sie konsistent (`KATEGORIE_ZU_SPINE[SPINE_ZU_KATEGORIE[p]] === p`).
 */
import type { StatusCategory } from '@/core/utils/status-canonical';
import type { SpinePhase } from './typen';

/**
 * Kategorie → Spine-Phase (deckungsgleich mit `statusZuStepperPosition.ts`:
 * in_pruefung/nachforderung/entscheidung = Fachprüfung; bewilligt/begleitung =
 * Bewilligung; abgeschlossen = Schluss; abgelehnt bricht an Fachprüfung ab).
 */
export const KATEGORIE_ZU_SPINE: Record<StatusCategory, SpinePhase> = {
  offen: 'eingang',
  in_pruefung: 'fachpruefung',
  nachforderung: 'fachpruefung',
  entscheidung: 'fachpruefung',
  bewilligt: 'bewilligung',
  begleitung: 'bewilligung',
  abgeschlossen: 'schluss',
  abgelehnt: 'fachpruefung',
  sonstige: 'keine',
};

/**
 * Spine-Phase → Kategorie: die *repräsentative* Kategorie je Phase. Nicht
 * bijektiv (drei Kategorien sitzen in der Fachprüfung) — deshalb ist es eine
 * bewusste Auswahl, kein Umkehrschluss.
 *
 * `vollstaendigkeit` fällt auf `offen`, weil die Vollständigkeitsprüfung im
 * kanonischen Vokabular unter „offen" läuft (`bearbeitungsreif`, `NL eingegangen`).
 */
export const SPINE_ZU_KATEGORIE: Record<SpinePhase, StatusCategory> = {
  eingang: 'offen',
  vollstaendigkeit: 'offen',
  fachpruefung: 'in_pruefung',
  bewilligung: 'bewilligt',
  schluss: 'abgeschlossen',
  keine: 'sonstige',
};

/**
 * Kategorie eines Feld-Beitrags: die am Feld gepflegte gewinnt, sonst die
 * repräsentative Kategorie seiner Phase. Ein **terminales** Feld in der
 * Fachprüfung ist eine Ablehnung — sonst käme ein endgültiger Negativausgang
 * als „in Prüfung" heraus.
 */
export function kategorieFuerFeld(
  spinePhase: SpinePhase, terminal: boolean, explizit?: StatusCategory,
): StatusCategory {
  if (explizit) return explizit;
  if (terminal && spinePhase === 'fachpruefung') return 'abgelehnt';
  return SPINE_ZU_KATEGORIE[spinePhase];
}
