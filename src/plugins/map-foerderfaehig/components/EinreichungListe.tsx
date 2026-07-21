/**
 * Master-Liste der importierten Einreichungen samt Drop-Zone.
 *
 * Die Drop-Zone nutzt die geteilte `FileDropZone`; der Import läuft über
 * `useAsyncAction` (Pitfall #15), damit ein Fehler sichtbar wird statt still
 * in einer verworfenen Promise zu verschwinden.
 */
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { FileJson, Trash2 } from 'lucide-react';
import { formatDatum } from '../import/laufzeit';
import type { MapEinreichung } from '../types';

export function EinreichungListe({
  einreichungen, ausgewaehltId, importMeldung, onWaehle, onImportiere, onEntferne,
}: {
  einreichungen: readonly MapEinreichung[];
  ausgewaehltId: string | null;
  importMeldung: string | null;
  onWaehle: (id: string) => void;
  onImportiere: (datei: File) => Promise<void>;
  onEntferne: (id: string) => Promise<void>;
}): React.ReactElement {
  const importieren = useAsyncAction(async (datei: File) => { await onImportiere(datei); });
  const entfernen = useAsyncAction(async (id: string) => { await onEntferne(id); });

  return (
    <div className="flex flex-col gap-3 p-4">
      <FileDropZone
        onFiles={dateien => { void importieren.run(dateien[0]!); }}
        accept=".json,application/json"
        padding="px-4 py-6"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <FileJson size={20} className="text-[var(--tf-text-tertiary)]" />
          <span className="text-[13px] text-[var(--tf-text)]">
            {importieren.busy ? 'Wird gelesen …' : 'Einreichungs-JSON hier ablegen'}
          </span>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            oder klicken, um eine Datei zu wählen
          </span>
        </div>
      </FileDropZone>

      {importieren.error != null && (
        <div
          className="text-[12.5px] rounded px-3 py-2"
          style={{
            color: 'var(--tf-danger-text)',
            background: 'color-mix(in srgb, var(--tf-danger-text) 10%, var(--tf-bg))',
          }}
        >
          Import fehlgeschlagen: {importieren.error}
          <button
            type="button"
            onClick={importieren.clearError}
            className="ml-2 underline cursor-pointer"
          >
            ausblenden
          </button>
        </div>
      )}

      {importMeldung != null && (
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{importMeldung}</p>
      )}

      {entfernen.error != null && (
        <p className="text-[12.5px]" style={{ color: 'var(--tf-danger-text)' }}>
          Entfernen fehlgeschlagen: {entfernen.error}
        </p>
      )}

      {einreichungen.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-1">
          Noch keine Einreichung importiert.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {einreichungen.map(e => {
            const aktiv = e.id === ausgewaehltId;
            return (
              <li key={e.id}>
                <div
                  className="group rounded-[var(--tf-radius-md,8px)] px-3 py-2.5 cursor-pointer transition"
                  style={{
                    border: '0.5px solid var(--tf-border)',
                    borderLeft: `3px solid ${aktiv ? 'var(--tf-primary)' : 'transparent'}`,
                    background: aktiv
                      ? 'color-mix(in srgb, var(--tf-primary) 7%, var(--tf-bg))'
                      : 'var(--tf-card-surface, var(--tf-bg))',
                  }}
                  onClick={() => onWaehle(e.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--tf-text)] truncate">
                        {e.stamm.akronym ?? e.stamm.titel ?? e.dateiname}
                      </p>
                      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] truncate mt-0.5">
                        {e.stamm.titel ?? '—'}
                      </p>
                      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">
                        {formatDatum(e.importiertAm.slice(0, 10))}
                        {e.schemaId != null && ` · ${e.schemaId}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Einreichung entfernen"
                      className="opacity-0 group-hover:opacity-100 transition shrink-0"
                      disabled={entfernen.busy}
                      onClick={ev => { ev.stopPropagation(); entfernen.run(e.id); }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
