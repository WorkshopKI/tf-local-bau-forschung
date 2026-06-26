/** Status-Reihenfolge + Labels für den Schritt-für-Schritt-Fortschritt einer Anfrage. */
import type { BadgeVariant } from '@/components/ui/badge';
import type { AnfrageStatus } from './types';

export const STATUS_REIHENFOLGE: readonly AnfrageStatus[] = [
  'aufgenommen',
  'anonymisiert',
  'export_freigegeben',
  'antwort_importiert',
  'finalisiert',
];

export const STATUS_LABEL: Record<AnfrageStatus, string> = {
  aufgenommen: 'Aufgenommen',
  anonymisiert: 'Anonymisiert',
  export_freigegeben: 'Export freigegeben',
  antwort_importiert: 'Antwort importiert',
  finalisiert: 'Finalisiert',
};

/**
 * Status → Badge-Variante (Fortschritt-Semantik): neutral beim Eingang, info
 * während der laufenden Bearbeitung, warning sobald eine externe Aktion ansteht
 * (Export freigegeben), success wenn finalisiert. „Farbe als Informationsträger".
 */
export const STATUS_VARIANT: Record<AnfrageStatus, BadgeVariant> = {
  aufgenommen: 'default',
  anonymisiert: 'info',
  export_freigegeben: 'warning',
  antwort_importiert: 'info',
  finalisiert: 'success',
};

/** Badge-Variante für einen Status (Fallback `default` bei unbekanntem Wert). */
export function statusVariant(s: AnfrageStatus): BadgeVariant {
  return STATUS_VARIANT[s] ?? 'default';
}

/** Position im Workflow (0-basiert); -1 bei unbekanntem Status. */
export function statusIndex(s: AnfrageStatus): number {
  return STATUS_REIHENFOLGE.indexOf(s);
}

/** True, wenn `status` mindestens `ziel` erreicht hat (Workflow-Gating). */
export function statusErreicht(status: AnfrageStatus, ziel: AnfrageStatus): boolean {
  return statusIndex(status) >= statusIndex(ziel);
}
