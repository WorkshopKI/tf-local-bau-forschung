import { useState, useEffect } from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import { Tabs, Badge, SectionHeader } from '@/ui';
import { PRESET_COLORS, applyThemeColor, setDarkMode, isDarkMode } from '@/ui/theme';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { ProfilTab } from './ProfilTab';
import { TagsTab } from './TagsTab';
import { TastaturTab } from './TastaturTab';
import { AIProviderTab } from './AIProviderTab';
import { SpeicherTab } from './SpeicherTab';
import { DokumentenquellenTab } from './DokumentenquellenTab';
import { MeineTechnologienTab } from './MeineTechnologienTab';
import { isAuslastungEnabled, isDevContext } from '@/config/feature-flags';
import type { AIProviderConfig } from '@/core/types/config';

const TABS: Array<{ id: string; label: string }> = [
  { id: 'profil', label: 'Profil' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'speicher', label: 'Speicher' },
  { id: 'dokumentenquellen', label: 'Dokumentenquellen' },
  { id: 'tags', label: 'Tags' },
  { id: 'tastatur', label: 'Tastatur' },
];
// KI-Assistent-Tab nur im Entwickler-Kontext — in Produktiv-Varianten ist der
// LLM-Endpoint via `ki.localLlama.endpoint` in der Build-Config fix verdrahtet.
if (isDevContext()) {
  TABS.push({ id: 'ai', label: 'KI-Assistent' });
}
if (isAuslastungEnabled()) {
  TABS.splice(1, 0, { id: 'meine-technologien', label: 'Meine Technologien' });
}

export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();
  const [activeTab, setActiveTab] = useState('profil');
  const [dark, setDark] = useState(isDarkMode());
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({ type: 'streamlit', endpoint: 'http://localhost:8501', model: '', apiKey: '' });

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => { if (c) setAiConfig(c); });
  }, [storage]);

  const handleColorChange = (h: number, s: string, l: string): void => {
    applyThemeColor(h, s, l);
    updateProfile({ theme: { ...profile!.theme, hue: h } });
  };

  const handleDarkToggle = (): void => {
    const next = !dark;
    setDark(next);
    setDarkMode(next);
    updateProfile({ theme: { ...profile!.theme, dark: next } });
  };

  return (
    <div className="px-8 pt-4 pb-6 max-w-2xl">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Einstellungen</h1>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'profil' && <ProfilTab />}

        {activeTab === 'darstellung' && (
          <div className="space-y-6">
            <div>
              <SectionHeader label="Primärfarbe" />
              <div className="flex gap-2.5 mt-3">
                {PRESET_COLORS.map(c => (
                  <button key={c.name} onClick={() => handleColorChange(c.h, c.s, c.l)}
                    className="w-[44px] h-[44px] rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: `hsl(${c.h}, ${c.s}, ${c.l})`, border: (profile?.theme.hue ?? 215) === c.h ? '2px solid var(--tf-text)' : '2px solid transparent' }}
                    title={c.name}>
                    {(profile?.theme.hue ?? 215) === c.h && <Check size={18} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader label="Erscheinungsbild" />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[13px] text-[var(--tf-text)]">Dark Mode</span>
                <button onClick={handleDarkToggle}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--tf-radius)] text-[13px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                  style={{ border: '0.5px solid var(--tf-border)' }}>
                  {dark ? <Moon size={14} /> : <Sun size={14} />}
                  {dark ? 'Dark' : 'Light'}
                </button>
              </div>
            </div>
            <div>
              <SectionHeader label="Vorschau" />
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[13px] bg-[var(--tf-primary)] text-white">Akzent-Farbe</span>
                  <span className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[13px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">Akzent Light</span>
                  <Badge variant="info">Info</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="error">Error</Badge>
                </div>
                <p className="text-[13px]"><a href="#" className="text-[var(--tf-primary)] hover:underline" onClick={e => e.preventDefault()}>Link in Primärfarbe</a> — so sehen Links aus</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && <AIProviderTab aiConfig={aiConfig} setAiConfig={setAiConfig} />}

        {activeTab === 'speicher' && <SpeicherTab />}
        {activeTab === 'dokumentenquellen' && <DokumentenquellenTab />}
        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'tastatur' && <TastaturTab />}
        {activeTab === 'meine-technologien' && <MeineTechnologienTab />}
      </div>
    </div>
  );
}
