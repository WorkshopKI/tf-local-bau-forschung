import { useState, useEffect } from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import { Tabs, Badge, SectionHeader } from '@/ui';
import { PRESET_COLORS, applyThemeColor, setDarkMode, isDarkMode } from '@/ui/theme';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { TagsTab } from './TagsTab';
import { TastaturTab } from './TastaturTab';
import { AIProviderTab } from './AIProviderTab';
import { SpeicherTab } from './SpeicherTab';
import { isKuratorMenusEnabled, isAntraegeEnabled, isBauantraegeEnabled, menuLabel } from '@/config/feature-flags';
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

const TABS = [
  { id: 'profil', label: 'Profil' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'speicher', label: 'Speicher' },
  { id: 'tags', label: 'Tags' },
  { id: 'tastatur', label: 'Tastatur' },
  { id: 'ai', label: 'KI-Assistent' },
];

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

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

  const initials = profile?.name ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Einstellungen</h1>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'profil' && !profile && (
          <div className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
            Kein Profil geladen. Bitte App-Storage leeren und Onboarding neu durchlaufen.
          </div>
        )}
        {activeTab === 'profil' && profile && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--tf-primary)] flex items-center justify-center text-white text-lg font-medium">{initials}</div>
              <div>
                <p className="text-[14px] font-medium text-[var(--tf-text)]">{profile.name}</p>
                <p className="text-[12px] text-[var(--tf-text-secondary)]">
                  {profile.department === 'antraege' ? menuLabel('antraege', 'Förderanträge')
                    : profile.department === 'bauantraege' ? menuLabel('bauantraege', 'Bauanträge')
                    : 'Beide'}
                </p>
              </div>
            </div>
            <SectionHeader label="Profil bearbeiten" />
            <div className="grid gap-4 sm:grid-cols-2 mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Name</label>
                <input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} className={inputClass} style={inputStyle} />
              </div>
              {(() => {
                const opts: Array<{ value: UserProfile['department']; label: string }> = [];
                if (isAntraegeEnabled()) opts.push({ value: 'antraege', label: menuLabel('antraege', 'Förderanträge') });
                if (isBauantraegeEnabled()) opts.push({ value: 'bauantraege', label: menuLabel('bauantraege', 'Bauanträge') });
                if (opts.length >= 2) opts.push({ value: 'beide', label: 'Beide' });
                if (opts.length < 2) return null;
                return (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[var(--tf-text)]">Abteilung</label>
                    <select value={profile.department} onChange={e => updateProfile({ department: e.target.value as UserProfile['department'] })} className={inputClass} style={inputStyle}>
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                );
              })()}
            </div>
            {isKuratorMenusEnabled() && (
              <div className="mt-6">
                <SectionHeader label="Kurator-Funktionen" />
                <label className="flex items-start gap-2.5 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={!!(profile.is_kurator ?? profile.is_admin)}
                    onChange={e => updateProfile({ is_kurator: e.target.checked })}
                    className="mt-0.5 cursor-pointer accent-[var(--tf-primary)]"
                  />
                  <span className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug">
                    Kurator-Bereiche aktivieren (Suchindex, Feedback-Verwaltung)
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

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
        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'tastatur' && <TastaturTab />}
      </div>
    </div>
  );
}
