import type { TeamFlowPlugin } from '@/core/types/plugin';

export type NavGroupKey = 'workflow' | 'tools' | 'system' | 'kuration';

export interface NavGroups {
  workflow: TeamFlowPlugin[];
  tools: TeamFlowPlugin[];
  system: TeamFlowPlugin[];
  kuration: TeamFlowPlugin[];
}

/**
 * Reihenfolge der Nav-sichtbaren Plugins: `hideFromNav` raus, dann nach `order`
 * aufsteigend. Einzige Quelle der Nav-Sortierung — sowohl die Sidebar-Gruppen
 * (`groupNavPlugins`) als auch die Command-Palette-Nav-Items leiten sich hieraus
 * ab, damit sie nie auseinanderlaufen.
 */
export function navVisiblePlugins(plugins: TeamFlowPlugin[]): TeamFlowPlugin[] {
  return plugins.filter(p => !p.hideFromNav).sort((a, b) => a.order - b.order);
}

/**
 * Verteilt die Nav-sichtbaren Plugins auf die vier Sidebar-Gruppen. Pure Funktion
 * (testbar) — ShellLayout rendert nur noch das Ergebnis.
 *
 * - `workflow` + `tools`: Arbeits-Gruppe oben, ohne Label.
 * - `system`: untere Gruppe (Trennlinie, ohne Label). Seit v2.360 im Standard-Build
 *   LEER — Skill-Verwaltung steht als letzter `tools`-Eintrag, Einstellungen sitzt
 *   per `hideFromNav` in der Sidebar-Fußzeile. Die Gruppe bleibt als Ablage für
 *   künftige System-Seiten; der `length > 0`-Guard im ShellLayout rendert sie weg.
 * - `kuration`: Kurator-Gruppe (Trennlinie + Label), nur in Kurator-Builds befüllt.
 *
 * `hideFromNav`-Plugins fallen raus (Route bleibt erreichbar, siehe Router).
 */
export function groupNavPlugins(plugins: TeamFlowPlugin[]): NavGroups {
  const groups: NavGroups = { workflow: [], tools: [], system: [], kuration: [] };
  for (const p of navVisiblePlugins(plugins)) groups[p.category].push(p);
  return groups;
}
