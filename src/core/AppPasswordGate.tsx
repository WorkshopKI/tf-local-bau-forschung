/**
 * AppPasswordGate (v2.16).
 *
 * Generische Vollbild-Pflicht-Login-Wall fuer die pl- und kurator-Variante,
 * verifiziert gegen den build-time eingebetteten Verifier (`runtimeConfig.auth`)
 * — keine SMB-Abhaengigkeit. Loest den v2.10-KuratorLoginGate ab (vereinheitlicht
 * beide Rollen in einem Mechanismus).
 *
 * Login-Pflicht: kein Abbrechen/Ueberspringen — ohne korrektes Passwort kein
 * App-Zugang. Bei Erfolg:
 *  1) sessionStorage-Flag setzen (Tab-Session, Same-Tab-Reload ueberspringt das Gate),
 *  2) rollenbewusste Eskalation NUR in der kurator-Variante (isKuratorMenusEnabled):
 *     `is_kurator=true` (Menues) + Schreib-Session (activateSynthetic) +
 *     Daten-Share-Handle auf readwrite hochstufen — exakt wie der alte
 *     KuratorLoginGate. Die pl-Variante schaltet nur frei (hat
 *     datenShareSchreibrecht bereits build-time).
 */

import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/ui';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { verifyAppPassword } from '@/core/services/infrastructure/app-password';
import { setAppGateSession } from '@/core/hooks/useAppGateSession';
import { refreshAllPermissions, refreshCsvSourceDirPermission } from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { runtimeConfig } from '@/config/runtime-config';

interface AppPasswordGateProps {
  onSuccess: () => void;
}

export function AppPasswordGate({ onSuccess }: AppPasswordGateProps): React.ReactElement {
  const storage = useStorage();
  const { updateProfile } = useProfile();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [pw, setPw] = useState('');
  const [wrong, setWrong] = useState(false);

  const login = useAsyncAction(async () => {
    setWrong(false);
    const result = await verifyAppPassword(pw);
    if (!result.ok) {
      setWrong(true);
      return;
    }
    setAppGateSession();
    // v2.55: Der CSV-Quellen-Ordner wird seit dem Guided-Grant-Stepper (siehe
    // StartupScreen → GuidedGrantSteps) bereits VOR dem Login als eigener
    // Klick-Schritt freigegeben. Dieser Aufruf bleibt als guarded Fallback —
    // `refreshCsvSourceDirPermission` ist queryPermission-gated und no-op't,
    // wenn der Stepper schon granted hat (kein Doppel-Prompt). Greift nur, wenn
    // der CSV-Ordner erst NACH dem Startup-Scan verknüpft wurde. BEWUSST nicht
    // refreshAllPermissions (das würde den persoenlich-Handle vor dem Ordner
    // prompten und den Slot stehlen — one-prompt-per-gesture, recurring-bug §2).
    if (!isKuratorMenusEnabled() && isCsvAutoRefreshEnabled()) {
      try { await refreshCsvSourceDirPermission(storage.idb); } catch { /* best-effort */ }
    }
    // Kurator-Variante: volle Eskalation (wie der v2.10-KuratorLoginGate).
    if (isKuratorMenusEnabled()) {
      // Menue-Sichtbarkeit freischalten (Gate in ShellLayout liest profile.is_kurator).
      await updateProfile({ is_kurator: true });
      // Schreib-Session aktivieren (ohne SMB-Lesen von kurator-config.enc) — setzt
      // isActive (Schreib-Buttons) + kuratorName (Audit-Identitaet = Build-Label).
      await useKuratorSession.getState().activateSynthetic(storage.idb, runtimeConfig.build.label);
      // Daten-Share-Handle auf readwrite hochstufen: ein Erst-Login auf diesem
      // Rechner hatte is_kurator=false → StartupScreen gewaehrte nur `read`. Jetzt
      // im selben User-Gesture re-verhandeln (Pitfall #25). Best-effort.
      try {
        const refreshed = await refreshAllPermissions(storage.idb, { isKurator: true });
        applyRefreshResult(refreshed);
      } catch {
        /* best-effort — OfflineBanner kommuniziert ggf. Fehler, naechster Start stuft hoch. */
      }
    }
    onSuccess();
  });

  const hint = runtimeConfig.auth?.hint;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div
        className="w-full max-w-[420px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={22} className="text-[var(--tf-primary)]" />
          <h1 className="text-[20px] font-medium text-[var(--tf-text)]">{runtimeConfig.build.label} — Anmeldung</h1>
        </div>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          Diese Variante ist zugangsbeschränkt. Bitte das Passwort eingeben, um fortzufahren.
        </p>

        <Input
          type="password"
          placeholder="Passwort"
          value={pw}
          onChange={e => { setPw(e.target.value); if (wrong) setWrong(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && pw) { e.preventDefault(); void login.run(); } }}
          autoFocus
        />

        {wrong && (
          <p className="mt-2 text-[12.5px] text-[var(--tf-danger-text)]">Passwort falsch.</p>
        )}
        {login.error && (
          <p className="mt-2 text-[12.5px] text-[var(--tf-danger-text)]">{login.error}</p>
        )}

        <Button
          icon={LogIn}
          onClick={() => login.run()}
          disabled={login.busy || pw.length === 0}
          className="w-full mt-5"
        >
          {login.busy ? 'Anmelden…' : 'Anmelden'}
        </Button>

        {hint && (
          <p className="mt-4 text-[11.5px] text-[var(--tf-text-tertiary)] text-center">{hint}</p>
        )}
      </div>
    </div>
  );
}
