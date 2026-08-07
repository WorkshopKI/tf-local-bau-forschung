/**
 * AppPasswordGate (v2.16, Modul-Passwoerter seit v3.0).
 *
 * Vollbild-Pflicht-Login-Wall, verifiziert gegen den build-time eingebetteten
 * Verifier — keine SMB-Abhaengigkeit, greift also VOR jeder Ordner-Freigabe.
 *
 * Ein Feld, drei moegliche Passwoerter (`verifyAnyPassword`):
 *  - das **Basis-Passwort** (`auth`) oeffnet die App,
 *  - ein **Modul-Passwort** (`moduleAuth.<slot>`) oeffnet die App UND das Modul.
 *
 * Wer nur fuer sein Modul ein Passwort bekommen hat, tippt so eines statt zweier.
 *
 * **Die Anmeldung LEGT den Zustand FEST** (v3.27): geschlossen wurde schon vor dem
 * Rendern (`schliesseGesperrteModule` in App.tsx), hier wird nur noch geoeffnet,
 * was zum getippten Passwort gehoert. Sonst zeigte ein Login mit dem
 * Basis-Passwort weiter, was eine fruehere Sitzung offengelassen hat.
 *
 * Ein Modul-Treffer laedt anschliessend neu: Plugin-Registrierung und
 * onInit-Hooks liefen bereits, als das Modul noch gesperrt war. Der Reload
 * kostet keinen zweiten Login (Gate-Merker im sessionStorage) und keine
 * Freischaltung (die liegt in der IndexedDB).
 *
 * Login-Pflicht: kein Abbrechen/Ueberspringen — ohne korrektes Passwort kein
 * App-Zugang.
 */

import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { verifyAnyPassword } from '@/core/services/infrastructure/app-password';
import { setAppGateSession } from '@/core/hooks/useAppGateSession';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { isKuratorMenusEnabled, hatModulSchloss, hatIrgendeinModulSchloss } from '@/config/feature-flags';
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
    // Nimmt das Basis-Passwort ODER ein Modul-Passwort an: wer nur fuer sein
    // Modul ein Passwort bekommen hat, soll nicht zwei nacheinander tippen.
    const result = await verifyAnyPassword(pw);
    if (!result.ok) {
      setWrong(true);
      return;
    }
    setAppGateSession();

    // Die Anmeldung legt auch die ROLLE fest. Die Profil-Flagge ueberlebt
    // Neustarts und oeffnet im StartupScreen den Daten-Share mit Schreibrecht —
    // ohne diesen Schnitt fordert eine Standard-Anmeldung weiter Schreibrechte an,
    // obwohl die Kurator-Session laengst geschlossen ist. Ueber den Hook, damit
    // React-Zustand und IDB uebereinstimmen (der Gate rendert vor dem StartupScreen).
    if (hatModulSchloss('kurator') && result.slot !== 'kurator') {
      await updateProfile({ is_kurator: false });
    }

    // Modul-Treffer: App oeffnen UND das Modul freischalten. Danach neu laden —
    // Plugin-Registrierung und onInit-Hooks sind bereits durchgelaufen, als das
    // Modul noch gesperrt war. Die Freischaltung liegt in der IndexedDB und der
    // Gate-Merker im sessionStorage, der Reload kostet also keinen zweiten Login.
    if (result.slot === 'auslastung') {
      await useModulFreischaltung.getState().freischalten(storage.idb);
      window.location.reload();
      return;
    }
    if (result.slot === 'kurator') {
      await useKuratorSession.getState().aktiviere(storage.idb, `${runtimeConfig.build.label} · Kurator`);
      await updateProfile({ is_kurator: true });
      try {
        const refreshed = await refreshAllPermissions(storage.idb, { isKurator: true });
        applyRefreshResult(refreshed);
      } catch {
        /* best-effort — der naechste Start stuft hoch. */
      }
      window.location.reload();
      return;
    }
    // v2.61.2: Die Gate läuft jetzt VOR dem StartupScreen/Stepper. Für pl ist hier
    // KEINE Permission-Arbeit mehr nötig — der nachgelagerte Guided-Stepper gibt
    // Datenordner + persönlich + CSV-Quelle Schritt-für-Schritt frei (ein Prompt
    // pro Klick). Der frühere pl-CSV-Re-Grant entfällt damit.
    // Eskalation zum Kurator — aber NUR in Builds OHNE Kurator-Schloss (dev/local).
    //
    // Bis v2.x war das an `kuratorMenus` gebunden, und das genuegte, weil nur der
    // kurator-Build das Flag trug: wer dessen Passwort kannte, WAR Kurator. Im
    // zusammengelegten pl-Build muss `kuratorMenus` an sein (sonst wuerfe
    // plugins.config.ts die Kuration-Plugins schon zur Bauzeit raus) — ohne diese
    // zweite Bedingung machte also JEDES gueltige Basis-Passwort seinen Inhaber
    // zum Kurator. Dort fuehrt der Weg ueber das eigene Modul-Passwort.
    if (isKuratorMenusEnabled() && !hatModulSchloss('kurator')) {
      // Menue-Sichtbarkeit freischalten (Gate in ShellLayout liest profile.is_kurator).
      await updateProfile({ is_kurator: true });
      // Schreib-Session aktivieren — setzt isActive (Schreib-Buttons) +
      // kuratorName (Audit-Identitaet = Build-Label).
      await useKuratorSession.getState().aktiviere(storage.idb, runtimeConfig.build.label);
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
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50" // allow-raw-modal: Vollbild-Zustand, kein Modal
    >
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
          {/* Nur wo es Modul-Passwoerter ueberhaupt gibt: wer eines besitzt, soll
              nicht raten muessen, ob es hier gilt. */}
          {hatIrgendeinModulSchloss() && ' Ein Modul-Passwort öffnet die App und den zugehörigen Bereich gleich mit.'}
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
