/** Zentrale Status-Labels und Badge-Variants fuer alle Vorgangstypen. */

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
