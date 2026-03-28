import type { VorgangStatus } from '@/core/types/vorgang';

export const BAUANTRAG_STATUS_LABELS: Record<VorgangStatus, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  nachforderung: 'Nachforderung',
  in_pruefung: 'In Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};

export const BAUANTRAG_STATUS_VARIANTS: Record<VorgangStatus, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  neu: 'info',
  in_bearbeitung: 'warning',
  nachforderung: 'warning',
  in_pruefung: 'info',
  genehmigt: 'success',
  abgelehnt: 'error',
  archiviert: 'default',
};

export const PRIORITY_LABELS: Record<string, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  dringend: 'Dringend',
};
