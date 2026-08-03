/**
 * Panel- & Such-Registry der Einstellungen (Design-Handoff „Variante B").
 *
 * Single Source of Truth für die Settings-Sidebar-Navigation UND den Suchindex:
 * 9 alte Tabs → 5 Panels in zwei Gruppen (Persönlich / System). Sichtbarkeit von
 * Panels und Abschnitten folgt exakt den bisherigen Feature-Flags — nur die
 * Verortung ändert sich. Der Suchindex wird aus den sichtbaren Abschnitten
 * abgeleitet (respektiert die Flags automatisch).
 */
import type { LucideIcon } from 'lucide-react';
import { User, LayoutGrid, Contrast, Sparkles, Database } from 'lucide-react';
import {
  isDevContext,
  isDevFixturesEnabled,
  isLlmKontextSettingEnabled,
  isStreamlitBridgeEnabled,
  isOnlineStatusTabEnabled,
  isKuratorMenusEnabled,
  isAssistentProtokollEnabled,
  isAssistentGedaechtnisEnabled,
  isAntragAufbereitungEnabled,
} from '@/config/feature-flags';
import type { AIProviderConfig } from '@/core/types/config';
import { ProfilTab } from './ProfilTab';
import { MeineTechnologienTab } from './MeineTechnologienTab';
import { DarstellungTab } from './DarstellungTab';
import { WidgetsSettingsSection } from './WidgetsSettingsSection';
import { TastaturTab } from './TastaturTab';
import { AIProviderTab } from './AIProviderTab';
import { SpeicherTab } from './SpeicherTab';
import { DokumentenquellenTab } from './DokumentenquellenTab';
import { TagsTab } from './TagsTab';
import { OnlineTab } from './OnlineTab';

export type SettingsGroup = 'persoenlich' | 'system';

export const GROUP_LABEL: Record<SettingsGroup, string> = {
  persoenlich: 'Persönlich',
  system: 'System',
};

/** Sprung-Ziel für die Einstellungs-Suche (DOM-`id` eines Abschnitts). */
export interface SettingsSectionRef {
  id: string;
  label: string;
  /** Synonyme inkl. der ALTEN Tab-Namen (speicher, online, tastatur …). */
  keywords: string;
}

export interface SettingsPanel {
  id: string;
  label: string;
  icon: LucideIcon;
  group: SettingsGroup;
  sections: SettingsSectionRef[];
  render: () => React.ReactElement;
}

export interface SettingsSearchEntry extends SettingsSectionRef {
  panelId: string;
  panelLabel: string;
  groupLabel: string;
}

interface PanelContext {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}

/** Baut die flag-gefilterte Panel-Liste (sichtbare Panels + sichtbare Abschnitte). */
export function getSettingsPanels(ctx: PanelContext): SettingsPanel[] {
  const panels: SettingsPanel[] = [];

  // ── Persönlich ──
  panels.push({
    id: 'profil',
    label: 'Mein Profil',
    icon: User,
    group: 'persoenlich',
    sections: [
      { id: 'sec-account', label: 'Account', keywords: 'name avatar kurator profil' },
      { id: 'sec-filter', label: 'Bearbeiter-Filter', keywords: 'kürzel inaktive begleitungen filter' },
      { id: 'sec-home', label: 'Initial sichtbare Anträge', keywords: 'home dashboard anzahl startseite' },
      ...(isKuratorMenusEnabled()
        ? [{ id: 'sec-kurator', label: 'Kurator-Bereich', keywords: 'anmelden menüs ttl session kuration' }]
        : []),
      // Assistent & Gedächtnis (Assistent Phase 0) — gerätelokales, opt-in
      // Arbeitsprotokoll. Seit v2.235 nicht mehr als eigener Menüpunkt, sondern in
      // „Mein Profil" gefaltet (persönliche, gerätelokale Daten).
      ...(isAssistentProtokollEnabled()
        ? [
            { id: 'sec-assistent-protokoll', label: 'Arbeitsprotokoll', keywords: 'assistent gedächtnis protokoll aufzeichnung opt-in datenschutz lokal ereignisse' },
            { id: 'sec-assistent-daten', label: 'Meine Daten', keywords: 'assistent daten export löschen transparenz ereignisse protokoll' },
            // Assistent Phase 2 — persönliches Gedächtnis
            ...(isAssistentGedaechtnisEnabled()
              ? [{ id: 'sec-assistent-gedaechtnis', label: 'Persönliches Gedächtnis', keywords: 'gedächtnis memory konsolidierung notizen arbeitskontext präferenzen offene fäden vergessen' }]
              : []),
          ]
        : []),
    ],
    render: () => <ProfilTab />,
  });

  panels.push({
    id: 'technologien',
    label: 'Meine Technologien',
    icon: LayoutGrid,
    group: 'persoenlich',
    sections: [
      { id: 'sec-programm', label: 'Programmkennung', keywords: 'programm automatisch speichern ma' },
      { id: 'sec-kategorien', label: 'Meine Kategorien', keywords: 'hauptkategorie ergänzende erfahrungen matching technologien' },
      { id: 'sec-antragstypen', label: 'Antragstypen', keywords: 'fue ds dl nw typen' },
      { id: 'sec-themen', label: 'Aus deinen bisherigen Anträgen', keywords: 'themen technologien gewählt' },
      { id: 'sec-kompetenzen', label: 'Zusätzliche Kompetenzen', keywords: 'machine learning skills kompetenzen technologien' },
    ],
    render: () => <MeineTechnologienTab />,
  });

  // ── System ──
  panels.push({
    id: 'darstellung',
    label: 'Darstellung & Bedienung',
    icon: Contrast,
    group: 'system',
    sections: [
      { id: 'sec-farbe', label: 'Primärfarbe', keywords: 'akzent farbe darstellung' },
      { id: 'sec-erscheinung', label: 'Erscheinungsbild', keywords: 'dark light theme darstellung modus' },
      { id: 'sec-tastatur', label: 'Tastatur Shortcuts', keywords: 'shortcuts command palette tastatur bedienung kürzel' },
      { id: 'sec-widgets', label: 'Widgets auf der Startseite', keywords: 'widgets startseite home kanban notizen reihenfolge sichtbarkeit ampel antragseingang' },
    ],
    render: () => (
      // „Tastatur Shortcuts" (Standard eingeklappt) steht bewusst VOR den Widgets
      // und wird von „Erscheinungsbild" etwas abgerückt (mt-10); die Widgets
      // folgen mit normalem Abstand (mt-8). Beide Sektionen sind aufklappbar.
      <div>
        <DarstellungTab />
        <div className="mt-10"><TastaturTab /></div>
        <div className="mt-8"><WidgetsSettingsSection /></div>
      </div>
    ),
  });

  panels.push({
    id: 'daten',
    label: 'Daten & Verbindungen',
    icon: Database,
    group: 'system',
    sections: [
      { id: 'sec-speicher', label: 'Speicherorte', keywords: 'datenordner zah netzlaufwerk speicher csv-import aktualisieren datenaktualisierung persönlicher ordner csv-quellen' },
      { id: 'sec-doku', label: 'Persönliche Dokumentenquellen', keywords: 'pfade embedding dms dokumente' },
      { id: 'sec-tags', label: 'Tags', keywords: 'tag-verwaltung neu zählen' },
      ...(isOnlineStatusTabEnabled()
        ? [{ id: 'sec-team', label: 'Team-Status', keywords: 'online wer ist online benutzer-ordner presence' }]
        : []),
    ],
    render: () => (
      <div className="space-y-8">
        <SpeicherTab />
        <DokumentenquellenTab />
        <TagsTab />
        {isOnlineStatusTabEnabled() && <OnlineTab />}
      </div>
    ),
  });

  // KI-Assistent bewusst als letztes System-Panel (Reihenfolge = Push-Reihenfolge in der Gruppe).
  if (isDevContext() || isLlmKontextSettingEnabled() || isStreamlitBridgeEnabled()) {
    const sections: SettingsSectionRef[] = [];
    if (isLlmKontextSettingEnabled()) {
      sections.push({ id: 'sec-kontext', label: 'LLM & Reasoning', keywords: 'kontextfenster tokens thinking reasoning ki assistent' });
    }
    if (isStreamlitBridgeEnabled()) {
      sections.push({ id: 'sec-internki', label: 'Browser-KI-Verbindung', keywords: 'browser interne ki lesezeichen verbindung testen gpt bridge ki assistent' });
    }
    if (isDevContext()) {
      sections.push({ id: 'sec-provider', label: 'Provider', keywords: 'openrouter endpoint api key modell konfiguration' });
    }
    if (isDevFixturesEnabled()) {
      sections.push({ id: 'sec-aufbereitung-eval', label: 'Aufbereitung: Baustein-Eval', keywords: 'eval fixtures goldset aspekte steckbrief precision recall aufbereitung baustein bridge messung' });
    }
    if (isAntragAufbereitungEnabled()) {
      sections.push({ id: 'sec-aufbereitung-recherche', label: 'Aufbereitung: Recherche', keywords: 'deep research recherche url chatgpt claude mistral marktzugang aufbereitung kmu ziel externe' });
    }
    panels.push({
      id: 'ki',
      label: 'Interne KI',
      icon: Sparkles,
      group: 'system',
      sections,
      render: () => <AIProviderTab aiConfig={ctx.aiConfig} setAiConfig={ctx.setAiConfig} />,
    });
  }

  return panels;
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
        groupLabel: GROUP_LABEL[panel.group],
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
    .filter(e => `${e.label} ${e.keywords} ${e.panelLabel} ${e.groupLabel}`.toLowerCase().includes(q))
    .slice(0, 6);
}
