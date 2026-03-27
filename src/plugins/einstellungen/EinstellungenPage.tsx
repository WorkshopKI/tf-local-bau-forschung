import { useState, useEffect, useCallback } from 'react';
import { Check, FolderOpen, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { Tabs, Button, Badge, SectionHeader } from '@/ui';
import { PRESET_COLORS, applyThemeColor, setDarkMode, isDarkMode } from '@/ui/theme';
import { useStorage } from '@/core/hooks/useStorage';
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

const TABS = [
  { id: 'profil', label: 'Profil' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'ai', label: 'AI-Provider' },
  { id: 'speicher', label: 'Speicher' },
];

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const [activeTab, setActiveTab] = useState('profil');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dark, setDark] = useState(isDarkMode());
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({ type: 'streamlit', endpoint: 'http://localhost:8501', model: '', apiKey: '' });

  useEffect(() => {
    storage.idb.get<UserProfile>('profile').then(p => { if (p) setProfile(p); });
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => { if (c) setAiConfig(c); });
  }, [storage]);

  const saveProfile = useCallback(async (updated: UserProfile) => {
    setProfile(updated);
    await storage.idb.set('profile', updated);
  }, [storage]);

  const handleColorChange = (h: number, s?: string): void => {
    applyThemeColor(h, s);
    if (profile) saveProfile({ ...profile, theme: { ...profile.theme, hue: h } });
  };

  const handleDarkToggle = (): void => {
    const next = !dark;
    setDark(next);
    setDarkMode(next);
    if (profile) saveProfile({ ...profile, theme: { ...profile.theme, dark: next } });
  };

  const initials = profile?.name ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Einstellungen</h1>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'profil' && profile && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--tf-text)] flex items-center justify-center text-[var(--tf-bg)] text-lg font-medium">{initials}</div>
              <div>
                <p className="text-[14px] font-medium text-[var(--tf-text)]">{profile.name}</p>
                <p className="text-[12px] text-[var(--tf-text-secondary)]">{profile.department}</p>
              </div>
            </div>
            <SectionHeader label="Profil bearbeiten" />
            <div className="grid gap-4 sm:grid-cols-2 mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Name</label>
                <input value={profile.name} onChange={e => saveProfile({ ...profile, name: e.target.value })} className={inputClass} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Abteilung</label>
                <select value={profile.department} onChange={e => saveProfile({ ...profile, department: e.target.value as UserProfile['department'] })} className={inputClass} style={inputStyle}>
                  <option value="bauantraege">Bauanträge</option>
                  <option value="forschung">Forschung</option>
                  <option value="beide">Beide</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'darstellung' && (
          <div className="space-y-6">
            <div>
              <SectionHeader label="Primärfarbe" />
              <div className="flex gap-2.5 mt-3">
                {PRESET_COLORS.map(c => (
                  <button key={c.name} onClick={() => handleColorChange(c.h, c.s)}
                    className="w-[44px] h-[44px] rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: `hsl(${c.h}, ${c.s ?? '83%'}, 53%)`, border: (profile?.theme.hue ?? 221) === c.h ? '2px solid var(--tf-text)' : '2px solid transparent' }}
                    title={c.name}>
                    {(profile?.theme.hue ?? 221) === c.h && <Check size={18} className="text-white" />}
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
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <SectionHeader label="Provider auswählen" />
            {([['streamlit', 'Streamlit Bridge'], ['llama-local', 'llama.cpp (lokal)'], ['cloud', 'Cloud API']] as const).map(([type, label]) => (
              <label key={type} className="flex items-center gap-3 py-2 cursor-pointer" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                <input type="radio" name="ai-provider" checked={aiConfig.type === type}
                  onChange={() => { const c = { ...aiConfig, type }; setAiConfig(c); storage.idb.set('ai-provider', c); }}
                  className="accent-[var(--tf-text)]" />
                <span className="text-[13px] text-[var(--tf-text)]">{label}</span>
                {aiConfig.type === type && <Badge variant="info">Aktiv</Badge>}
              </label>
            ))}
            <SectionHeader label="Konfiguration" />
            <div className="space-y-3 mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Endpoint</label>
                <input value={aiConfig.endpoint} onChange={e => { const c = { ...aiConfig, endpoint: e.target.value }; setAiConfig(c); storage.idb.set('ai-provider', c); }} className={inputClass} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Model</label>
                <input value={aiConfig.model} onChange={e => { const c = { ...aiConfig, model: e.target.value }; setAiConfig(c); storage.idb.set('ai-provider', c); }} className={inputClass} style={inputStyle} />
              </div>
              <Button variant="secondary" onClick={() => alert('Nicht implementiert')}>Testen</Button>
            </div>
          </div>
        )}

        {activeTab === 'speicher' && <SpeicherTab />}
      </div>
    </div>
  );
}

function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const [connected, setConnected] = useState(storage.isFileServerConnected());

  return (
    <div className="space-y-4">
      <SectionHeader label="File Server" />
      <div className="flex items-center gap-3 mt-3">
        {connected ? <Wifi size={18} className="text-[var(--tf-success-text)]" /> : <WifiOff size={18} className="text-[var(--tf-text-tertiary)]" />}
        <div>
          <p className="text-[13px] font-medium text-[var(--tf-text)]">{connected ? 'Verbunden' : 'Nicht verbunden'}</p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">{connected ? 'Vorgänge werden auf dem File Server gespeichert' : 'Nur lokaler Speicher (IndexedDB)'}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" icon={FolderOpen} onClick={async () => { const ok = await storage.connectFileServer(); setConnected(ok); }}>
          {connected ? 'Verzeichnis wechseln' : 'Verzeichnis wählen'}
        </Button>
        {connected && <Button variant="ghost" onClick={async () => { await storage.disconnectFileServer(); setConnected(false); }}>Trennen</Button>}
      </div>
    </div>
  );
}
