/**
 * OfflineBanner (v2.0 + v2.0.1).
 *
 * Amber-Banner am oberen App-Rand, nicht dismissbar. Wird automatisch
 * ein-/ausgeblendet je nach ConnectionState. Liest aus `useConnectionState`.
 *
 * v2.0.1: Reconnect-Button erlaubt es dem User, `refreshAllPermissions()`
 * direkt aus dem Banner zu triggern (Notausgang falls der StartupScreen
 * schon dismissed wurde oder der Browser nach Sleep neu Permission braucht).
 *
 * Anti-Pattern: NICHT als Error/rot rendern. Amber = "Information, eingeschraenkt".
 * App bleibt nutzbar (IDB-Cache).
 */

import { useEffect, useState } from 'react';
import { CloudOff, FolderX, RefreshCw } from 'lucide-react';
import { useConnectionState } from '@/core/services/connection-status';
import { runtimeConfig } from '@/config/runtime-config';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import {
  getDatenShareHandle,
  pickAndStorePersoenlichHandle,
  refreshAllPermissions,
} from '@/core/services/infrastructure/smb-handle';
import { connectDataShare } from '@/core/services/infrastructure/connect-data-share';

function formatDate(iso: string | null): string {
  if (!iso) return 'unbekannt';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unbekannt';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OfflineBanner(): React.ReactElement | null {
  const mode = useConnectionState(s => s.mode);
  const persoenlichAvailable = useConnectionState(s => s.persoenlichAvailable);
  const datenShareAvailable = useConnectionState(s => s.datenShareAvailable);
  const lastSync = useConnectionState(s => s.lastSyncTimestamp);
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const setPersoenlichAvailable = useConnectionState(s => s.setPersoenlichAvailable);
  const storage = useStorage();
  const { profile } = useProfile();
  const [busy, setBusy] = useState(false);
  // Ob ueberhaupt ein Daten-Share-Handle in IDB liegt — vorab ermittelt (nicht
  // im Click), damit der Reconnect-Picker als erster async-Hop laufen kann
  // (User-Gesture-Regel, siehe handleReconnect). Re-Check bei Mode-Wechsel.
  const [dataShareMissing, setDataShareMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await getDatenShareHandle(storage.idb);
      if (!cancelled) setDataShareMissing(!h);
    })();
    return () => { cancelled = true; };
  }, [storage.idb, mode]);

  const handleReconnect = async (): Promise<void> => {
    // Persönlich-Ordner-Variante: User-Geste MUSS synchron in den FSAPI-Picker
    // fliessen. Kein `await` (IDB-Read o.ä.) davor — Chrome verbrennt unter
    // file:// nach dem ersten async-Hop die User-Activation und der Picker
    // oeffnet sich silent gar nicht. Der Speicher-Tab funktioniert genau weil
    // er den Picker als ersten await aufruft. Setze `busy` erst NACH dem
    // Picker, damit React-State-Updates die Activation nicht schmaelern.
    if (mode === 'online' && !persoenlichAvailable) {
      try {
        const r = await pickAndStorePersoenlichHandle(storage.idb);
        if (r.ok) setPersoenlichAvailable(true);
      } catch {
        /* ignore — User kann erneut klicken */
      }
      return;
    }
    const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
    // Offline UND gar kein Daten-Share-Handle gespeichert → Picker, denn
    // refreshAllPermissions waere ein No-op (es erneuert nur Permissions
    // vorhandener Handles). Picker MUSS erster async-Hop sein (isKurator oben
    // ist synchron). Fuer fixed-path-Varianten (prod/pl) ist das der einzige
    // In-App-Weg, einen verlorenen Daten-Share neu zu verbinden.
    if (mode === 'offline' && dataShareMissing) {
      try {
        const r = await connectDataShare(storage.idb, { isKurator });
        if (r.ok) {
          applyRefreshResult(r.refresh);
          setDataShareMissing(false);
        }
      } catch {
        /* ignore — User kann erneut klicken */
      }
      return;
    }
    setBusy(true);
    try {
      const result = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
    } catch {
      /* ignore — User kann erneut klicken */
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'online' && persoenlichAvailable) return null;

  if (mode === 'offline') {
    return (
      <div
        className="w-full px-4 py-2 flex items-center gap-2.5 bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] border-b border-[var(--tf-warning-border)] text-[12.5px]"
        role="status"
      >
        <CloudOff size={14} className="shrink-0" />
        <span className="flex-1">
          Offline-Modus — Daten vom {formatDate(lastSync)}. Einige Funktionen sind
          eingeschränkt.
        </span>
        <button
          type="button"
          onClick={handleReconnect}
          disabled={busy}
          className="shrink-0 px-2.5 py-1 rounded text-[11.5px] inline-flex items-center gap-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          style={{ border: '0.5px solid var(--tf-warning-border)' }}
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          Verbindung herstellen
        </button>
      </div>
    );
  }

  if (datenShareAvailable && !persoenlichAvailable && runtimeConfig.personalFolder?.promptAfterProfile) {
    return (
      <div
        className="w-full px-4 py-2 flex items-center gap-2.5 bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] border-b border-[var(--tf-warning-border)] text-[12.5px]"
        role="status"
      >
        <FolderX size={14} className="shrink-0" />
        <span className="flex-1">
          Persönlicher Ordner nicht erreichbar — Einstellungen werden lokal gespeichert.
        </span>
        <button
          type="button"
          onClick={handleReconnect}
          disabled={busy}
          className="shrink-0 px-2.5 py-1 rounded text-[11.5px] inline-flex items-center gap-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          style={{ border: '0.5px solid var(--tf-warning-border)' }}
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          Erneut verbinden
        </button>
      </div>
    );
  }

  return null;
}
