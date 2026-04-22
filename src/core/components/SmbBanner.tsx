/**
 * SMB-Warn-Banner mit Recovery-Actions.
 *
 * Drei Zustände:
 *  - permission_denied → Rot + [Zugriff erneuern] [Anderen Ordner wählen]
 *  - offline           → Amber + [Erneut verbinden]
 *  - online / unknown  → nichts (kein Banner)
 *
 * User-Geste-Compliance: requestPermission() wird synchron im onClick-Handler
 * aufgerufen (keine setTimeout/verzögerte awaits davor), sonst blockt Chrome
 * mit SecurityError.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SmbStatus } from '@/core/services/infrastructure/offline-check';
import {
  getSmbHandle,
  refreshPermission,
  pickAndStoreParentHandle,
} from '@/core/services/infrastructure/smb-handle';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';

interface SmbBannerProps {
  status: SmbStatus;
  lastCheck: number | null;
  idb: IDBStore;
}

export function SmbBanner({ status, lastCheck, idb }: SmbBannerProps): React.ReactElement | null {
  const smbStatus = useSmbStatus();
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'online' || status === 'unknown') return null;

  const handleRefreshPermission = async (): Promise<void> => {
    setInlineMsg(null);
    setBusy(true);
    try {
      const handle = await getSmbHandle(idb);
      if (!handle) {
        await handlePickFolder();
        return;
      }
      const result = await refreshPermission(handle);
      await logAudit(idb, { action: 'smb_permission_refresh', details: { result } });
      if (result === 'granted') {
        await smbStatus.check(idb);
      } else {
        setInlineMsg('Zugriff konnte nicht erneuert werden. Bitte anderen Ordner wählen.');
      }
    } catch (e) {
      await logAudit(idb, { action: 'smb_permission_refresh', details: { result: 'error', message: (e as Error).message } });
      setInlineMsg(`Fehler beim Zugriff: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePickFolder = async (): Promise<void> => {
    setInlineMsg(null);
    setBusy(true);
    try {
      const prev = await getSmbHandle(idb);
      const oldFolder = prev?.name ?? null;
      const r = await pickAndStoreParentHandle(idb);
      if (r.ok) {
        await logAudit(idb, {
          action: 'smb_handle_replace',
          details: { old_folder: oldFolder, new_folder: r.handle.name },
        });
        await smbStatus.check(idb);
      } else if (r.reason === 'aborted') {
        setInlineMsg('Auswahl abgebrochen.');
      } else {
        setInlineMsg(r.message ?? 'Ordner konnte nicht ausgewählt werden.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReconnect = async (): Promise<void> => {
    setInlineMsg(null);
    setBusy(true);
    try {
      await smbStatus.check(idb);
      if (useSmbStatus.getState().status !== 'online') {
        setInlineMsg('Immer noch keine Verbindung. Bitte Netzwerk prüfen.');
      }
    } finally {
      setBusy(false);
    }
  };

  const minAgo = lastCheck ? Math.max(0, Math.round((Date.now() - lastCheck) / 60_000)) : null;
  const bg = status === 'permission_denied' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800';
  const text = status === 'permission_denied'
    ? 'SMB-Zugriff verweigert.'
    : `Offline-Modus — letzter Sync: ${minAgo !== null ? `vor ${minAgo} min` : 'nie'}. Einige Daten könnten veraltet sein.`;

  return (
    <div
      className={`px-6 py-2 text-[12.5px] ${bg}`}
      role="status"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>⚠ {text}</span>
        {status === 'permission_denied' ? (
          <>
            <Button size="xs" variant="default" onClick={handleRefreshPermission} disabled={busy}>
              Zugriff erneuern
            </Button>
            <Button size="xs" variant="outline" onClick={handlePickFolder} disabled={busy}>
              Anderen Ordner wählen
            </Button>
          </>
        ) : (
          <Button size="xs" variant="outline" onClick={handleReconnect} disabled={busy}>
            Erneut verbinden
          </Button>
        )}
      </div>
      {inlineMsg ? (
        <div className="mt-1 text-[11.5px] opacity-80">{inlineMsg}</div>
      ) : null}
    </div>
  );
}
