/**
 * Deutsche Anzeige-Labels für das Status-System (Phase 5, UI-Schicht).
 *
 * Reine Nachschlage-Tabellen — keine Logik. Die Wahrheit über Kategorie/Phase/
 * Prominenz liegt im kuratierten Katalog (`@/core/status`); hier stehen nur die
 * sprechenden Texte für Timeline, „Warum?"-Panel und Konflikt-Badge.
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

/** Grund, warum ein Feldwert nicht zur Ableitung beiträgt. */
export const GRUND_LABEL: Record<'unkuratiert' | 'rang-0' | 'inaktiv', string> = {
  unkuratiert: 'unkuratiert',
  'rang-0': 'trägt nicht bei',
  inaktiv: 'inaktiv',
};

/** Nächste-Schritte-Werkzeug → deutsches Chip-Label. */
export const WERKZEUG_LABEL: Record<Werkzeug, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderung',
  ablehnung: 'Ablehnung',
};
