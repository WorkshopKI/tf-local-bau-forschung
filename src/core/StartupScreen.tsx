/**
 * StartupScreen (v2.0).
 *
 * Wird beim App-Start gerendert wenn Profil + mindestens Daten-Share-Handle
 * vorhanden sind, aber Permissions noch nicht ausgehandelt sind. Ein Klick auf
 * "Starten" loest `refreshAllPermissions()` in einer einzigen User-Gesture-
 * Kette aus — der Browser zeigt nacheinander die "Erlauben?"-Dialoge fuer
 * Daten-Share + Persoenlich-Handle.
 *
 * Migrations-Banner: bestehende User mit `readwrite`-Daten-Share-Handle und
 * `is_kurator=false` (v2.0-Hardening) bekommen einen Re-Pick-Button.
 */

import { useState } from 'react';
import { ArrowRight, FolderOpen, ShieldCheck } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  pickAndStoreDatenShareHandle,
  refreshAllPermissions,
  type RefreshAllResult,
} from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { NEEDS_HANDLE_DOWNGRADE_IDB_KEY } from '@/core/services/infrastructure/types';
import type { UserProfile } from '@/core/types/config';

interface StartupScreenProps {
  profile: UserProfile | null;
  /** Wenn true, zeigt der Screen das Migrations-Banner statt "Starten"-Button. */
  needsDowngrade: boolean;
  onReady: () => void;
}

export function StartupScreen({ profile, needsDowngrade, onReady }: StartupScreenProps): React.ReactElement {
  const storage = useStorage();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isKurator = profile?.is_kurator === true || profile?.is_admin === true;

  const handleStart = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const result: RefreshAllResult = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
      // Auch bei 'denied' / 'missing' fortfahren — der OfflineBanner uebernimmt
      // die Kommunikation. Der User kann die App immer noch offline nutzen.
      onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDowngrade = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndStoreDatenShareHandle(storage.idb, { mode: 'read' });
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      await storage.idb.delete(NEEDS_HANDLE_DOWNGRADE_IDB_KEY);
      // Direkt weiter zum normalen Refresh
      const result = await refreshAllPermissions(storage.idb, { isKurator: false });
      applyRefreshResult(result);
      onReady();
    } catch (err) {
      setError((err as Error).message ?? 'Verbindung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const display = profile?.name
    ? `${profile.name}${profile.bearbeiter_kuerzel ? ` (${profile.bearbeiter_kuerzel})` : ''}`
    : 'Unbekannt';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50">
      <div
        className="w-full max-w-[480px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">TeamFlow</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6">
          Angemeldet als: <span className="text-[var(--tf-text)]">{display}</span>
        </p>

        {needsDowngrade ? (
          <div
            className="mb-5 p-4 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)] text-[var(--tf-info-text)] border border-[var(--tf-info-border)]"
          >
            <div className="flex items-start gap-2.5 mb-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[13px] mb-1">Sicherheits-Update</p>
                <p className="text-[12.5px] leading-relaxed">
                  Der Datenordner muss einmalig neu verbunden werden, damit die App
                  nur lesend zugreift. Klicken Sie auf den Button unten und wählen
                  Sie denselben Ordner wie bisher.
                </p>
              </div>
            </div>
            <Button icon={FolderOpen} onClick={handleDowngrade} disabled={busy} className="w-full mt-2">
              Datenordner neu verbinden
            </Button>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] leading-relaxed mb-5">
              Beim Start fragt der Browser einmalig nach Erlaubnis für den Datenordner
              {profile && !isKurator ? ' (Lese-Zugriff)' : ''} und Ihren persönlichen
              Ordner.
            </p>
            <Button icon={ArrowRight} onClick={handleStart} disabled={busy} className="w-full">
              Starten
            </Button>
          </>
        )}

        {error && (
          <p className="mt-4 text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>
        )}
      </div>
    </div>
  );
}
