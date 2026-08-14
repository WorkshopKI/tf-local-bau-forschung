/**
 * Panel- & Such-Registry des Kuration-Hubs — dieselbe Rolle, die
 * `settingsPanels.tsx` fuer die Einstellungen spielt: Single Source of Truth
 * fuer die Navigationsspalte UND den Suchindex.
 *
 * Bis v4.33 war jede dieser Seiten ein eigener Sidebar-Eintrag. Neun flache
 * Eintraege am Sidebar-Fuss, neun Seitenformen, kein Ort, der den Zustand
 * zusammenfasst — das Redesign zieht sie hier zusammen (siehe
 * `docs/feedback-kontext/kuration.md`).
 *
 * Sichtbarkeit folgt den Feature-Flags; der Suchindex leitet sich aus den
 * sichtbaren Abschnitten ab und respektiert sie dadurch automatisch.
 */
import { Database, FolderTree, LayoutDashboard, Plug, Search } from 'lucide-react';
import type { SettingsPanel } from '@/components/settings';
import { features } from '@/config/feature-flags';
import { UebersichtPanel } from './uebersicht/UebersichtPanel';
import { CsvQuellenPanel } from './csv-quellen/CsvQuellenPanel';
import { VerzeichnissePanel } from './verzeichnisse/VerzeichnissePanel';
import { SucheIndexPanel } from './suche-index/SucheIndexPanel';
import { DienstePanel } from './dienste/DienstePanel';

export function getKurationPanels(): SettingsPanel[] {
  const panels: SettingsPanel[] = [];

  panels.push({
    id: 'uebersicht',
    label: 'Übersicht',
    untertitel: 'Was gerade ansteht und wie die Daten stehen.',
    icon: LayoutDashboard,
    sections: [
      { id: 'sec-lage', label: 'Zu tun', gruppe: 'Zu tun', keywords: 'lage überblick status ampel aufgaben dashboard start' },
      { id: 'sec-lage-index', label: 'Suchindex', gruppe: 'Zu tun', keywords: 'index suche embedding indexieren orama modell dokumente' },
      { id: 'sec-lage-csv', label: 'CSV-Datenimport', gruppe: 'Zu tun', keywords: 'csv import export fördertabelle quellen frische aktualisieren' },
      ...(features.dokumentenscan
        ? [{ id: 'sec-lage-review', label: 'Dokument-Prüfung', gruppe: 'Zu tun', keywords: 'review triage warteschlange dms dokumente prüfen klassifizierung' }]
        : []),
      { id: 'sec-sitzung', label: 'Kurator-Sitzung', gruppe: 'Kurator-Sitzung', keywords: 'sitzung session freischaltung sperren anmelden ttl restlaufzeit kurator' },
    ],
    render: () => <UebersichtPanel />,
  });

  // Der Datenzufluss steht vor der Ordnung und der Auffindbarkeit — die
  // Navigationsspalte liest sich als Weg, den die Daten nehmen.
  // Bis v4.36 die eigene Seite „CSV-Quellen".
  panels.push({
    id: 'csv-quellen',
    label: 'CSV-Quellen',
    untertitel: 'Woher die Antragsdaten kommen und wie frisch sie sind.',
    icon: Database,
    sections: [
      { id: 'sec-csv-quellen', label: 'Registrierte Quellen', gruppe: 'Registrierte Quellen', keywords: 'csv quelle schema import export fördertabelle registrieren wizard mapping spalten datei sources' },
      { id: 'sec-csv-zustand', label: 'Zustand', gruppe: 'Zustand', keywords: 'frische letzter import zeilen aktualisieren ampel auto-refresh' },
      { id: 'sec-csv-wartung', label: 'Antrags-Daten zurücksetzen', gruppe: 'Selten gebraucht', keywords: 'reset löschen encoding umlaute wartung zurücksetzen neu einspielen' },
      { id: 'sec-csv-wiederherstellen', label: 'CSV-Schemas wiederherstellen', gruppe: 'Selten gebraucht', keywords: 'recovery jsonl snapshot wiederherstellen schemas verschwunden backup' },
    ],
    render: () => <CsvQuellenPanel />,
  });

  // Bis v4.35 zwei eigene Seiten („Programme", „Filter verwalten"). Beide alten
  // Seitennamen bleiben als Suchbegriffe.
  panels.push({
    id: 'verzeichnisse',
    label: 'Verzeichnisse',
    untertitel: 'Die Ordnung, in der die importierten Daten stehen.',
    icon: FolderTree,
    sections: [
      { id: 'sec-programme', label: 'Programme', gruppe: 'Programme', keywords: 'programm förderprogramm zim exist anlegen umbenennen löschen aktiv wechseln scope' },
      { id: 'sec-unterprogramme', label: 'Unterprogramme', gruppe: 'Unterprogramme', keywords: 'unterprogramm modul label zeitraum aktiv xlsx import codes' },
      { id: 'sec-filter', label: 'Filter verwalten', gruppe: 'Filter', keywords: 'filter facette sidebar antragsliste verwalten anlegen' },
      { id: 'sec-filter-kurator', label: 'Kurator-Filter', gruppe: 'Filter', keywords: 'custom eigene filter team anlegen bearbeiten reihenfolge' },
      { id: 'sec-filter-system', label: 'System-Filter', gruppe: 'Filter', keywords: 'eingebaut system versteckt ausblenden read-only' },
      { id: 'sec-filter-nutzer', label: 'Nutzer-Vorlagen', gruppe: 'Filter', keywords: 'preset user vorlage privat gespeichert kombination' },
    ],
    render: () => <VerzeichnissePanel />,
  });

  // Bis v4.34 die eigene Seite „Suchindex" mit den Reitern „Übersicht" und
  // „Verwaltung". Der alte Seitenname bleibt als Suchbegriff.
  panels.push({
    id: 'suche-index',
    label: 'Suche & Index',
    untertitel: 'Was durchsuchbar ist — und wie gut.',
    icon: Search,
    sections: [
      { id: 'sec-index', label: 'Index pflegen', gruppe: 'Index pflegen', keywords: 'suchindex index indexieren orama embedding bulk-scan dokumente einlesen aufbauen verwaltung' },
      { id: 'sec-index-zustand', label: 'Zustand', gruppe: 'Zustand', keywords: 'status kennzahlen textabschnitte dokumente qualität modell backend webgpu übersicht' },
      ...(features.dokumentenscan
        ? [{ id: 'sec-dokumentenquellen', label: 'Dokumentenquellen', gruppe: 'Dokumentenquellen', keywords: 'dms quellen ordner pfade smb aktivieren indexieren triage scan verzeichnisse' }]
        : []),
      { id: 'sec-index-erweitert', label: 'Modelle, Suchqualität, Zurücksetzen', gruppe: 'Selten gebraucht', keywords: 'modell wechseln metadata llm eval smoke-test zurücksetzen seed konfiguration pipeline' },
      { id: 'sec-embedding-korpus', label: 'Embedding-Korpus', gruppe: 'Selten gebraucht', keywords: 'korpus centroid auslastung stage 2 matching spiegel' },
    ],
    render: () => <SucheIndexPanel />,
  });

  // Bis v4.33 der eigene Menuepunkt „E-Mail Anfragen: Einstellungen".
  // Der alte Name bleibt als Suchbegriff, sonst faende ihn niemand mehr,
  // der ihn im Kopf hat.
  if (features.anfragen) {
    panels.push({
      id: 'dienste',
      label: 'Dienste',
      untertitel: 'Externe Gegenstellen, die das Team gemeinsam nutzt.',
      icon: Plug,
      sections: [
        { id: 'sec-anfragen', label: 'ZIM FAQ-Assistent', gruppe: 'ZIM FAQ-Assistent', keywords: 'anfragen e-mail msg zim faq assistent dashboard extern gegenstelle einstellungen' },
        { id: 'sec-anfragen-url', label: 'URL des Assistenten', gruppe: 'ZIM FAQ-Assistent', keywords: 'url adresse artifact claude dashboard link anfragen' },
      ],
      render: () => <DienstePanel />,
    });
  }

  return panels;
}
