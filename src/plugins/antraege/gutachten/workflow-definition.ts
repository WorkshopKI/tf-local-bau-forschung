/**
 * Statische Workflow-Definition „ZIM-EP" — geordnete Abschnitte A–G. Dies ist
 * die „Registry" WELCHER Schritte existieren (Reihenfolge, Skill-Zuordnung,
 * Anker); WIE ein Schritt generiert, steckt in der Skill-Registry.
 *
 * Bewusst hart verdrahtet (keine generische Workflow-Kurations-UI — spätere
 * Phase). Die Form ist aber so geschnitten, dass weitere Definitionen (KN, VB …)
 * als weitere Konstanten dieses Typs ergänzt werden können.
 */
import type { KurzfassungContext } from '../kurzfassung/types';
import type { StepId } from './types';

export interface WorkflowStepDef {
  id: StepId;
  /** Voller Abschnittsname (Review-Karte, zugeklappte Zeile, Export-Dialog). */
  label: string;
  /** Kurzlabel für den Stepper-Pill (in v1 der Buchstabe). */
  kurz: string;
  /** Skill-Registry-ID, die diesen Abschnitt generiert. */
  skillId: string;
  /** Schlüssel für die Anker-Tabelle (anchor-mapping.ts). In v1 == id. */
  ankerKey: StepId;
  /** Anwendbarkeits-Gate (in v1 immer anwendbar). */
  gate?: (ctx: KurzfassungContext) => boolean;
  /**
   * SEAM (Schritt 4, in v1 UNGENUTZT): abschnittsbezogene Retrieval-Queries.
   * Ein sauberer Pro-FKZ-Tag-Filter ist auf dem aktuellen Orama-Schema nicht
   * möglich (tags = komma-gejointer String, `where` kann nicht containment-
   * filtern) → bewusst nicht verdrahtet (siehe context-provider.ts).
   */
  retrievalQueries?: string[];
}

export const ZIM_EP_WORKFLOW: readonly WorkflowStepDef[] = [
  { id: 'A', kurz: 'A', label: 'Kurzfassung', skillId: 'gutachten-kurzfassung', ankerKey: 'A' },
  {
    id: 'B', kurz: 'B', label: 'Hintergrund, Stand der Technik, Lösungsweg',
    skillId: 'gutachten-ausgangslage', ankerKey: 'B',
  },
  {
    id: 'C', kurz: 'C', label: 'Technische Risiken', skillId: 'gutachten-risiken', ankerKey: 'C',
    retrievalQueries: ['technische Risiken Herausforderungen'],
  },
  {
    id: 'D', kurz: 'D', label: 'Markt', skillId: 'gutachten-markt', ankerKey: 'D',
    retrievalQueries: ['Markt Zielgruppen Stückpreis Wettbewerb'],
  },
  { id: 'E', kurz: 'E', label: 'Unternehmensgegenstand', skillId: 'gutachten-unternehmen', ankerKey: 'E' },
  {
    id: 'F', kurz: 'F', label: 'Ergebnisverwertung', skillId: 'gutachten-verwertung', ankerKey: 'F',
    retrievalQueries: ['Verwertung Umsatz Markteinführung'],
  },
  { id: 'G', kurz: 'G', label: 'Technologiekompetenz', skillId: 'gutachten-kompetenz', ankerKey: 'G' },
];

/** Definition nach Step-ID (z.B. für Label/Skill-Lookup im Runner/UI). */
export function stepDef(id: StepId): WorkflowStepDef {
  const def = ZIM_EP_WORKFLOW.find(s => s.id === id);
  if (!def) throw new Error(`Unbekannter Workflow-Schritt: ${id}`);
  return def;
}
