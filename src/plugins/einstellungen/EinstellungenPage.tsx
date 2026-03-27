import { useState, useEffect, useCallback } from 'react';
import { Check, FolderOpen, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { Tabs, Button, Badge, Card } from '@/ui';
import { PRESET_COLORS, applyThemeColor, setDarkMode, isDarkMode } from '@/ui/theme';
import { useStorage } from '@/core/hooks/useStorage';
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

const TABS = [
  { id: 'profil', label: 'Profil' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'ai', label: 'AI-Provider' },
  { id: 'speicher', label: 'Speicher' },
];

export function EinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const [activeTab, setActiveTab] = useState('profil');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dark, setDark] = useState(isDarkMode());
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    type: 'streamlit', endpoint: 'http://localhost:8501', model: '', apiKey: '',
  });

  useEffect(() => {
    storage.idb.get<UserProfile>('profile').then(p => { if (p) setProfile(p); });
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => { if (c) setAiConfig(c); });
  }, [storage]);

  const saveProfile = useCallback(async (updated: UserProfile) => {
    setProfile(updated);
    await storage.idb.set('profile', updated);
  }, [storage]);

  const handleNameChange = (name: string): void => {
    if (profile) saveProfile({ ...profile, name });
  };

  const handleDeptChange = (dept: string): void => {
    if (profile) saveProfile({ ...profile, department: dept as UserProfile['department'] });
  };

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

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-[var(--tf-text)] mb-6">Einstellungen</h1>
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'profil' && profile && (
          <ProfilTab profile={profile} initials={initials} onNameChange={handleNameChange} onDeptChange={handleDeptChange} />
        )}
        {activeTab === 'darstellung' && (
          <DarstellungTab selectedHue={profile?.theme.hue ?? 221} dark={dark} onColorChange={handleColorChange} onDarkToggle={handleDarkToggle} />
        )}
        {activeTab === 'ai' && (
          <AITab config={aiConfig} onChange={c => { setAiConfig(c); storage.idb.set('ai-provider', c); }} />
        )}
        {activeTab === 'speicher' && <SpeicherTab />}
      </div>
    </div>
  );
}

function ProfilTab({ profile, initials, onNameChange, onDeptChange }: {
  profile: UserProfile; initials: string;
  onNameChange: (n: string) => void; onDeptChange: (d: string) => void;
}): React.ReactElement {
  return (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--tf-primary)] flex items-center justify-center text-white text-xl font-bold">
          {initials}
        </div>
        <div>
          <p className="font-medium text-[var(--tf-text)]">{profile.name}</p>
          <p className="text-sm text-[var(--tf-text-secondary)]">{profile.department}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Name</label>
          <input value={profile.name} onChange={e => onNameChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Abteilung</label>
          <select value={profile.department} onChange={e => onDeptChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]">
            <option value="bauantraege">Bauanträge</option>
            <option value="forschung">Forschung</option>
            <option value="beide">Beide</option>
          </select>
        </div>
      </div>
    </Card>
  );
}

function DarstellungTab({ selectedHue, dark, onColorChange, onDarkToggle }: {
  selectedHue: number; dark: boolean; onColorChange: (h: number, s?: string) => void; onDarkToggle: () => void;
}): React.ReactElement {
  return (
    <Card>
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-[var(--tf-text)] block mb-3">Primärfarbe</label>
          <div className="flex gap-3">
            {PRESET_COLORS.map(c => (
              <button key={c.name} onClick={() => onColorChange(c.h, c.s)}
                className="w-[50px] h-[50px] rounded-full border-2 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                style={{ backgroundColor: `hsl(${c.h}, ${c.s ?? '83%'}, 53%)`, borderColor: selectedHue === c.h ? 'var(--tf-text)' : 'transparent' }}
                title={c.name}>
                {selectedHue === c.h && <Check size={20} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--tf-text)]">Dark Mode</span>
          <button onClick={onDarkToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--tf-radius-sm)] border border-[var(--tf-border)] hover:bg-[var(--tf-hover)] cursor-pointer text-sm text-[var(--tf-text)]">
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            {dark ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>
    </Card>
  );
}

function AITab({ config, onChange }: {
  config: AIProviderConfig; onChange: (c: AIProviderConfig) => void;
}): React.ReactElement {
  const providers: Array<{ type: AIProviderConfig['type']; label: string }> = [
    { type: 'streamlit', label: 'Streamlit Bridge' },
    { type: 'llama-local', label: 'llama.cpp (lokal)' },
    { type: 'cloud', label: 'Cloud API' },
  ];
  return (
    <Card>
      <div className="space-y-4">
        {providers.map(p => (
          <label key={p.type} className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="ai-provider" checked={config.type === p.type}
              onChange={() => onChange({ ...config, type: p.type })}
              className="accent-[var(--tf-primary)]" />
            <span className="text-sm text-[var(--tf-text)]">{p.label}</span>
            {config.type === p.type && <Badge variant="info">Aktiv</Badge>}
          </label>
        ))}
        <div className="border-t border-[var(--tf-border)] pt-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--tf-text)]">Endpoint</label>
            <input value={config.endpoint} onChange={e => onChange({ ...config, endpoint: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--tf-text)]">Model</label>
            <input value={config.model} onChange={e => onChange({ ...config, model: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]" />
          </div>
          <Button variant="secondary" onClick={() => alert('Nicht implementiert')}>Testen</Button>
        </div>
      </div>
    </Card>
  );
}

function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const [connected, setConnected] = useState(storage.isFileServerConnected());

  const handleConnect = async (): Promise<void> => {
    const ok = await storage.connectFileServer();
    setConnected(ok);
  };

  const handleDisconnect = async (): Promise<void> => {
    await storage.disconnectFileServer();
    setConnected(false);
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {connected ? <Wifi size={20} className="text-green-600" /> : <WifiOff size={20} className="text-[var(--tf-text-secondary)]" />}
          <div>
            <p className="text-sm font-medium text-[var(--tf-text)]">
              File Server: {connected ? 'Verbunden' : 'Nicht verbunden'}
            </p>
            <p className="text-xs text-[var(--tf-text-secondary)]">
              {connected ? 'Vorgänge werden auf dem File Server gespeichert' : 'Nur lokaler Speicher (IndexedDB)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={FolderOpen} onClick={handleConnect}>
            {connected ? 'Verzeichnis wechseln' : 'Verzeichnis wählen'}
          </Button>
          {connected && (
            <Button variant="ghost" onClick={handleDisconnect}>Trennen</Button>
          )}
        </div>
      </div>
    </Card>
  );
}
