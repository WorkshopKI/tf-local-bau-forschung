export type VorgangStatus =
  | 'neu'
  | 'in_bearbeitung'
  | 'nachforderung'
  | 'in_pruefung'
  | 'genehmigt'
  | 'abgelehnt'
  | 'archiviert';

/**
 * Generische „Vorgang"-Shape für die Home-Dashboard-Aggregation. Ursprünglich
 * das Datenmodell der (entfernten) Bauantrag-Demo-Domäne; seit dem Entfernen
 * der Domäne (v2.88) nur noch das Projektions-Shape, auf das Förderanträge im
 * Home-Dashboard abgebildet werden (siehe `AntragVorgang` in
 * `plugins/home/dashboardAggregate.ts`). Kein eigenständiger IDB-Store mehr.
 */
export interface Vorgang {
  id: string;
  title: string;
  status: VorgangStatus;
  priority: 'niedrig' | 'normal' | 'hoch' | 'dringend';
  assignee: string;
  created: string;
  modified: string;
  deadline?: string;
  tags: string[];
  notes: string;
}
