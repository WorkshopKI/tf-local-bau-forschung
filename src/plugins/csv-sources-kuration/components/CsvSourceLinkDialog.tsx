/**
 * v2.18: „CSV-Quelle verknüpfen"-Dialog.
 *
 * Nicht-Kurator-Builds (pl) bekommen die CSV-Schemas über den Share-Snapshot,
 * aber nie ein lokales Datei-Handle (das entsteht sonst nur im Kurator-Import-
 * Wizard). Dieser Dialog listet die noch nicht verknüpften Quellen und lässt
 * den User pro Quelle die zugehörige CSV-Datei wählen (`pickAndLinkCsvSource`
 * im Hook). Danach läuft der Auto-Refresh-Check für die Quelle normal.
 *
 * Jede Zeile kapselt ihren eigenen busy/error-State via `useAsyncAction`
 * (Pitfall #15) — der Picker-Aufruf läuft aus dem Klick-Gesture.
 */

import { FileText, Link2, CheckCircle2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { PermissionNeededEntry } from '../hooks/useCsvAutoRefreshCheck';

interface Props {
  sources: PermissionNeededEntry[];
  /** Öffnet den Datei-Picker für die Quelle und speichert das Handle. Wirft bei Mismatch. */
  onLink: (schemaId: string) => Promise<void>;
  onClose: () => void;
}

function LinkRow({ source, onLink }: { source: PermissionNeededEntry; onLink: Props['onLink'] }): React.ReactElement {
  const link = useAsyncAction(() => onLink(source.schemaId));
  return (
    <div className="rounded border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0 text-[12.5px] font-medium text-[var(--tf-text)]">
          <FileText size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />
          <span className="truncate">{source.schemaName}</span>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => { void link.run(); }}
          disabled={link.busy}
          className="shrink-0"
        >
          <Link2 size={13} className="mr-1" />
          {link.busy ? 'Wählen…' : 'Datei wählen'}
        </Button>
      </div>
      {link.error ? (
        <div className="mt-1.5 text-[11.5px] text-red-700">{link.error}</div>
      ) : null}
    </div>
  );
}

export function CsvSourceLinkDialog({ sources, onLink, onClose }: Props): React.ReactElement {
  return (
    <Dialog
      open
      onClose={onClose}
      title="CSV-Quellen verknüpfen"
      className="max-w-[560px]"
      footer={
        <div className="flex w-full justify-end">
          <Button size="sm" variant="default" onClick={onClose}>Schließen</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Diese CSV-Quellen sind registriert, aber auf diesem Rechner noch nicht mit
          einer Datei verknüpft. Wähle pro Quelle die zugehörige CSV-Datei — danach
          prüft die App automatisch auf neue Daten und bietet die Aktualisierung an.
        </p>

        {sources.length === 0 ? (
          <div className="flex items-center gap-1.5 rounded-md border-[0.5px] border-green-300 bg-green-50 px-3 py-2 text-[12.5px] text-green-900">
            <CheckCircle2 size={14} className="shrink-0" />
            Alle Quellen sind verknüpft.
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map(s => (
              <LinkRow key={s.schemaId} source={s} onLink={onLink} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
