/**
 * Deutsche Anzeige-Labels für das Status-System (UI-Schicht).
 *
 * Reine Nachschlage-Tabellen — keine Logik. Die Wahrheit über Kategorie und
 * Phase liegt im kuratierten Katalog (`@/core/status`); hier stehen nur die
 * sprechenden Texte.
 *
 * `SPINE_LABEL` beschriftet noch die Phasen-Marke der Chronik, die an der
 * (alten) Feld-Phase hängt. Sie wandert mit dem Rückbau auf die ZAH-Phase am
 * Feld — zusammen mit `bestimmeSeit`, das an derselben Angabe hängt.
 */
import type { SpinePhase, StatusCategory, Werkzeug } from '@/core/status';

/** Amtliche Wirbelsäule → deutsches Label (`keine` = „—"). */
export const SPINE_LABEL: Record<SpinePhase, string> = {
  eingang: 'Eingang',
  vollstaendigkeit: 'Vollständigkeit',
  fachpruefung: 'Fachprüfung',
  bewilligung: 'Bewilligung',
  schluss: 'Schluss',
  keine: '—',
};

/** Kanonische Status-Kategorie → deutsches Label (Sentence-Case). */
export const KATEGORIE_LABEL: Record<StatusCategory, string> = {
  offen: 'Offen',
  in_pruefung: 'In Prüfung',
  nachforderung: 'Nachforderung',
  entscheidung: 'Entscheidung',
  bewilligt: 'Bewilligt',
  begleitung: 'Begleitung',
  abgelehnt: 'Abgelehnt',
  abgeschlossen: 'Abgeschlossen',
  sonstige: 'Sonstige',
};

/** Nächste-Schritte-Werkzeug → deutsches Chip-Label. */
export const WERKZEUG_LABEL: Record<Werkzeug, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderung',
  ablehnung: 'Ablehnung',
};
