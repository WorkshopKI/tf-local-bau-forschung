import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKeyboardShortcut } from '@/core/hooks/useKeyboard';
import { SettingsNav } from './SettingsNav';
import { getSettingsPanels, buildSearchIndex } from './settingsPanels';
import type { AIProviderConfig } from '@/core/types/config';

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
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Einstellungen</h1>

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
