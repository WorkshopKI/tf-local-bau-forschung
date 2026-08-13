import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useKeyboardShortcut } from '@/core/hooks/useKeyboard';
import { SettingsNav } from './SettingsNav';
import { getSettingsPanels, buildSearchIndex } from './settingsPanels';
import { SettingsSprungProvider, type SettingsSprungZiel } from './_shared/settings-layout';
import type { AIProviderConfig } from '@/core/types/config';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import './einstellungen-layout.css';

export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const [activePanel, setActivePanel] = useState('profil');
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({ type: 'streamlit', endpoint: 'https://gpt.vdivde-it.de/', model: '', apiKey: '' });

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Sprung-Ziel der Suche/Deep-Links. Es steuert ZWEI Dinge: den Scroll+Flash
  // hier und — über den Kontext — das Aufklappen der `SettingsKlappe`, in der
  // das Ziel steckt. Der Zähler macht denselben Treffer wiederholbar.
  const [sprung, setSprung] = useState<SettingsSprungZiel | null>(null);
  const sprungZaehler = useRef(0);

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
    sprungZaehler.current += 1;
    setSprung({ id: sectionId, nr: sprungZaehler.current });
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
    goToSection(panel.id, ziel);
    // `goToSection` ist stabil genug (nur setState + Ref) — als Abhängigkeit
    // würde es den Effekt bei jedem Render neu bewerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, panels]);

  // Scroll + Flash, einen Tick nach dem Panel-Wechsel: erst dann ist das Ziel
  // gemountet. Bewusst `setTimeout` statt `requestAnimationFrame` — rAF ruht,
  // solange das Fenster nicht zeichnet (Hintergrund-Tab), der Sprung liefe
  // dort ins Leere und feuerte später nach. Die Klappe darum öffnet sich in
  // ihrem eigenen Effekt; ihr `<section id>`-Anker steht auch zugeklappt im
  // DOM, der Sprung braucht sie also nicht abzuwarten.
  useEffect(() => {
    if (!sprung) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(sprung.id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('tf-settings-flash');
      void el.offsetWidth; // Reflow → Animation startet auch bei erneutem Sprung neu
      el.classList.add('tf-settings-flash');
      window.setTimeout(() => el.classList.remove('tf-settings-flash'), 1900);
    }, 0);
    return () => window.clearTimeout(t);
  }, [sprung]);

  return (
    <div className="px-8 pt-4 pb-6">
      {/* Kopfzeile über die volle Blattbreite, Rumpf darunter schmal: der
          Hilfe-Knopf steht auf jeder Seite am rechten Blattrand
          (ui-muster.md, Guard `hilfe-knopf-am-blattrand`). */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Einstellungen</h1>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="einstellungen" /></div>
      </div>

      <div className="grid grid-cols-[224px_1fr] items-start gap-0 max-w-[1280px]">
        <SettingsNav
          panels={panels}
          activePanel={active.id}
          onSelectPanel={setActivePanel}
          searchIndex={searchIndex}
          onGoToSection={goToSection}
          searchInputRef={searchInputRef}
        />
        <div className="pl-7 min-w-0">
          <div className="flex items-start gap-4 pb-3.5 mb-3.5 border-b border-[var(--tf-border)]">
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium leading-tight text-[var(--tf-text)]">{active.label}</h2>
              <p className="text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] mt-0.5">
                {active.untertitel}
              </p>
            </div>
          </div>
          <SettingsSprungProvider ziel={sprung}>
            {active.render()}
          </SettingsSprungProvider>
        </div>
      </div>
    </div>
  );
}
