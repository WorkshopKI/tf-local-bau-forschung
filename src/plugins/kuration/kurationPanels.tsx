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
import { LayoutDashboard, Plug } from 'lucide-react';
import type { SettingsPanel } from '@/components/settings';
import { features } from '@/config/feature-flags';
import { UebersichtPanel } from './uebersicht/UebersichtPanel';
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
