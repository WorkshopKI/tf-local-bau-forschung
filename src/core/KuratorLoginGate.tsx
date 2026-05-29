/**
 * KuratorLoginGate (v2.10).
 *
 * Vollbild-Pflicht-Login fuer die kurator-Variante (`features.requireKuratorLogin`).
 * Wird im Startup-Flow von App.tsx NACH dem StartupScreen (Daten-Share-Permission
 * steht) und VOR dem AppRouter gerendert, wenn ein Kurator konfiguriert ist
 * (`isKuratorConfigured`) aber keine gueltige Session rehydriert wurde.
 *
 * Login-Pflicht: kein Abbrechen/Ueberspringen — ohne korrektes Passwort kein
 * App-Zugang. Bei Erfolg:
 *  1) Session aktiv (verifyPassword gegen `_intern/kurator-config.enc`),
 *  2) `profile.is_kurator = true` → Kuration-Menues erscheinen,
 *  3) Daten-Share-Handle auf readwrite hochstufen (Erst-Login hatte nur `read`),
 *     im selben User-Gesture wie der Button-Klick (requestPermission erlaubt).
 */

import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/ui';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { runtimeConfig } from '@/config/runtime-config';

interface KuratorLoginGateProps {
  onSuccess: () => void;
}

export function KuratorLoginGate({ onSuccess }: KuratorLoginGateProps): React.ReactElement {
  const storage = useStorage();
  const { updateProfile } = useProfile();
  const session = useKuratorSession();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [pw, setPw] = useState('');
  const [wrong, setWrong] = useState(false);

  const login = useAsyncAction(async () => {
    setWrong(false);
    const ok = await session.activate(storage.idb, pw);
    if (!ok) {
      setWrong(true);
      return;
    }
    // Menue-Sichtbarkeit freischalten (Gate in ShellLayout liest profile.is_kurator).
    await updateProfile({ is_kurator: true });
    // Daten-Share-Handle auf readwrite hochstufen: ein Erst-Login auf diesem
    // Rechner hatte is_kurator=false → StartupScreen gewaehrte nur `read`. Jetzt
    // im selben User-Gesture re-verhandeln (vgl. StartupScreen.handleStart,
    // Pitfall #25). Best-effort — OfflineBanner kommuniziert ggf. Fehler, und
    // der naechste Start stuft ueber die Permission-Kette ohnehin hoch.
    try {
      const result = await refreshAllPermissions(storage.idb, { isKurator: true });
      applyRefreshResult(result);
    } catch {
      /* best-effort */
    }
    onSuccess();
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div
        className="w-full max-w-[420px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={22} className="text-[var(--tf-primary)]" />
          <h1 className="text-[20px] font-medium text-[var(--tf-text)]">Kurator-Anmeldung</h1>
        </div>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          {runtimeConfig.build.label} erfordert eine Kurator-Anmeldung. Bitte das Kurator-Passwort
          eingeben, um fortzufahren.
        </p>

        <Input
          type="password"
          placeholder="Kurator-Passwort"
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
          onClick={() => void login.run()}
          disabled={login.busy || pw.length === 0}
          className="w-full mt-5"
        >
          {login.busy ? 'Anmelden…' : 'Anmelden'}
        </Button>
      </div>
    </div>
  );
}
