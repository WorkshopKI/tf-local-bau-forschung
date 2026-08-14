import { useMemo } from 'react';
import { SettingsHubPage } from '@/components/settings';
import { getKurationPanels } from './kurationPanels';

/**
 * Der Kuration-Hub — dieselbe Seitenform wie die Einstellungen (Rahmen,
 * Navigationsspalte, Suche, Sprungmarke liegen in `@/components/settings`).
 *
 * Die Panels sind flag-abhaengig, aber nicht zustandsabhaengig; ein `useMemo`
 * ohne Abhaengigkeiten reicht, damit `SettingsHubPage` nicht bei jedem Render
 * einen neuen Suchindex baut.
 */
export function KurationPage(): React.ReactElement {
  const panels = useMemo(() => getKurationPanels(), []);
  return <SettingsHubPage titel="Kuration" pluginId="kuration" panels={panels} />;
}
