/**
 * v2.18 / v2.27: „CSV-Quellen verknüpfen"-Dialog.
 *
 * Nicht-Kurator-Builds (pl) bekommen die CSV-Schemas über den Share-Snapshot,
 * aber nie ein lokales Datei-Handle (das entsteht sonst nur im Kurator-Import-
 * Wizard). Dieser Dialog verknüpft die Quellen mit lokalen Dateien.
 *
 * Bevorzugt (v2.27): EIN Ordner-Handle über „CSV-Ordner verknüpfen" — die App
 * ordnet alle Quellen automatisch den Dateien im Ordner zu. Vorteil: das
 * Ordner-Handle wird beim App-Start mit EINEM Prompt re-granted (Permission
 * kaskadiert), sodass der Banner nach einem Neustart nicht mehr nachfragt.
 * Fallback: pro Quelle eine Einzeldatei wählen (`pickAndLinkCsvSource`).
 *
 * Jede Aktion kapselt ihren eigenen busy/error-State via `useAsyncAction`
 * (Pitfall #15) — der Picker-Aufruf läuft aus dem Klick-Gesture.
 */

import { FileText, Link2, CheckCircle2, FolderInput } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { PermissionNeededEntry } from '../hooks/useCsvAutoRefreshCheck';

interface Props {
  sources: PermissionNeededEntry[];
  /** Öffnet den Datei-Picker für die Quelle und speichert das Handle. Wirft bei Mismatch. */
  onLink: (schemaId: string) => Promise<void>;
  /** Öffnet den Ordner-Picker und verknüpft alle Quellen über EIN Ordner-Handle (v2.27). */
  onLinkFolder: () => Promise<void>;
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
          variant="outline"
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

export function CsvSourceLinkDialog({ sources, onLink, onLinkFolder, onClose }: Props): React.ReactElement {
  const linkFolder = useAsyncAction(onLinkFolder);
  return (
    <Dialog
      open
      onClose={onClose}
      title="CSV-Quellen verknüpfen"
      className="max-w-[560px]"
      footer={
        <div className="flex w-full justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>Schließen</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {sources.length === 0 ? (
          <div className="flex items-center gap-1.5 rounded-md border-[0.5px] border-green-300 bg-green-50 px-3 py-2 text-[12.5px] text-green-900">
            <CheckCircle2 size={14} className="shrink-0" />
            Alle Quellen sind verknüpft.
          </div>
        ) : (
          <>
            {/* Bevorzugt: EIN Ordner-Handle für alle Quellen (v2.27). */}
            <div
              className="rounded-md px-3 py-2.5"
              style={{ border: '0.5px solid var(--tf-primary)', background: 'var(--tf-primary-light)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-[var(--tf-text)]">
                    Alle Quellen über den Ordner verknüpfen
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--tf-text-secondary)]">
                    Wähle den Ordner, in dem alle CSV-Quelldateien direkt liegen — die App
                    ordnet sie automatisch zu und muss nach einem Browser-Neustart nicht
                    erneut nachfragen.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => { void linkFolder.run(); }}
                  disabled={linkFolder.busy}
                  className="shrink-0"
                >
                  <FolderInput size={13} className="mr-1" />
                  {linkFolder.busy ? 'Wählen…' : 'CSV-Ordner verknüpfen'}
                </Button>
              </div>
              {linkFolder.error ? (
                <div className="mt-1.5 text-[11.5px] text-red-700">{linkFolder.error}</div>
              ) : null}
            </div>

            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Oder einzeln verknüpfen — eine CSV-Datei pro Quelle:
            </p>
            <div className="space-y-2">
              {sources.map(s => (
                <LinkRow key={s.schemaId} source={s} onLink={onLink} />
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
