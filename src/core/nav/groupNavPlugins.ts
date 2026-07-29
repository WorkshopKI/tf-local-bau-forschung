import type { TeamFlowPlugin } from '@/core/types/plugin';

export type NavGroupKey = 'workflow' | 'tools' | 'erprobung' | 'system' | 'kuration';

export interface NavGroups {
  workflow: TeamFlowPlugin[];
  tools: TeamFlowPlugin[];
  erprobung: TeamFlowPlugin[];
  system: TeamFlowPlugin[];
  kuration: TeamFlowPlugin[];
}

/**
 * Beschriftung der Sidebar-Gruppen. `null` = bewusst ohne Überschrift:
 * `workflow` ist der tägliche Weg und braucht keine Ansage, `system` trägt nur
 * `hideFromNav`-Seiten und rendert nichts.
 *
 * EINE Quelle für Sidebar UND Command-Palette — sonst heißt dieselbe Gruppe an
 * zwei Stellen verschieden.
 */
export const NAV_GRUPPEN_LABEL: Record<NavGroupKey, string | null> = {
  workflow: null,
  tools: 'Werkzeuge',
  erprobung: 'In Erprobung',
  system: null,
  kuration: 'Kuration',
};

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
 * Verteilt die Nav-sichtbaren Plugins auf die Sidebar-Gruppen. Pure Funktion
 * (testbar) — ShellLayout rendert nur noch das Ergebnis. Beschriftung und
 * Reihenfolge der Gruppen: `NAV_GRUPPEN_LABEL` bzw. der Render-Code.
 *
 * `hideFromNav`-Plugins fallen raus (Route bleibt erreichbar, siehe Router).
 */
export function groupNavPlugins(plugins: TeamFlowPlugin[]): NavGroups {
  const groups: NavGroups = { workflow: [], tools: [], erprobung: [], system: [], kuration: [] };
  for (const p of navVisiblePlugins(plugins)) groups[p.category].push(p);
  return groups;
}

/**
 * Welche Einträge einer Gruppe die Sidebar zeigt. Zugeklappt bleibt die gerade
 * offene Seite stehen — sonst verschwindet der aktive Eintrag und mit ihm die
 * Ortsangabe („wo bin ich?"). Bewusst NICHT „bei aktiver Seite ganz aufklappen":
 * dann liefe der Zuklapp-Knopf ins Leere, solange man in der Gruppe steht.
 */
export function sichtbareGruppenItems(
  items: TeamFlowPlugin[],
  offen: boolean,
  activeId: string,
): TeamFlowPlugin[] {
  return offen ? items : items.filter(p => p.id === activeId);
}
