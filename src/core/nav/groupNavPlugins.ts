import type { TeamFlowPlugin } from '@/core/types/plugin';

export type NavGroupKey = 'workflow' | 'tools' | 'erprobung' | 'system' | 'kuration' | 'werkbank';

export interface NavGroups {
  workflow: TeamFlowPlugin[];
  tools: TeamFlowPlugin[];
  erprobung: TeamFlowPlugin[];
  system: TeamFlowPlugin[];
  kuration: TeamFlowPlugin[];
  werkbank: TeamFlowPlugin[];
}

/**
 * Beschriftung der Sidebar-Gruppen. `null` = bewusst ohne Überschrift:
 * `workflow` ist der tägliche Weg und braucht keine Ansage, `system` trägt nur
 * `hideFromNav`-Seiten und rendert nichts.
 *
 * EINE Quelle für Sidebar UND Command-Palette — sonst heißt dieselbe Gruppe an
 * zwei Stellen verschieden.
 *
 * `werkbank` (v4.39) trägt die Entwickler-Panels. Sie standen bis dahin unter
 * „Kuration", waren dort aber falsch einsortiert: weder `kuratorOnly` noch
 * `/kuration/*`, und sie kuratieren nichts. Sichtbar sind sie ohnehin nur über
 * ihre eigenen Flags (`devInfraPanel`, `devFixtures`), die in allen vier
 * Variant-Configs genau dort `true` stehen, wo auch `kuratorMenus` true ist —
 * der Umzug ändert die Verfügbarkeit in keiner Variante. Die Beschriftung heißt
 * seit v4.40 schlicht „Developer": das Wort steht in dieser App ohnehin überall
 * für die Entwickler-Sicht (`DEV: State`, `DEV: Infra`), und „(dev)" hinter
 * einem Namen wiederholte nur, was die Einträge selbst schon sagen.
 */
export const NAV_GRUPPEN_LABEL: Record<NavGroupKey, string | null> = {
  workflow: null,
  tools: 'Werkzeuge',
  erprobung: 'In Erprobung',
  system: null,
  kuration: 'Kuration',
  werkbank: 'Developer',
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
  const groups: NavGroups = { workflow: [], tools: [], erprobung: [], system: [], kuration: [], werkbank: [] };
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
