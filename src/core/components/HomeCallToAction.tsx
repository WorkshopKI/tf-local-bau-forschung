/**
 * Home-Page-Call-to-Action für frische Installationen ohne persistierten
 * SMB-Handle. Ersetzt die normale Home-Kachel, bis ein Ordner gewählt wurde.
 */

import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { pickAndStoreParentHandle } from '@/core/services/infrastructure/smb-handle';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';

interface HomeCallToActionProps {
  idb: IDBStore;
  onConnected: () => void;
}

export function HomeCallToAction({ idb, onConnected }: HomeCallToActionProps): React.ReactElement {
  const smbStatus = useSmbStatus();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = async (): Promise<void> => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await pickAndStoreParentHandle(idb);
      if (r.ok) {
        await logAudit(idb, {
          action: 'smb_handle_replace',
          details: { old_folder: null, new_folder: r.handle.name },
        });
        await smbStatus.check(idb);
        onConnected();
      } else if (r.reason === 'aborted') {
        setMsg('Auswahl abgebrochen.');
      } else {
        setMsg(r.message ?? 'Ordner konnte nicht ausgewählt werden.');
      }
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
          Bevor es losgeht, wählen Sie den Daten-Share-Root auf dem SMB-Share aus.
          Diese Einmal-Aktion verbindet die App mit Ihren Antragsdaten.
        </p>
        <Button size="lg" onClick={handlePick} disabled={busy}>
          Datenspeicher wählen
        </Button>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-5 leading-relaxed">
          Hinweis: Wählen Sie den Root-Ordner, der{' '}
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
