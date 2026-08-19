/**
 * Panel- & Such-Registry der Einstellungen (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`).
 *
 * Single Source of Truth für die Settings-Navigation UND den Suchindex:
 * **4 Panels** — „Meine Technologien" ist seit v4.28 kein eigener Menüpunkt
 * mehr, sondern die Gruppe „Mein Fachprofil" in „Mein Profil". Die
 * `sec-…`-Anker der alten Seite bleiben unverändert; sie sind der Vertrag von
 * Suche, Deep-Links (`?sektion=…`) und `ModulSchlossGate`.
 *
 * Sichtbarkeit von Panels und Abschnitten folgt den Feature-Flags — der
 * Suchindex wird aus den sichtbaren Abschnitten abgeleitet und respektiert sie
 * dadurch automatisch.
 */
import { User, Contrast, Sparkles, Database } from 'lucide-react';
import {
  isDevContext,
  isDevFixturesEnabled,
  isLlmKontextSettingEnabled,
  isOnlineStatusTabEnabled,
  isKuratorMenusEnabled,
  isAssistentProtokollEnabled,
  isAssistentGedaechtnisEnabled,
  isAntragAufbereitungEnabled,
  hatModulSchloss,
  hatIrgendeinModulSchloss,
} from '@/config/feature-flags';
import type { AIProviderConfig } from '@/core/types/config';
import type { SettingsPanel, SettingsSectionRef } from '@/components/settings';
import { ProfilPanel } from './profil/ProfilPanel';
import { DarstellungPanel } from './darstellung/DarstellungPanel';
import { DatenPanel } from './daten/DatenPanel';
import { KiPanel } from './ki/KiPanel';

interface PanelContext {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}

/** Baut die flag-gefilterte Panel-Liste (sichtbare Panels + sichtbare Abschnitte). */
export function getSettingsPanels(ctx: PanelContext): SettingsPanel[] {
  const panels: SettingsPanel[] = [];

  panels.push({
    id: 'profil',
    label: 'Mein Profil',
    untertitel: 'Wer du bist, was zu dir passt, was auf der Startseite landet.',
    icon: User,
    sections: [
      { id: 'sec-account', label: 'Account', gruppe: 'Account', keywords: 'name avatar kurator profil' },
      // Die Zusammenfassungszeile steht in der Account-Karte, nicht im
      // Fachprofil — der Weg nennt die Karte, in der die Zeile wirklich sitzt.
      { id: 'sec-programm', label: 'Programmkennung', gruppe: 'Account', keywords: 'programm automatisch speichern ma meine technologien fachprofil' },
      // „Mein Fachprofil" — bis v4.27 das eigene Panel „Meine Technologien".
      // Der alte Menüname bleibt als Suchbegriff an den Abschnitten, sonst
      // fände ihn niemand mehr, der ihn im Kopf hat.
      { id: 'sec-kategorien', label: 'Meine Kategorien', gruppe: 'Mein Fachprofil', keywords: 'hauptkategorie ergänzende erfahrungen matching technologien meine technologien fachprofil' },
      { id: 'sec-antragstypen', label: 'Antragstypen', gruppe: 'Mein Fachprofil', keywords: 'fue ds dl nw typen meine technologien fachprofil' },
      { id: 'sec-themen', label: 'Themen aus deinen Anträgen', gruppe: 'Mein Fachprofil', keywords: 'themen technologien gewählt auto-tags meine technologien' },
      { id: 'sec-kompetenzen', label: 'Eigene Kompetenzen', gruppe: 'Mein Fachprofil', keywords: 'machine learning skills kompetenzen technologien meine technologien' },
      { id: 'sec-filter', label: 'Bearbeiter-Filter', gruppe: 'Welche Anträge du siehst', keywords: 'kürzel inaktive begleitungen filter rolle ztp pfm welche anträge' },
      { id: 'sec-home', label: 'Anträge auf der Startseite', gruppe: 'Welche Anträge du siehst', keywords: 'home dashboard anzahl startseite initial sichtbar' },
      // Beta-Funktionen + Expertenmodus. Unantastbar im Sichtbarkeits-Katalog:
      // ein ausgeblendeter Abschnitt wäre der Weg zu den Schaltern selbst.
      { id: 'sec-umfang', label: 'Umfang der Oberfläche', gruppe: 'Umfang der Oberfläche', keywords: 'beta experte expertenmodus beta-funktionen entschlacken ausblenden aufräumen umfang tiefe erprobung' },
      // Der freie Kurator-Schalter existiert nur in Builds OHNE Kurator-Schloss
      // (ProfilTab) — die zweite Bedingung muss mit, sonst bietet die Navigation
      // in `pl` einen Abschnitt an, den es auf der Seite nicht gibt.
      ...(isKuratorMenusEnabled() && !hatModulSchloss('kurator')
        ? [{ id: 'sec-kurator', label: 'Kurator-Bereich', gruppe: 'Zusatz-Module', keywords: 'anmelden menüs ttl session kuration' }]
        : []),
      // Wo Schlösser existieren, ist das hier der einzige Weg hinein — und das
      // Ziel, auf das ModulSchlossGate verweist. Ohne Eintrag ist die Sektion
      // weder über die Sprungmarken noch über die Einstellungs-Suche auffindbar.
      ...(hatIrgendeinModulSchloss()
        ? [{ id: 'sec-freischaltung', label: 'Module freischalten', gruppe: 'Zusatz-Module', keywords: 'passwort zusatzpasswort auslastung kuration sperren entsperren modul freischalten' }]
        : []),
      // Assistent & Gedächtnis (Assistent Phase 0) — gerätelokales, opt-in
      // Arbeitsprotokoll. Seit v2.235 nicht mehr als eigener Menüpunkt, sondern in
      // „Mein Profil" gefaltet (persönliche, gerätelokale Daten).
      ...(isAssistentProtokollEnabled()
        ? [
            { id: 'sec-assistent-protokoll', label: 'Arbeitsprotokoll', gruppe: 'Persönlicher Assistent', keywords: 'assistent gedächtnis protokoll aufzeichnung opt-in datenschutz lokal ereignisse' },
            { id: 'sec-assistent-daten', label: 'Aufgezeichnete Daten', gruppe: 'Persönlicher Assistent', keywords: 'assistent daten export löschen transparenz ereignisse protokoll meine daten' },
            // Assistent Phase 2 — persönliches Gedächtnis
            ...(isAssistentGedaechtnisEnabled()
              ? [{ id: 'sec-assistent-gedaechtnis', label: 'Persönliches Gedächtnis', gruppe: 'Persönlicher Assistent', keywords: 'gedächtnis memory konsolidierung notizen arbeitskontext präferenzen offene fäden vergessen' }]
              : []),
          ]
        : []),
    ],
    render: () => <ProfilPanel />,
  });

  panels.push({
    id: 'darstellung',
    label: 'Darstellung & Bedienung',
    untertitel: 'Gilt nur für dieses Gerät.',
    icon: Contrast,
    sections: [
      { id: 'sec-erscheinung', label: 'Farbschema', gruppe: 'Erscheinungsbild', keywords: 'dark light hell dunkel theme darstellung modus erscheinungsbild' },
      { id: 'sec-farbe', label: 'Primärfarbe', gruppe: 'Erscheinungsbild', keywords: 'akzent farbe darstellung' },
      { id: 'sec-farb-vorschau', label: 'Farb-Vorschau', gruppe: 'Erscheinungsbild', keywords: 'vorschau badge akzent info erfolg warnung fehler' },
      { id: 'sec-tastatur', label: 'Alle Tastenkürzel', gruppe: 'Tastatur', keywords: 'shortcuts command palette tastatur bedienung kürzel' },
      { id: 'sec-widgets', label: 'Alle Widgets verwalten', gruppe: 'Startseiten-Widgets', keywords: 'widgets startseite home kanban notizen reihenfolge sichtbarkeit ampel antragseingang' },
    ],
    render: () => <DarstellungPanel />,
  });

  panels.push({
    id: 'daten',
    label: 'Daten & Verbindungen',
    untertitel: 'Woher die App ihre Daten liest und wohin sie deine speichert.',
    icon: Database,
    sections: [
      { id: 'sec-speicher', label: 'Ordner', gruppe: 'Ordner', keywords: 'datenordner zah netzlaufwerk speicher speicherorte csv-import aktualisieren datenaktualisierung persönlicher ordner csv-quellen' },
      { id: 'sec-verzeichnisse', label: 'Verbundene Verzeichnisse', gruppe: 'Verbundene Verzeichnisse', keywords: 'verzeichnis hinzufügen dokumentverzeichnis datenverzeichnis opfs sandbox wurzel' },
      { id: 'sec-arbeitsverlauf', label: 'Arbeitsverlauf', gruppe: 'Ordner', keywords: 'arbeitsverlauf arbeitskontext protokoll letzte schritte' },
      { id: 'sec-doku', label: 'Persönliche Dokumentenquellen', gruppe: 'Persönliche Dokumentenquellen', keywords: 'pfade embedding dms dokumente' },
      { id: 'sec-tags', label: 'Tags', gruppe: 'Tags', keywords: 'tag-verwaltung neu zählen' },
      ...(isOnlineStatusTabEnabled()
        ? [{ id: 'sec-team', label: 'Team-Status', gruppe: 'Team-Status', keywords: 'online wer ist online benutzer-ordner presence' }]
        : []),
    ],
    render: () => <DatenPanel />,
  });

  // KI-Assistent bewusst als letztes System-Panel (Reihenfolge = Push-Reihenfolge in der Gruppe).
  {
    const sections: SettingsSectionRef[] = [];
    if (isLlmKontextSettingEnabled()) {
      sections.push({ id: 'sec-kontext', label: 'Thinking nutzen', gruppe: 'Antwortverhalten', keywords: 'kontextfenster tokens thinking reasoning ki assistent llm ki-variante agentisch antwortverhalten' });
    }
    // v3.0: Die Browser-KI-Verbindung ist in jeder Variante da (`streamlitBridge`
    // war nirgends aus) — damit ist auch das Panel selbst immer vorhanden.
    sections.push({ id: 'sec-internki', label: 'Verbindung', gruppe: 'Verbindung', keywords: 'browser interne ki lesezeichen verbindung testen gpt bridge ki assistent' });
    if (isDevContext()) {
      sections.push({ id: 'sec-provider', label: 'Provider', gruppe: 'Werkbank (dev)', keywords: 'openrouter endpoint api key modell konfiguration' });
    }
    if (isDevFixturesEnabled()) {
      sections.push({ id: 'sec-aufbereitung-eval', label: 'Aufbereitung: Baustein-Eval', gruppe: 'Werkbank (dev)', keywords: 'eval fixtures goldset aspekte steckbrief precision recall aufbereitung baustein bridge messung' });
      // Der Anker existiert seit v2.256 in AIProviderTab, stand aber nie im
      // Suchindex — als einziger Abschnitt weder auffindbar noch deeplinkbar.
      sections.push({ id: 'sec-gedaechtnis-eval', label: 'Gedächtnis: Eval', gruppe: 'Werkbank (dev)', keywords: 'gedächtnis eval messung konsolidierung fixtures assistent' });
    }
    if (isAntragAufbereitungEnabled()) {
      sections.push({ id: 'sec-aufbereitung-recherche', label: 'Externe Recherche-Ziele', gruppe: 'Externe Recherche-Ziele', keywords: 'deep research recherche url chatgpt claude mistral marktzugang aufbereitung kmu ziel externe' });
    }
    panels.push({
      id: 'ki',
      label: 'Interne KI',
      untertitel: 'Verbindung zur internen KI und wie sie antwortet.',
      icon: Sparkles,
      sections,
      render: () => <KiPanel aiConfig={ctx.aiConfig} setAiConfig={ctx.setAiConfig} />,
    });
  }

  return panels;
}
