import { useMemo } from 'react';
import { SettingsHubPage } from '@/components/settings';
import { KuratorGesperrtHinweis } from '@/components/kurator';
import { getKurationPanels, KURATION_SEITENNAME } from './kurationPanels';

/**
 * Der Kuration-Hub — dieselbe Seitenform wie die Einstellungen (Rahmen,
 * Navigationsspalte, Suche, Sprungmarke liegen in `@/components/settings`).
 *
 * Die Panels sind flag-abhaengig, aber nicht zustandsabhaengig; ein `useMemo`
 * ohne Abhaengigkeiten reicht, damit `SettingsHubPage` nicht bei jedem Render
 * einen neuen Suchindex baut.
 *
 * Der Sperr-Hinweis steht EINMAL hier, nicht in den Panels: die ganze Seite ist
 * eine Schreib-Flaeche, und die Sitzung gilt fuer alle Panels gleich.
 */
export function KurationPage(): React.ReactElement {
  const panels = useMemo(() => getKurationPanels(), []);
  return (
    <SettingsHubPage
      titel={KURATION_SEITENNAME}
      pluginId="kuration"
      panels={panels}
      hinweis={
        <KuratorGesperrtHinweis
          was="Quellen, Programme und Einstellungen"
          nachsatz="Der Suchindex bleibt baubar — er liegt auf diesem Gerät, nicht auf dem Daten-Share."
        />
      }
    />
  );
}
