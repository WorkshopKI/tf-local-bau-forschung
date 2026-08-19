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
  /**
   * Id des Abschnitts, in dem dieser hier STECKT — für Klappen innerhalb einer
   * Karte, die selbst einen Anker trägt.
   *
   * Fällt der Wirt weg (Beta-/Experten-Achse), fällt dieser mit: sonst stünde
   * das Kind allein im Suchindex und der Sprung liefe auf einen Anker, den
   * niemand rendert. Die Alternative wäre gewesen, dem Kind dieselbe Marke wie
   * dem Wirt in den Sichtbarkeits-Katalog zu schreiben — also dieselbe Aussage
   * an einer zweiten Stelle zu pflegen (Pitfall #54).
   *
   * Der Wirt muss in der Registry VOR dem Kind stehen.
   */
  in?: string;
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

/**
 * Wie gut passt ein Eintrag zur Eingabe? 0 = gar nicht.
 *
 * Die Rangfolge ist der Grund, warum es sie ueberhaupt gibt: bis v4.116 filterte
 * die Suche unsortiert ueber `label + keywords + panelLabel` und schnitt bei
 * sechs ab. Der SEITENNAME zaehlte damit so viel wie der Abschnittsname — wer
 * „Verbindung" tippte, bekam alle sechs Abschnitte der Seite „Daten &
 * Verbindungen" (deren Name das Wort enthaelt) und ausgerechnet den Abschnitt
 * NICHT, der „Verbindung" heisst: er stand in der Registry weiter hinten und
 * fiel unter den Deckel.
 */
function trefferRang(e: SettingsSearchEntry, q: string): number {
  const label = e.label.toLowerCase();
  if (label === q) return 5;
  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  if (e.gruppe.toLowerCase().includes(q)) return 2;
  if (e.keywords.toLowerCase().includes(q)) return 2;
  if (e.panelLabel.toLowerCase().includes(q)) return 1;
  return 0;
}

/**
 * Filtert den Suchindex (ab 2 Zeichen), max. 6 Treffer — der beste zuerst.
 *
 * Bei gleichem Rang bleibt die Registry-Reihenfolge stehen (`sort` ist in
 * JS stabil): innerhalb einer Trefferklasse ist die Reihenfolge der Seiten
 * die vertraute.
 */
export function searchSettings(index: SettingsSearchEntry[], query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return index
    .map(e => ({ e, rang: trefferRang(e, q) }))
    .filter(t => t.rang > 0)
    .sort((a, b) => b.rang - a.rang)
    .slice(0, 6)
    .map(t => t.e);
}
