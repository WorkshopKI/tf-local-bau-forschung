import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { SettingsHubPage } from '@/components/settings';
import { getSettingsPanels } from './settingsPanels';
import type { AIProviderConfig } from '@/core/types/config';

/**
 * Die Einstellungen sind ein Hub in der Einstellungs-Seitenform: Rahmen,
 * Navigationsspalte, Suche und Sprungmarke liegen seit v4.33 in
 * `@/components/settings` — hier bleibt nur, was einstellungs-eigen ist: die
 * KI-Provider-Konfiguration, die zwei Gruppen im Panel „Interne KI" teilen.
 */
export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({ type: 'streamlit', endpoint: 'https://gpt.vdivde-it.de/', model: '', apiKey: '' });

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => { if (c) setAiConfig(c); });
  }, [storage]);

  const panels = useMemo(() => getSettingsPanels({ aiConfig, setAiConfig }), [aiConfig]);

  return <SettingsHubPage titel="Einstellungen" pluginId="einstellungen" panels={panels} />;
}
