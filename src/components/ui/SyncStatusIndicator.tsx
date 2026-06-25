import { useState, useEffect } from 'react';
import { RefreshCw, Plug, Settings, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/ui/Dialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useConnectionState } from '@/core/services/connection-status';
import { refreshAllPermissions } from '@/core/services/infrastructure/smb-handle';
import type { SyncStatus } from '@/core/services/sync/sync-service';

export function SyncStatusIndicator(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const { navigate } = useNavigation();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  // v2: Anzeige-Quelle ist useConnectionState, NICHT SyncStatus.connected.
  // SyncStatus.connected schaut auf die alte DirectoryEntry-Map (Multi-Source),
  // die in ZAH-Prod immer leer ist → wuerde konstant "Offline" zeigen, obwohl
  // der v2.0 Daten-Share-Handle verbunden ist.
  const datenShareAvailable = useConnectionState(s => s.datenShareAvailable);
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
      : datenShareAvailable
        ? 'bg-[var(--tf-success-text)]'
        : 'bg-[var(--tf-text-tertiary)]';

  const label = status.syncing
    ? 'Synchronisiere...'
    : status.pending > 0
      ? `${status.pending} ausstehend`
      : datenShareAvailable
        ? 'Verbunden'
        : `Offline${status.pending > 0 ? ` (${status.pending})` : ''}`;

  const triggerTooltip = status.syncing
    ? 'Synchronisierung läuft...'
    : status.pending > 0
      ? `${status.pending} Sync-Operationen ausstehend`
      : datenShareAvailable
        ? 'Datenordner ist erreichbar, Anträge sind aktuell.'
        : 'Datenordner offline — klicken um zu verbinden.';

  return (
    <>
      {/* Icon-only (grün/rot) — Datenbestand. Kein Punkt/Text: in schmaler Sidebar
          kein Platz; Status steckt in Icon-Farbe + Tooltip. Detail per Klick. */}
      <button onClick={() => setShowDetail(true)}
        title={triggerTooltip}
        aria-label={triggerTooltip}
        className="flex items-center justify-center p-1.5 rounded-[var(--tf-radius)] cursor-pointer hover:bg-[var(--tf-hover)] shrink-0">
        <Database
          size={14}
          className={status.syncing
            ? 'text-[var(--tf-warning-text)] animate-pulse'
            : datenShareAvailable
              ? 'text-[var(--tf-success-text)]'
              : 'text-[var(--tf-danger-text)]'}
        />
      </button>

      <Dialog open={showDetail} onClose={() => setShowDetail(false)} title="Synchronisierung">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-[13px] text-[var(--tf-text)]">{label}</span>
          </div>

          {datenShareAvailable && !status.syncing && status.pending === 0 && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] leading-snug">
              Datenordner ist erreichbar, Anträge sind aktuell.
            </p>
          )}

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

          {datenShareAvailable ? (
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
              <Button
                variant="ghost"
                icon={Settings}
                onClick={() => { navigate('einstellungen'); setShowDetail(false); }}
              >
                Zu den Einstellungen
              </Button>
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-snug">
                Bleibt die Verbindung offline, kann der Datenordner in den
                Einstellungen → Speicher neu verbunden werden.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
