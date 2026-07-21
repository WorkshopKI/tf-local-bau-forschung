import { useState } from 'react';
import { Check, ArrowRight, FolderOpen, FolderHeart, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRESET_COLORS, applyThemeColor } from '@/components/ui/theme';
import type { UserProfile } from '@/core/types/config';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  isKuratorMenusEnabled,
  isMaLoginEnabled,
} from '@/config/feature-flags';
import { runtimeConfig } from '@/config/runtime-config';
import {
  pickAndStorePersoenlichHandle,
  getPersoenlichHandle,
} from '@/core/services/infrastructure/smb-handle';
import { savePersonalSettings, loadPersonalSettings } from '@/core/services/personal-storage';
import { readProfileFromShare } from '@/core/services/personal-storage/sync';

interface OnboardingProps {
  onComplete: () => void;
}

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

/** 2–6 Großbuchstaben (inkl. Umlaute Ä/Ö/Ü), keine Sonderzeichen — Validierung weich (Feld ist optional). */
function normalizeKuerzel(raw: string): string {
  // NFC vor Regex: Umlaut-Eingaben koennen als NFD (U + Combining-Diaeresis)
  // ankommen; ohne NFC wuerde [^A-ZÄÖÜ] die kombinierende Diaerese strippen und
  // still "U" uebrig lassen. Deckt sich mit anonym-map.ts normalizeKuerzel (Pitfall #22).
  return raw.normalize('NFC').toUpperCase().replace(/[^A-ZÄÖÜ]/g, '').slice(0, 6);
}

export function Onboarding({ onComplete }: OnboardingProps): React.ReactElement {
  const storage = useStorage();
  const promptPersFolder = runtimeConfig.personalFolder?.promptAfterProfile ?? true;
  const totalSteps = promptPersFolder ? 3 : 2;

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kuerzel, setKuerzel] = useState('');
  const [isKurator, setIsKurator] = useState(false);
  const [selectedHue, setSelectedHue] = useState(221);
  const [selectedSat, setSelectedSat] = useState('25%');
  const [selectedLit, setSelectedLit] = useState('42%');
  // Aus einem wiederhergestellten Profil uebernommen; sonst wie bisher false.
  const [dark, setDark] = useState(false);

  // Persoenlich-Ordner Step (nur wenn promptPersFolder)
  const [persConnected, setPersConnected] = useState(false);
  const [persBusy, setPersBusy] = useState(false);
  const [persError, setPersError] = useState<string | null>(null);
  const [nichtsGefunden, setNichtsGefunden] = useState(false);

  const showKuratorToggle = isKuratorMenusEnabled();
  // Im MA-Login-Modus (prod/dev) wird das Kuerzel aus dem Passwort abgeleitet
  // (MaLoginGate) — die freie Eingabe hier waere widerspruechlich. Andere
  // Varianten (pl/kurator/demo) tippen das Kuerzel weiter frei.
  const askKuerzel = !isMaLoginEnabled();

  const handleColorSelect = (h: number, s: string, l: string): void => {
    setSelectedHue(h);
    setSelectedSat(s);
    setSelectedLit(l);
    applyThemeColor(h, s, l);
  };

  const handlePickPers = async (): Promise<void> => {
    setPersError(null);
    setPersBusy(true);
    try {
      const res = await pickAndStorePersoenlichHandle(storage.idb);
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setPersError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      setPersConnected(true);
    } finally {
      setPersBusy(false);
    }
  };

  /**
   * Identität aus dem persönlichen Ordner zurückholen.
   *
   * Hintergrund: `onboarding-complete` + `profile` liegen ausschliesslich in der
   * varianten-eigenen IndexedDB. Wird die geräumt (Browser-Eviction, zurück-
   * gesetztes Citrix-/Windows-Profil), landet der User wieder hier — obwohl beim
   * ersten Einrichten längst eine Kopie nach `<pers>/ZAH/profile.json` geschrieben
   * wurde (`handleFinish` unten). Bis v2.276.0 wurde die nie gelesen; der User
   * tippte alles neu.
   *
   * Warum das eine explizite Aktion ist und nicht automatisch läuft: mit der IDB
   * sind auch die File-System-Handles weg (die liegen dort). Der Ordner muss also
   * ohnehin einmal neu gewählt werden, und ein Ordner-Picker braucht eine
   * User-Geste — automatisch beim Start ginge nicht.
   */
  const restoreFromPers = useAsyncAction(async () => {
    setPersError(null);
    setNichtsGefunden(false);

    const res = await pickAndStorePersoenlichHandle(storage.idb);
    if (!res.ok) {
      if (res.reason !== 'aborted') {
        setPersError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
      }
      return;
    }
    // Ordner ist jetzt verbunden — unabhaengig davon, ob ein Profil drin lag.
    // So sichert handleFinish am Ende auf jeden Fall wieder dorthin.
    setPersConnected(true);

    const persHandle = await getPersoenlichHandle(storage.idb);
    const gefunden = persHandle ? await readProfileFromShare(persHandle) : null;
    if (!gefunden?.name?.trim()) {
      setNichtsGefunden(true);
      return;
    }

    // Persoenliche Einstellungen (Home-Widgets, Presets) gleich mitziehen und
    // die IDB-Caches fuellen — best-effort, das Profil ist der wichtige Teil.
    try {
      await loadPersonalSettings(storage.idb, persHandle, gefunden);
    } catch {
      /* best-effort */
    }

    setName(gefunden.name);
    setKuerzel(gefunden.bearbeiter_kuerzel ? normalizeKuerzel(gefunden.bearbeiter_kuerzel) : ''); // allow-direct-kuerzel: Onboarding laeuft vor jedem Login-Gate; hier wird das gesicherte Feld nur ins Eingabefeld zurueckgeschrieben, nicht als Identitaet gelesen
    setIsKurator(gefunden.is_kurator === true);
    setDark(gefunden.theme?.dark === true);
    const preset = PRESET_COLORS.find(c => c.h === gefunden.theme?.hue);
    if (preset) handleColorSelect(preset.h, preset.s, preset.l);

    // Direkt zur Zusammenfassung: es gibt nichts mehr einzutragen, der User
    // bestaetigt nur noch.
    setStep(totalSteps - 1);
  });

  // Pitfall 16: EIN finaler persist im Submit. Sammelt alle Werte in einem
  // Profil-Object, schreibt es einmal in IDB + (best-effort) in den pers.
  // Ordner. Kein verteilter setState in mehreren Steps.
  const handleFinish = async (): Promise<void> => {
    const finalProfile: UserProfile = {
      name: name.trim(),
      department: 'antraege',
      theme: { hue: selectedHue, dark },
      is_kurator: isKurator,
      ...(kuerzel ? { bearbeiter_kuerzel: kuerzel } : {}),
    };
    await storage.idb.set('profile', finalProfile);
    await storage.idb.set('onboarding-complete', true);
    applyThemeColor(selectedHue, selectedSat, selectedLit);

    // Pers. Ordner: profile.json synchron-best-effort schreiben. Diese Kopie ist
    // die einzige Rettung, wenn die IndexedDB verloren geht — gelesen wird sie
    // von `restoreFromPers` oben.
    if (persConnected) {
      try {
        const persHandle = await getPersoenlichHandle(storage.idb);
        await savePersonalSettings(storage.idb, persHandle, { profile: finalProfile });
      } catch {
        /* best-effort — IDB-Profil ist die Wahrheit */
      }
    }
    onComplete();
  };

  const profileStepValid = name.trim().length > 0;
  const lastStep = totalSteps - 1;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50" // allow-raw-modal: Vollbild-Zustand, kein Modal
    >
      <div className="w-full max-w-[420px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8" style={{ border: '0.5px solid var(--tf-border)' }}>
        {step === 0 && (
          <div className="space-y-6">
            <h1 className="text-[20px] font-medium text-[var(--tf-text)] text-center">Willkommen bei ZAH</h1>

            {promptPersFolder && (
              <div
                className="p-3.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] space-y-2.5"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-relaxed">
                  <span className="text-[var(--tf-text)] font-medium">Schon einmal eingerichtet?</span>{' '}
                  Wenn Ihr persönlicher Ordner damals verbunden war, liegen Name und
                  Einstellungen dort — Sie müssen nichts neu eintippen.
                </p>
                <Button
                  icon={RotateCcw}
                  variant="secondary"
                  onClick={() => restoreFromPers.run()}
                  disabled={restoreFromPers.busy}
                  className="w-full"
                >
                  {restoreFromPers.busy ? 'Wird gesucht…' : 'Aus persönlichem Ordner wiederherstellen'}
                </Button>
                {nichtsGefunden && (
                  <p className="text-[12px] text-[var(--tf-text-tertiary)] leading-snug">
                    In diesem Ordner liegt noch kein gespeichertes Profil. Bitte einmal
                    unten eintragen — beim Abschluss wird es dort gesichert.
                  </p>
                )}
                {restoreFromPers.error && (
                  <p className="text-[12px] text-[var(--tf-danger-text)]">{restoreFromPers.error}</p>
                )}
                {persError && (
                  <p className="text-[12px] text-[var(--tf-danger-text)]">{persError}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--tf-text)]">Dein Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" className={inputClass} style={inputStyle} />
              </div>
              {askKuerzel && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--tf-text)]">
                    Kürzel <span className="text-[var(--tf-text-tertiary)] font-normal">(optional)</span>
                  </label>
                  <input
                    value={kuerzel}
                    onChange={e => setKuerzel(normalizeKuerzel(e.target.value))}
                    placeholder="MUM"
                    maxLength={6}
                    className={inputClass}
                    style={inputStyle}
                  />
                  <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-snug">
                    2–6 Großbuchstaben. Wird im Bearbeiter-Filter und in eingereichten
                    Feedback-Tickets verwendet. Kann später in den Einstellungen geändert werden.
                  </p>
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
              {showKuratorToggle && (
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isKurator}
                    onChange={e => setIsKurator(e.target.checked)}
                    className="mt-0.5 cursor-pointer accent-[var(--tf-primary)]"
                  />
                  <span className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug">
                    Ich bin Kurator dieses ZAH-Projekts (zeigt zusätzliche Kuration-Bereiche an)
                  </span>
                </label>
              )}
            </div>
            <Button icon={ArrowRight} disabled={!profileStepValid} onClick={() => setStep(1)} className="w-full">Weiter</Button>
          </div>
        )}

        {promptPersFolder && step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <FolderHeart size={22} className="text-[var(--tf-primary)]" />
              <h1 className="text-[18px] font-medium text-[var(--tf-text)]">
                Persönlicher Ordner <span className="text-[var(--tf-text-tertiary)] text-[14px] font-normal">(optional)</span>
              </h1>
            </div>
            <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed">
              Damit Ihre Einstellungen, Filter-Presets und Feedback über Browser-Wechsel
              und Citrix-Sessions hinweg erhalten bleiben, können Sie Ihr persönliches
              Netzlaufwerk verbinden. Die App legt einen Unterordner{' '}
              <code className="text-[11.5px] px-1 py-0.5 rounded bg-[var(--tf-bg-secondary)]">
                {runtimeConfig.personalFolder?.subfolder ?? 'ZAH'}/
              </code>{' '}
              dort an.
            </p>
            <div className="space-y-2">
              <Button
                icon={FolderOpen}
                variant={persConnected ? 'secondary' : 'primary'}
                onClick={handlePickPers}
                disabled={persBusy}
                className="w-full"
              >
                {persConnected ? 'Verbunden — Ordner ändern' : 'Ordner auswählen'}
              </Button>
              {persConnected && (
                <p className="text-[12px] text-[var(--tf-success-text)] flex items-center gap-1.5">
                  <Check size={14} /> Persönlicher Ordner verbunden.
                </p>
              )}
              {persError && (
                <p className="text-[12px] text-[var(--tf-danger-text)]">{persError}</p>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] underline-offset-2 hover:underline cursor-pointer"
              >
                Später einrichten
              </button>
              <Button
                icon={ArrowRight}
                onClick={() => setStep(2)}
                disabled={persBusy}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {step === lastStep && (
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--tf-success-bg)] flex items-center justify-center mx-auto">
              <Check size={28} className="text-[var(--tf-success-text)]" />
            </div>
            <h1 className="text-[20px] font-medium text-[var(--tf-text)]">Alles eingerichtet</h1>
            <div className="text-[13px] text-[var(--tf-text-secondary)] space-y-1.5">
              <p><span className="text-[var(--tf-text-tertiary)]">Name:</span> {name}{kuerzel && ` (${kuerzel})`}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[var(--tf-text-tertiary)]">Farbe:</span>
                <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: `hsl(${selectedHue}, ${selectedSat}, ${selectedLit})` }} />
              </div>
              {promptPersFolder && (
                <p>
                  <span className="text-[var(--tf-text-tertiary)]">Persönlicher Ordner:</span>{' '}
                  {persConnected ? 'verbunden' : 'noch nicht eingerichtet'}
                </p>
              )}
            </div>
            <Button icon={ArrowRight} onClick={handleFinish} className="w-full">Los geht's</Button>
          </div>
        )}

        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[var(--tf-primary)]' : 'bg-[var(--tf-border)]'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
