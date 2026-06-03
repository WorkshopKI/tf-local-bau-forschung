/**
 * Drift-Sammelbericht nach Auto-Refresh-Lauf.
 *
 * Zeigt pro Quelle mit Spalten-Drift: welche Schema-Spalten fehlen in der
 * neuen CSV, welche neuen Spalten gibt es. Der Kurator wird auf die
 * CSV-Sources-Seite verwiesen, um dort den Re-Import-Dialog zu nutzen
 * (dort kann er die volle Drift-Analyse einsehen und entscheiden, ob
 * er die Datei trotzdem mit den alten Mappings importiert oder ein
 * neues Schema registriert).
 */

import { AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { RefreshReport } from '../services/auto-refresh';

interface Props {
  report: RefreshReport;
  onClose: () => void;
  /** Navigation in die CSV-Sources-Seite (dort kann der Kurator den Re-Import ausloesen). */
  onOpenWizard?: () => void;
}

export function CsvAutoRefreshDriftDialog({ report, onClose, onOpenWizard }: Props): React.ReactElement {
  const totalProcessed = report.processed.length;
  const totalDrift = report.drift.length;
  const totalErrors = report.errors.length;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Auto-Refresh abgeschlossen"
      className="max-w-[640px]"
      footer={
        <div className="flex w-full justify-end">
          <Button size="sm" variant="default" onClick={onClose}>Schließen</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-[12.5px] text-[var(--tf-text-secondary)]">
          {totalProcessed > 0 ? (
            <>
              <span className="font-medium text-[var(--tf-text)]">{totalProcessed}</span> Quelle
              {totalProcessed === 1 ? '' : 'n'} wurden automatisch aktualisiert.
            </>
          ) : (
            <>Keine Quelle konnte automatisch aktualisiert werden.</>
          )}
        </div>

        {totalDrift > 0 ? (
          <div className="rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
              <div className="text-[12.5px] font-medium text-amber-900">
                {totalDrift} Quelle{totalDrift === 1 ? '' : 'n'} brauchen deine Aufmerksamkeit — Spalten oder Mapping haben sich geändert.
              </div>
            </div>
            <div className="ml-6 space-y-2">
              {report.drift.map(d => (
                <div
                  key={d.schemaId}
                  className="flex items-start justify-between gap-2 rounded border-[0.5px] border-amber-200 bg-white px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--tf-text)]">
                      <FileText size={12} className="text-amber-700" />
                      {d.schemaName}
                    </div>
                    <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">
                      {d.validation.missingFromCsv.length > 0
                        ? `${d.validation.missingFromCsv.length} Schema-Spalte${d.validation.missingFromCsv.length === 1 ? '' : 'n'} fehlt`
                        : null}
                      {d.validation.missingFromCsv.length > 0 && d.validation.newColumns.length > 0 ? ' · ' : ''}
                      {d.validation.newColumns.length > 0
                        ? `${d.validation.newColumns.length} neue Spalte${d.validation.newColumns.length === 1 ? '' : 'n'} in CSV`
                        : null}
                    </div>
                  </div>
                  {onOpenWizard ? (
                    <button
                      type="button"
                      onClick={onOpenWizard}
                      className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline cursor-pointer"
                    >
                      In CSV-Sources prüfen <ChevronRight size={12} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {onOpenWizard ? (
              <div className="ml-6 mt-2 text-[11px] text-amber-900">
                Öffne „Kuration → CSV-Sources" und nutze pro Quelle den Button „CSV Daten aktualisieren"
                oder „CSV neu wählen". Im Dialog siehst du die volle Drift-Analyse und kannst entscheiden,
                ob du die Datei trotzdem importierst (alte Mappings bleiben erhalten) oder das Schema neu registrierst.
              </div>
            ) : (
              <div className="ml-6 mt-2 text-[11px] text-amber-900">
                Bei diesen Quellen haben sich die Spalten geändert — das Spalten-Mapping kann nur der Kurator
                im CSV-Sources-Plugin anpassen. Bitte den Kurator informieren; die übrigen Quellen wurden normal
                aktualisiert.
              </div>
            )}
          </div>
        ) : null}

        {totalErrors > 0 ? (
          <div className="rounded-md border-[0.5px] border-red-300 bg-red-50 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-700" />
              <div className="text-[12.5px] font-medium text-red-900">
                {totalErrors} Quelle{totalErrors === 1 ? '' : 'n'} mit Fehler:
              </div>
            </div>
            <div className="ml-6 space-y-1">
              {report.errors.map(e => (
                <div key={e.schemaId} className="text-[11.5px] text-red-900">
                  <span className="font-medium">{e.schemaName}:</span> {e.message}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {totalDrift === 0 && totalErrors === 0 && totalProcessed > 0 ? (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Alle Quellen wurden ohne Probleme aktualisiert. Bestehende Mappings sind unverändert.
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
