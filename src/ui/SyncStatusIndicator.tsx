import { useState, useEffect } from 'react';
import { RefreshCw, Plug } from 'lucide-react';
import { Button, Dialog, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useConnectionState } from '@/core/services/connection-status';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import type { SyncStatus } from '@/core/services/sync/sync-service';

export function SyncStatusIndicator(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0, syncing: false, lastSync: null, conflicts: 0, failed: 0, connected: false,
  });
  const [showDetail, setShowDetail] = useState(false);
  const [reconnectBusy, setReconnectBusy] = useState(false);

  useEffect(() => {
    storage.syncService.getStatus().then(setStatus);
    const unsub = storage.syncService.onStatusChange(setStatus);
    return unsub;
  }, [storage]);

  const handleReconnect = async (): Promise<void> => {
    setReconnectBusy(true);
    try {
      const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
      const result = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
      const fresh = await storage.syncService.getStatus();
      setStatus(fresh);
    } catch {
      /* ignore — User kann erneut klicken */
    } finally {
      setReconnectBusy(false);
    }
  };

  const dotColor = status.syncing
    ? 'bg-[var(--tf-warning-text)] animate-pulse'
    : status.pending > 0 || status.failed > 0
      ? 'bg-[var(--tf-warning-text)]'
      : status.connected
        ? 'bg-[var(--tf-success-text)]'
        : 'bg-[var(--tf-text-tertiary)]';

  const label = status.syncing
    ? 'Synchronisiere...'
    : status.pending > 0
      ? `${status.pending} ausstehend`
      : status.connected
        ? 'Synchronisiert'
        : `Offline${status.pending > 0 ? ` (${status.pending})` : ''}`;

  return (
    <>
      <button onClick={() => setShowDetail(true)}
        className="flex items-center gap-2 px-3 py-2 w-full text-left cursor-pointer hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[11px] text-[var(--tf-text-tertiary)] truncate">{label}</span>
      </button>

      <Dialog open={showDetail} onClose={() => setShowDetail(false)} title="Synchronisierung">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-[13px] text-[var(--tf-text)]">{label}</span>
          </div>

          {status.lastSync && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Letzter Sync: {new Date(status.lastSync).toLocaleString('de-DE')}
            </p>
          )}

          {status.pending > 0 && (
            <div>
              <SectionHeader label={`${status.pending} ausstehende Operationen`} />
            </div>
          )}

          {status.failed > 0 && (
            <div>
              <SectionHeader label={`${status.failed} fehlgeschlagen`} />
              <div className="flex gap-2 mt-2">
                <Button variant="secondary" size="sm" onClick={() => storage.syncService.retryFailed()}>Erneut versuchen</Button>
                <Button variant="ghost" size="sm" onClick={() => storage.syncService.discardFailed()}>Verwerfen</Button>
              </div>
            </div>
          )}

          {status.connected ? (
            <Button variant="secondary" icon={RefreshCw} onClick={() => storage.syncService.processQueue()}>
              Jetzt synchronisieren
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                variant="secondary"
                icon={Plug}
                onClick={handleReconnect}
                disabled={reconnectBusy}
              >
                {reconnectBusy ? 'Verbinde...' : 'Verbinden'}
              </Button>
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-snug">
                Bleibt die Verbindung offline, kann der Datenordner in den
                Einstellungen → Speicher neu ausgewählt werden.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
