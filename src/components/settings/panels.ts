/**
 * Panel- & Such-Vertrag der Einstellungs-Seitenform.
 *
 * Eine Registry ist die Single Source of Truth fuer die Navigationsspalte UND
 * den Suchindex ihres Hubs. Die Registries selbst leben bei ihrem Wirt
 * (`plugins/einstellungen/settingsPanels.tsx`,
 * `plugins/kuration/kurationPanels.tsx`) — hier steht nur, welche Form sie
 * haben und wie daraus gesucht wird, damit beide Hubs dieselbe Trefferliste
 * und denselben Guard bekommen.
 */
import type { LucideIcon } from 'lucide-react';

/** Sprung-Ziel der Hub-Suche (DOM-`id` eines Abschnitts). */
export interface SettingsSectionRef {
  id: string;
  label: string;
  /**
   * Titel der `SettingsGruppe`, in deren Karte der Anker sitzt — WORTGLEICH mit
   * dem `titel`-Prop dort. Die Trefferzeile zeigt damit „Seite › Gruppe": eine
   * Seite traegt bis zu acht Karten, der Seitenname allein sagt also noch nicht,
   * wohin der Sprung geht. Guard: `settings-treffer-weg`.
   */
  gruppe: string;
  /** Synonyme inkl. der ALTEN Seiten-/Tab-Namen (speicher, online, tastatur …). */
  keywords: string;
}

export interface SettingsPanel {
  id: string;
  label: string;
  /** Eine Zeile unter der Ueberschrift — wofuer diese Seite zustaendig ist. */
  untertitel: string;
  icon: LucideIcon;
  sections: SettingsSectionRef[];
  render: () => React.ReactElement;
}

export interface SettingsSearchEntry extends SettingsSectionRef {
  panelId: string;
  panelLabel: string;
}

/** Flacht die sichtbaren Abschnitte aller Panels zum Suchindex. */
export function buildSearchIndex(panels: SettingsPanel[]): SettingsSearchEntry[] {
  const entries: SettingsSearchEntry[] = [];
  for (const panel of panels) {
    for (const section of panel.sections) {
      entries.push({
        ...section,
        panelId: panel.id,
        panelLabel: panel.label,
      });
    }
  }
  return entries;
}

/** Filtert den Suchindex (ab 2 Zeichen), max. 6 Treffer. */
export function searchSettings(index: SettingsSearchEntry[], query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return index
    .filter(e => `${e.label} ${e.keywords} ${e.panelLabel}`.toLowerCase().includes(q))
    .slice(0, 6);
}
