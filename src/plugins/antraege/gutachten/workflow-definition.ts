/**
 * Statische Referenz-Definition „ZIM-EP" — geordnete Abschnitte A–G.
 *
 * Seit v2.101 ist der Workflow **kuratierbare Daten** (Registry-`WorkflowDef`,
 * Seed `ZIM_EP_DEF` in `core/services/skills/registry/seed.ts`); die Laufzeit liest
 * die Schritte über `resolveActiveWorkflow` aus der geladenen Registry. Diese
 * Konstante bleibt als **Seed-Quelle/Referenz** und als Drift-Anker: ein Cross-
 * Layer-Test (`__tests__/zim-ep-seed.test.ts`) sichert, dass `ZIM_EP_DEF` sie exakt
 * spiegelt. UI/Hook importieren sie NICHT mehr direkt (nur noch der Disk-Spiegel
 * der Batch-Generierung + Tests).
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
