import { useState } from 'react';
import { Check, FolderOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/ui';
import { PRESET_COLORS, applyThemeColor } from '@/ui/theme';
import type { UserProfile } from '@/core/types/config';
import { useStorage } from '@/core/hooks/useStorage';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps): React.ReactElement {
  const storage = useStorage();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<UserProfile['department']>('bauantraege');
  const [selectedHue, setSelectedHue] = useState(221);
  const [selectedSaturation, setSelectedSaturation] = useState<string | undefined>();
  const [fsConnected, setFsConnected] = useState(false);
  const [fsName, setFsName] = useState('');

  const handleColorSelect = (h: number, s?: string): void => {
    setSelectedHue(h);
    setSelectedSaturation(s);
    applyThemeColor(h, s);
  };

  const handleConnectFs = async (): Promise<void> => {
    const ok = await storage.connectFileServer();
    if (ok) {
      setFsConnected(true);
      setFsName('Verbunden');
    }
  };

  const handleFinish = async (): Promise<void> => {
    const profile: UserProfile = {
      name,
      department,
      theme: { hue: selectedHue, dark: false },
    };
    await storage.idb.set('profile', profile);
    await storage.idb.set('onboarding-complete', true);
    applyThemeColor(selectedHue, selectedSaturation);
    onComplete();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div className="w-full max-w-lg mx-4 bg-[var(--tf-bg)] border border-[var(--tf-border)] rounded-[var(--tf-radius)] shadow-xl p-8">
        {step === 0 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--tf-text)]">Willkommen bei TeamFlow!</h1>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--tf-text)]">Dein Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--tf-text)]">Abteilung</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value as UserProfile['department'])}
                  className="w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]"
                >
                  <option value="bauantraege">Bauanträge</option>
                  <option value="forschung">Forschung</option>
                  <option value="beide">Beide</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--tf-text)]">Farbe</label>
                <div className="flex gap-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => handleColorSelect(c.h, c.s)}
                      className="w-[50px] h-[50px] rounded-full border-2 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        backgroundColor: `hsl(${c.h}, ${c.s ?? '83%'}, 53%)`,
                        borderColor: selectedHue === c.h ? 'var(--tf-text)' : 'transparent',
                      }}
                      title={c.name}
                    >
                      {selectedHue === c.h && <Check size={20} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button icon={ArrowRight} disabled={!name.trim()} onClick={() => setStep(1)} className="w-full">
              Weiter
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--tf-text)]">Datenverzeichnis</h1>
            <p className="text-sm text-[var(--tf-text-secondary)]">
              TeamFlow speichert Vorgänge und Dokumente auf eurem File Server.
            </p>
            <div className="flex flex-col items-center gap-4 py-4">
              <Button icon={FolderOpen} variant="secondary" onClick={handleConnectFs}>
                Verzeichnis wählen
              </Button>
              <p className="text-sm text-[var(--tf-text-secondary)]">
                {fsConnected ? fsName : 'Kein Verzeichnis gewählt'}
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-[var(--tf-primary)] hover:underline cursor-pointer"
            >
              Ohne File Server starten →
            </button>
            <Button icon={ArrowRight} onClick={() => setStep(2)} className="w-full mt-2">
              Weiter
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--tf-text)]">Alles eingerichtet!</h1>
            <div className="text-sm text-[var(--tf-text-secondary)] space-y-2">
              <p><strong>Name:</strong> {name}</p>
              <p><strong>Abteilung:</strong> {department === 'bauantraege' ? 'Bauanträge' : department === 'forschung' ? 'Forschung' : 'Beide'}</p>
              <div className="flex items-center justify-center gap-2">
                <strong>Farbe:</strong>
                <span
                  className="w-5 h-5 rounded-full inline-block"
                  style={{ backgroundColor: `hsl(${selectedHue}, ${selectedSaturation ?? '83%'}, 53%)` }}
                />
              </div>
              <p><strong>File Server:</strong> {fsConnected ? 'Verbunden' : 'Nicht verbunden'}</p>
            </div>
            <Button icon={ArrowRight} onClick={handleFinish} className="w-full">
              Los geht's
            </Button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-[var(--tf-primary)]' : 'bg-[var(--tf-border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
