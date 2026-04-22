import { useState } from 'react';
import { Check, FolderOpen, ArrowRight, FlaskConical } from 'lucide-react';
import { Button } from '@/ui';
import { PRESET_COLORS, applyThemeColor } from '@/ui/theme';
import type { UserProfile } from '@/core/types/config';
import { useStorage } from '@/core/hooks/useStorage';
import { shouldShowOpfsOption } from '@/core/utils/environment';
import { isAntraegeEnabled, isBauantraegeEnabled, menuLabel } from '@/config/feature-flags';

interface OnboardingProps {
  onComplete: () => void;
}

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function Onboarding({ onComplete }: OnboardingProps): React.ReactElement {
  const storage = useStorage();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const defaultDept: UserProfile['department'] =
    isAntraegeEnabled() && isBauantraegeEnabled() ? 'beide'
    : isAntraegeEnabled() ? 'antraege'
    : 'bauantraege';
  const [department, setDepartment] = useState<UserProfile['department']>(defaultDept);
  const [isKurator, setIsKurator] = useState(false);
  const [selectedHue, setSelectedHue] = useState(221);
  const [selectedSat, setSelectedSat] = useState('25%');
  const [selectedLit, setSelectedLit] = useState('42%');
  const [fsConnected, setFsConnected] = useState(false);
  const [fsName, setFsName] = useState('');

  const handleColorSelect = (h: number, s: string, l: string): void => {
    setSelectedHue(h);
    setSelectedSat(s);
    setSelectedLit(l);
    applyThemeColor(h, s, l);
  };

  const handleConnectFs = async (): Promise<void> => {
    const ok = await storage.connectFileServer();
    if (ok) {
      setFsConnected(true);
      setFsName(storage.getFileServerName() ?? '');
    }
  };

  const handleConnectOpfs = async (): Promise<void> => {
    const entry = await storage.addOPFSDirectory('data', 'Daten (Sandbox)');
    if (entry) {
      setFsConnected(true);
      setFsName('OPFS-Sandbox');
    }
  };

  const showOpfs = shouldShowOpfsOption();

  const handleFinish = async (): Promise<void> => {
    const profile: UserProfile = { name, department, theme: { hue: selectedHue, dark: false }, is_kurator: isKurator };
    await storage.idb.set('profile', profile);
    await storage.idb.set('onboarding-complete', true);
    applyThemeColor(selectedHue, selectedSat, selectedLit);
    onComplete();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div className="w-full max-w-[400px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8" style={{ border: '0.5px solid var(--tf-border)' }}>
        {step === 0 && (
          <div className="space-y-6">
            <h1 className="text-[20px] font-medium text-[var(--tf-text)] text-center">Willkommen bei TeamFlow</h1>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Dein Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" className={inputClass} style={inputStyle} />
              </div>
              {isAntraegeEnabled() && isBauantraegeEnabled() && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--tf-text)]">Abteilung</label>
                  <select value={department} onChange={e => setDepartment(e.target.value as UserProfile['department'])} className={inputClass} style={inputStyle}>
                    <option value="antraege">{menuLabel('antraege', 'Förderanträge')}</option>
                    <option value="bauantraege">{menuLabel('bauantraege', 'Bauanträge')}</option>
                    <option value="beide">Beide</option>
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Farbe</label>
                <div className="flex gap-2.5 justify-center">
                  {PRESET_COLORS.map(c => (
                    <button key={c.name} onClick={() => handleColorSelect(c.h, c.s, c.l)}
                      className="w-[44px] h-[44px] rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        backgroundColor: `hsl(${c.h}, ${c.s}, ${c.l})`,
                        border: selectedHue === c.h ? '2px solid var(--tf-text)' : '2px solid transparent',
                      }}
                      title={c.name}>
                      {selectedHue === c.h && <Check size={18} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isKurator}
                  onChange={e => setIsKurator(e.target.checked)}
                  className="mt-0.5 cursor-pointer accent-[var(--tf-primary)]"
                />
                <span className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug">
                  Ich bin Kurator dieses TeamFlow-Projekts (zeigt zusätzliche Kuration-Bereiche an)
                </span>
              </label>
            </div>
            <Button icon={ArrowRight} disabled={!name.trim()} onClick={() => setStep(1)} className="w-full">Weiter</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-[20px] font-medium text-[var(--tf-text)] text-center">Datenverzeichnis</h1>
            <p className="text-[13px] text-[var(--tf-text-secondary)] text-center">
              TeamFlow speichert Vorgänge und Dokumente auf eurem File Server.
            </p>
            <div className="flex flex-col items-center gap-3 py-4">
              <Button icon={FolderOpen} variant="secondary" onClick={handleConnectFs}>Verzeichnis wählen</Button>
              {showOpfs && (
                <>
                  <Button icon={FlaskConical} variant="ghost" onClick={handleConnectOpfs}>OPFS-Sandbox verwenden (Tests/Preview)</Button>
                  <p className="text-[11px] text-[var(--tf-text-tertiary)] text-center max-w-[280px]">
                    Lokaler Browser-Storage — kein Sharing zwischen Browsern oder Geräten. Nur für Dev/Preview-Tests.
                  </p>
                </>
              )}
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">{fsConnected ? `Verbunden: ${fsName}` : 'Kein Verzeichnis gewählt'}</p>
            </div>
            <button onClick={() => setStep(2)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer block mx-auto">
              Ohne File Server starten →
            </button>
            <Button icon={ArrowRight} onClick={() => setStep(2)} className="w-full mt-2">Weiter</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--tf-success-bg)] flex items-center justify-center mx-auto">
              <Check size={28} className="text-[var(--tf-success-text)]" />
            </div>
            <h1 className="text-[20px] font-medium text-[var(--tf-text)]">Alles eingerichtet</h1>
            <div className="text-[13px] text-[var(--tf-text-secondary)] space-y-1.5">
              <p><span className="text-[var(--tf-text-tertiary)]">Name:</span> {name}</p>
              <p><span className="text-[var(--tf-text-tertiary)]">Abteilung:</span> {department === 'bauantraege' ? menuLabel('bauantraege', 'Bauanträge') : department === 'antraege' ? menuLabel('antraege', 'Förderanträge') : 'Beide'}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[var(--tf-text-tertiary)]">Farbe:</span>
                <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: `hsl(${selectedHue}, ${selectedSat}, ${selectedLit})` }} />
              </div>
              <p><span className="text-[var(--tf-text-tertiary)]">File Server:</span> {fsConnected ? fsName : 'Nicht verbunden'}</p>
            </div>
            <Button icon={ArrowRight} onClick={handleFinish} className="w-full">Los geht's</Button>
          </div>
        )}

        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[var(--tf-text)]' : 'bg-[var(--tf-border)]'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
