/**
 * Drift-Sammelbericht nach Auto-Refresh-Lauf.
 *
 * Zeigt pro Quelle mit Spalten-Drift: welche Schema-Spalten fehlen in der
 * neuen CSV, welche neuen Spalten gibt es. Zwei Auswege stehen nebeneinander:
 *
 *  - **„Trotzdem importieren"** faehrt die Quelle mit den bisherigen Mappings —
 *    dieselbe Entscheidung, die der Kurator im Re-Import-Dialog schon hat, hier
 *    aber ohne Umweg. Die fehlenden Spalten werden dabei NICHT geheilt: der
 *    Merge baut jeden Antrag komplett neu auf, die betroffenen Felder werden
 *    also geleert, soweit keine andere Quelle sie traegt. Darum steht die
 *    Spaltenliste daneben und die Zustimmung gilt nur fuer diesen Lauf.
 *  - **„In CSV-Sources pruefen"** (nur Kurator) fuer die eigentliche Loesung:
 *    Mapping anpassen oder Schema neu registrieren.
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
  /**
   * Zweiter Anlauf fuer die genannten Quellen — der Nutzer nimmt die fehlenden
   * Spalten bewusst in Kauf. Fehlt der Handler, bleibt nur der Kurations-Weg.
   */
  onTrotzdemImportieren?: (schemaIds: string[]) => void;
}

export function CsvAutoRefreshDriftDialog({
  report,
  onClose,
  onOpenWizard,
  onTrotzdemImportieren,
}: Props): React.ReactElement {
  const totalProcessed = report.processed.length;
  const totalDrift = report.drift.length;
  const totalErrors = report.errors.length;
  // Quellen, bei denen der Auto-Refresh reine Zusatzspalten headless als
  // „ignoriert" übernommen hat (nicht-blockierend — sie stehen in `processed`).
  const autoAdopted = report.processed.filter(p => (p.autoAdoptedColumns?.length ?? 0) > 0);
  // Quellen, die in einem vorherigen Anlauf abgenickt wurden und jetzt drin sind.
  const uebergangen = report.processed.filter(p => (p.uebergangeneSpalten?.length ?? 0) > 0);
  // Quellen, deren Drift nur ein Encoding-Wechsel war — automatisch korrigiert.
  const encodingKorrigiert = report.processed.filter(p => p.korrigiertesEncoding);
  // Quellen, bei denen das Team dieselbe Nacht eine ANDERE Datei importiert hat.
  const divergenzen = report.divergenzen;
  // Quellen, deren Datei aelter ist als der Team-Stand — bewusst NICHT importiert.
  const veraltet = report.veraltet;

  const datum = (ms: number | null): string => ms == null
    ? 'unbekannt'
    : new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const bytes = (n: number | null): string => n == null ? '? Byte' : `${n.toLocaleString('de-DE')} Byte`;

  // Bewusst NICHT `onClose()`: das verwirft den Report und blendet den Banner aus
  // („dismissed"), sodass das Ergebnis des Nachlaufs niemand mehr saehe. Der
  // Aufrufer schliesst nur den Dialog und startet den Lauf.
  const trotzdem = (schemaIds: string[]): void => onTrotzdemImportieren?.(schemaIds);

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
              {totalProcessed === 1 ? ' wurde' : 'n wurden'} automatisch aktualisiert.
            </>
          ) : veraltet.length > 0 ? (
            <>Keine Quelle wurde importiert — die verknüpften Dateien sind älter als der Stand des Teams.</>
          ) : (
            <>Keine Quelle konnte automatisch aktualisiert werden.</>
          )}
        </div>

        {autoAdopted.length > 0 ? (
          <div className="rounded-md border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3 text-[11.5px] text-[var(--tf-text-secondary)]">
            <div className="space-y-0.5">
              {autoAdopted.map(p => (
                <div key={p.schemaId}>
                  <span className="font-medium text-[var(--tf-text)]">{p.schemaName}</span>:{' '}
                  {p.autoAdoptedColumns!.length} neue Spalte{p.autoAdoptedColumns!.length === 1 ? '' : 'n'} automatisch
                  als „ignoriert" übernommen. Bei Bedarf in „Datenpflege → CSV-Quellen" gezielt zuordnen.
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {encodingKorrigiert.length > 0 ? (
          <div className="rounded-md border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3 text-[11.5px] text-[var(--tf-text-secondary)]">
            <div className="space-y-0.5">
              {encodingKorrigiert.map(p => (
                <div key={p.schemaId}>
                  <span className="font-medium text-[var(--tf-text)]">{p.schemaName}</span>: Der
                  Export hat sein Encoding gewechselt — Schema auf{' '}
                  <span className="font-medium text-[var(--tf-text)]">{p.korrigiertesEncoding}</span>{' '}
                  korrigiert und normal importiert. Ohne die Korrektur wären alle Umlaute
                  verstümmelt worden.
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {veraltet.length > 0 ? (
          <div className="rounded-md border-[0.5px] border-red-300 bg-red-50 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-700" />
              <div className="text-[12.5px] font-medium text-red-900">
                {veraltet.length} Quelle{veraltet.length === 1 ? '' : 'n'} nicht importiert — die verknüpfte
                Datei ist älter als der Stand des Teams.
              </div>
            </div>
            <div className="ml-6 space-y-2">
              {veraltet.map(v => (
                <div key={v.schemaId} className="flex items-start justify-between gap-2 rounded border-[0.5px] border-red-200 bg-white px-2.5 py-2 text-[11px] text-red-900">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--tf-text)]">{v.schemaName}</div>
                    <div className="mt-0.5">
                      Deine Datei: <span className="font-mono">{v.datei.name}</span>{' '}
                      ({bytes(v.datei.size)}, {datum(v.datei.lastModified)}).
                    </div>
                    <div>
                      Das Team hat zuletzt importiert:{' '}
                      <span className="font-mono">{v.teamStempel.fileName ?? '?'}</span>{' '}
                      ({bytes(v.teamStempel.size)}, {datum(v.teamStempel.lastModified)}
                      {v.teamStempel.von ? `, von ${v.teamStempel.von}` : ''}).
                    </div>
                  </div>
                  {onTrotzdemImportieren ? (
                    <button
                      type="button"
                      onClick={() => trotzdem([v.schemaId])}
                      className="shrink-0 inline-flex items-center rounded border-[0.5px] border-red-300 bg-white px-2 py-1 text-[11.5px] text-red-900 hover:bg-red-100 cursor-pointer"
                    >
                      Trotzdem importieren
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="ml-6 mt-2 text-[11px] text-red-900">
              Ein Import dieser Datei würde den Stand des Teams auf ihr Datum zurücksetzen. Meist zeigt der
              verknüpfte CSV-Ordner auf eine alte Kopie — in „Einstellungen → Daten" den aktuellen
              Export-Ordner verknüpfen. „Trotzdem importieren" gilt nur für diesen Lauf.
            </div>
          </div>
        ) : null}

        {divergenzen.length > 0 ? (
          <div className="rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
              <div className="text-[12.5px] font-medium text-amber-900">
                {divergenzen.length} Quelle{divergenzen.length === 1 ? '' : 'n'} mit abweichender Datei — zwei
                Rechner lesen verschiedene Export-Kopien.
              </div>
            </div>
            <div className="ml-6 space-y-2">
              {divergenzen.map(d => (
                <div key={d.schemaId} className="rounded border-[0.5px] border-amber-200 bg-white px-2.5 py-2 text-[11px] text-amber-900">
                  <div className="text-[12px] font-medium text-[var(--tf-text)]">{d.schemaName}</div>
                  <div className="mt-0.5">
                    Das Team hat in derselben Nacht bereits importiert:{' '}
                    <span className="font-mono">{d.teamStempel.fileName ?? '?'}</span>{' '}
                    ({bytes(d.teamStempel.size)}, {datum(d.teamStempel.lastModified)}
                    {d.teamStempel.von ? `, von ${d.teamStempel.von}` : ''}).
                  </div>
                  <div>
                    Deine Datei: <span className="font-mono">{d.datei.name}</span>{' '}
                    ({bytes(d.datei.size)}, {datum(d.datei.lastModified)}) — der Import änderte{' '}
                    {d.geaenderteZeilen.toLocaleString('de-DE')} Zeile{d.geaenderteZeilen === 1 ? '' : 'n'}.
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-6 mt-2 text-[11px] text-amber-900">
              Gleicher Export, andere Bytes: meist eine andere Kopie (z.B. der Kopie-Ordner der App,
              eine mit Excel gespeicherte Datei) oder ein anderer Ordner nach einem Umzug. Solange zwei
              Rechner verschiedene Dateien lesen, importiert und veröffentlicht jeder den Stand des
              anderen erneut. Den verknüpften CSV-Ordner in „Einstellungen → Daten" prüfen.
            </div>
          </div>
        ) : null}

        {uebergangen.length > 0 ? (
          <div className="rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-3 text-[11.5px] text-amber-900">
            <div className="space-y-0.5">
              {uebergangen.map(p => (
                <div key={p.schemaId}>
                  <span className="font-medium">{p.schemaName}</span>: trotz{' '}
                  {p.uebergangeneSpalten!.length} fehlender Spalte
                  {p.uebergangeneSpalten!.length === 1 ? '' : 'n'} importiert — diese Felder sind
                  jetzt leer, soweit keine andere Quelle sie liefert. Dauerhafte Lösung: das
                  Mapping in „Datenpflege → CSV-Quellen" anpassen.
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                        ? `${d.validation.missingFromCsv.length} Schema-Spalte${d.validation.missingFromCsv.length === 1 ? ' fehlt' : 'n fehlen'}`
                        : null}
                      {d.validation.missingFromCsv.length > 0 && d.validation.newColumns.length > 0 ? ' · ' : ''}
                      {d.validation.newColumns.length > 0
                        ? `${d.validation.newColumns.length} neue Spalte${d.validation.newColumns.length === 1 ? '' : 'n'} in CSV`
                        : null}
                    </div>
                    {/* Namen statt nur Zahlen: ohne sie ist „Trotzdem importieren"
                        eine Blind-Zustimmung. */}
                    {d.validation.missingFromCsv.length > 0 ? (
                      <div className="mt-1 max-h-[64px] overflow-y-auto text-[10.5px] font-mono leading-snug text-amber-900">
                        {d.validation.missingFromCsv.join(', ')}
                      </div>
                    ) : null}
                    {/* Mehrdeutige Aliasgruppe: nicht „etwas fehlt", sondern „die
                        Zuordnung stimmt nicht mehr" — und dagegen hilft keine
                        Zustimmung, nur ein neues Mapping. */}
                    {d.validation.mehrdeutigeSpalten.length > 0 ? (
                      <div className="mt-1 text-[11px] leading-snug text-amber-900">
                        Der Export führt den Spaltennamen{' '}
                        <span className="font-mono">{d.validation.mehrdeutigeSpalten.join(', ')}</span>{' '}
                        jetzt unterschiedlich oft. Bei gleichnamigen Spalten entscheidet die
                        Reihenfolge, welche Spalte welches Feld füllt — diese Quelle muss über
                        „Spalten neu zuordnen" nachgezogen werden, sonst liest der Import
                        stillschweigend aus der falschen Spalte.
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {onTrotzdemImportieren && d.validation.mehrdeutigeSpalten.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => trotzdem([d.schemaId])}
                        className="inline-flex items-center rounded border-[0.5px] border-amber-300 bg-white px-2 py-1 text-[11.5px] text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        Trotzdem importieren
                      </button>
                    ) : null}
                    {onOpenWizard ? (
                      <button
                        type="button"
                        onClick={onOpenWizard}
                        className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline cursor-pointer"
                      >
                        In CSV-Sources prüfen <ChevronRight size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {onTrotzdemImportieren ? (
              <div className="ml-6 mt-2 rounded border-[0.5px] border-amber-200 bg-white px-2.5 py-2">
                <div className="text-[11px] text-amber-900">
                  <strong>Trotzdem importieren</strong> übernimmt die Datei mit den bisherigen
                  Zuordnungen. Die fehlenden Spalten liefert der Export nicht mehr — die davon
                  abhängigen Felder werden bei den betroffenen Anträgen <strong>geleert</strong>,
                  soweit keine andere Quelle sie mitliefert. Die Zustimmung gilt nur für diesen
                  Lauf und wird protokolliert.
                </div>
                {totalDrift > 1 ? (
                  <button
                    type="button"
                    onClick={() => trotzdem(report.drift.map(d => d.schemaId))}
                    className="mt-1.5 inline-flex items-center rounded border-[0.5px] border-amber-300 bg-white px-2 py-1 text-[11.5px] text-amber-900 hover:bg-amber-100 cursor-pointer"
                  >
                    Alle {totalDrift} trotzdem importieren
                  </button>
                ) : null}
              </div>
            ) : null}
            {onOpenWizard ? (
              <div className="ml-6 mt-2 text-[11px] text-amber-900">
                Öffne „Datenpflege → CSV-Quellen" und nutze pro Quelle den Button „CSV Daten aktualisieren"
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

        {totalDrift === 0 && totalErrors === 0 && uebergangen.length === 0
          && encodingKorrigiert.length === 0 && divergenzen.length === 0 && veraltet.length === 0
          && totalProcessed > 0 ? (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Alle Quellen wurden ohne Probleme aktualisiert. Bestehende Mappings sind unverändert.
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
