/** Status-Reihenfolge + Labels für den Schritt-für-Schritt-Fortschritt einer Anfrage. */
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

/** Position im Workflow (0-basiert); -1 bei unbekanntem Status. */
export function statusIndex(s: AnfrageStatus): number {
  return STATUS_REIHENFOLGE.indexOf(s);
}

/** True, wenn `status` mindestens `ziel` erreicht hat (Workflow-Gating). */
export function statusErreicht(status: AnfrageStatus, ziel: AnfrageStatus): boolean {
  return statusIndex(status) >= statusIndex(ziel);
}
