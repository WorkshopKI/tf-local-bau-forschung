import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useKeyboardShortcut } from '@/core/hooks/useKeyboard';
import { SettingsNav } from './SettingsNav';
import { getSettingsPanels, buildSearchIndex } from './settingsPanels';
import type { AIProviderConfig } from '@/core/types/config';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const [activePanel, setActivePanel] = useState('profil');
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({ type: 'streamlit', endpoint: 'https://gpt.vdivde-it.de/', model: '', apiKey: '' });

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Nach einem Such-Sprung: Panel wird erst umgeschaltet, das Ziel ist danach
  // (frisch gemountet) im DOM → Scroll+Flash erst im useEffect (rAF).
  const pendingSection = useRef<string | null>(null);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => { if (c) setAiConfig(c); });
  }, [storage]);

  const panels = useMemo(() => getSettingsPanels({ aiConfig, setAiConfig }), [aiConfig]);
  const searchIndex = useMemo(() => buildSearchIndex(panels), [panels]);

  // Aktives Panel darf nach Flag-/Sichtbarkeitswechsel nicht ins Leere zeigen.
  // panels ist nie leer (Profil wird immer eingehängt).
  const active = panels.find(p => p.id === activePanel) ?? panels[0]!;

  // Strg+, fokussiert die Einstellungs-Suche (erscheint dadurch in der Tastatur-Liste).
  useKeyboardShortcut('mod+,', () => searchInputRef.current?.focus(), { description: 'Einstellungen durchsuchen', category: 'Einstellungen' });

  const goToSection = (panelId: string, sectionId: string): void => {
    setActivePanel(panelId);
    pendingSection.current = sectionId;
  };

  // Deep-Link von außerhalb (v2.229, z.B. Widget-Popover „Alle Einstellungen →"):
  // `/einstellungen?sektion=sec-widgets` springt Panel + Anker an. Einmal pro
  // Wert behandeln (Ref), damit spätere Panel-Wechsel nicht zurückgezogen werden.
  const [searchParams] = useSearchParams();
  const behandelteSektion = useRef<string | null>(null);
  useEffect(() => {
    const ziel = searchParams.get('sektion');
    if (!ziel || behandelteSektion.current === ziel) return;
    const panel = panels.find(p => p.sections.some(s => s.id === ziel));
    if (!panel) return;
    behandelteSektion.current = ziel;
    if (panel.id === activePanel) {
      // Scroll-Effekt unten feuert nur bei Panel-WECHSEL — hier direkt scrollen.
      requestAnimationFrame(() => {
        document.getElementById(ziel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      setActivePanel(panel.id);
      pendingSection.current = ziel;
    }
  }, [searchParams, panels, activePanel]);

  useEffect(() => {
    const id = pendingSection.current;
    if (!id) return;
    pendingSection.current = null;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('tf-settings-flash');
      void el.offsetWidth; // Reflow → Animation startet auch bei erneutem Sprung neu
      el.classList.add('tf-settings-flash');
      window.setTimeout(() => el.classList.remove('tf-settings-flash'), 1900);
    });
  }, [activePanel]);

  return (
    <div className="px-8 pt-4 pb-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Einstellungen</h1>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="einstellungen" /></div>
      </div>

      <div className="grid grid-cols-[224px_1fr] items-start gap-0">
        <SettingsNav
          panels={panels}
          activePanel={active.id}
          onSelectPanel={setActivePanel}
          searchIndex={searchIndex}
          onGoToSection={goToSection}
          searchInputRef={searchInputRef}
        />
        <div className="pl-7 min-w-0">
          {active.render()}
        </div>
      </div>
    </div>
  );
}
