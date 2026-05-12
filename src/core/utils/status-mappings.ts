/**
 * Zentrale Status-Labels und Badge-Variants fuer Vorgang-Status (Bauantrag, Förderantrag).
 *
 * NICHT fuer Feedback-Status verwenden — die haben eine andere Semantik
 * (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`)
 * und ihre eigenen Maps in `src/components/feedback/constants.ts`. Diese Trennung
 * ist Absicht: Vorgang-Status beschreibt Workflow-Zustand, Feedback-Status den
 * Bearbeitungs-Lebenszyklus eines Tickets — gleicher Schluessel-Name (`neu`,
 * `in_bearbeitung`) bedeutet in beiden Welten Verschiedenes.
 *
 * Wenn ein neuer Vorgangstyp dazukommt: hier die Status-Werte ergaenzen.
 * Wenn ein neuer Feedback-Status: in `src/components/feedback/constants.ts`.
 */

export type BadgeVariant = 'info' | 'warning' | 'success' | 'error' | 'default';

export const STATUS_LABELS: Record<string, string> = {
  // Bauantrag
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  nachforderung: 'Nachforderung',
  in_pruefung: 'In Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
  // Forschung
  eingereicht: 'Eingereicht',
  in_begutachtung: 'In Begutachtung',
  nachbesserung: 'Nachbesserung',
  bewilligt: 'Bewilligt',
  abgeschlossen: 'Abgeschlossen',
  // Forschungs-CSV-Rohwerte (Original aus dem Quellsystem) — gekürzt,
  // damit die Status-Pille mit einheitlicher Breite ohne Umbruch passt.
  'abgelehnt/zurückgezogen': 'abgel./zurückgez.',
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Bauantrag
  neu: 'info',
  in_bearbeitung: 'warning',
  nachforderung: 'warning',
  in_pruefung: 'info',
  genehmigt: 'success',
  abgelehnt: 'error',
  archiviert: 'default',
  // Forschung
  eingereicht: 'info',
  in_begutachtung: 'warning',
  nachbesserung: 'warning',
  bewilligt: 'success',
  abgeschlossen: 'default',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'default';
}
