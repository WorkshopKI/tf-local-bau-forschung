/**
 * Home-Page-Call-to-Action für frische Installationen ohne persistierten
 * SMB-Handle. Ersetzt die normale Home-Kachel, bis ein Ordner gewählt wurde.
 *
 * Greift in allen Daten-Share-Varianten (inkl. fixed-path prod/pl) — nicht nur
 * bei allowUserToChangePath. Nutzt den gemeinsamen `connectDataShare`-Helfer,
 * damit Picker-Mode (read/readwrite via canWriteDatenShare, Pitfall #25) +
 * erwarteter Ordner-Name-Check identisch zum StartupScreen sind.
 */

import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { connectDataShare } from '@/core/services/infrastructure/connect-data-share';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useProfile } from '@/core/hooks/useProfile';
import { useConnectionState } from '@/core/services/connection-status';
import { dataConfig } from '@/config/feature-flags';

interface HomeCallToActionProps {
  idb: IDBStore;
  onConnected: () => void;
}

export function HomeCallToAction({ idb, onConnected }: HomeCallToActionProps): React.ReactElement {
  const smbStatus = useSmbStatus();
  const { profile } = useProfile();
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const expectedName = dataConfig.expectedFolderName;
  const fixedPath = dataConfig.fixedDataSharePath;

  const handlePick = async (): Promise<void> => {
    // User-Gesture: der Picker (in connectDataShare) muss der erste async-Hop
    // sein. isKurator/setState davor sind synchron — kein await, das die
    // Activation unter file:// verbrennen wuerde.
    setMsg(null);
    const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
    try {
      const r = await connectDataShare(idb, { isKurator });
      if (!r.ok) {
        if (r.reason !== 'aborted') setMsg(r.message ?? 'Ordner konnte nicht ausgewählt werden.');
        return;
      }
      setBusy(true);
      applyRefreshResult(r.refresh);
      await logAudit(idb, {
        action: 'smb_handle_replace',
        details: { old_folder: null, new_folder: r.handle.name },
      });
      await smbStatus.check(idb);
      onConnected();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-xl w-full text-center bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-8"
        style={{ border: '0.5px solid var(--tf-border)' }}>
        <FolderOpen size={40} className="mx-auto mb-4 text-[var(--tf-text-tertiary)]" />
        <h1 className="text-[20px] font-medium text-[var(--tf-text)] mb-3">Willkommen bei TeamFlow</h1>
        <p className="text-[13.5px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          Bevor es losgeht, verbinden Sie die App einmalig mit dem Datenspeicher.
          Diese Einmal-Aktion verbindet die App mit Ihren Antragsdaten.
        </p>
        {fixedPath ? (
          <div className="mb-5 px-3 py-2 rounded-[var(--tf-radius)] text-[12px] font-mono bg-[var(--tf-bg)] text-[var(--tf-text)] overflow-x-auto"
            style={{ border: '0.5px solid var(--tf-border)' }}>
            {fixedPath}
          </div>
        ) : null}
        <Button size="lg" onClick={handlePick} disabled={busy}>
          Datenspeicher wählen
        </Button>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-5 leading-relaxed">
          Hinweis: Wählen Sie den Ordner{' '}
          {expectedName ? (
            <>
              <code className="text-[11px]">{expectedName}</code>, der{' '}
            </>
          ) : (
            'der '
          )}
          <code className="text-[11px]">programm/</code>,{' '}
          <code className="text-[11px]">backups/</code> und{' '}
          <code className="text-[11px]">_intern/</code> enthält.
        </p>
        {msg ? (
          <div className="mt-4 text-[12px] text-[var(--tf-danger-text)]">{msg}</div>
        ) : null}
      </div>
    </div>
  );
}
