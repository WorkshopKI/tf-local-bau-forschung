/**
 * Liste der registrierten CSV-Schemas (Konsolidierung 2026-07 aus CsvSourcesPage.tsx
 * extrahiert). Rendert pro Schema eine Zeile mit Meta + Update-Hinweis und die
 * Aktionen (Daten aktualisieren / Spalten neu mappen / CSV neu wählen / löschen).
 * Hält den Inline-Lösch-Bestätigungs-Zustand selbst; die eigentlichen Aktionen
 * laufen über Callbacks im Container.
 *
 * FS-API-Geste (Bug-Klasse 2): `onAutoUpdate`/`onReselect` werden direkt im
 * Klick-Handler des Buttons aufgerufen — der Container-Handler ruft dann synchron
 * den Datei-/Handle-Zugriff. Diese Kette NICHT durch zusätzliche Async-Hops trennen.
 */
import { RefreshCw, Trash2, Sparkles, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { CsvSchema } from '@/core/services/csv/types';
import type { UpdateCheckResult } from './csv-source-handle';

export interface SourceListProps {
  schemas: CsvSchema[];
  sessionActive: boolean;
  updateChecks: Record<string, UpdateCheckResult>;
  /** Inline-Lösch-Bestätigung: liegt im Container, damit `onConfirmDelete` das
   *  Flag erst NACH dem Löschen zurücksetzt (Timing wie vor der Extraktion). */
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  onOpenDetail: (schema: CsvSchema) => void;
  onAutoUpdate: (schema: CsvSchema) => void;
  onRemap: (schema: CsvSchema) => void;
  onReselect: (schema: CsvSchema) => void;
  onConfirmDelete: (schema: CsvSchema) => void;
}

export function SourceList(props: SourceListProps): React.ReactElement {
  const {
    schemas, sessionActive, updateChecks, deleteConfirmId, setDeleteConfirmId,
    onOpenDetail, onAutoUpdate, onRemap, onReselect, onConfirmDelete,
  } = props;

  return (
    <>
      <SectionHeader label={`Registrierte Schemas (${schemas.length})`} />

      {schemas.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch keine CSV-Source registriert.
        </div>
      ) : (
        <div>
          {schemas.sort((a, b) => b.priority - a.priority).map((s, i) => {
            const isConfirming = deleteConfirmId === s.id;
            const update = updateChecks[s.id];
            const hasUpdate = update?.state === 'update_available';
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetail(s)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDetail(s);
                  }
                }}
                className="flex items-center justify-between py-3 px-2 -mx-2 rounded-md cursor-pointer hover:bg-[var(--tf-bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]"
                style={i === schemas.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-[var(--tf-text)] flex items-center gap-2">
                    {s.csv_source_name}
                    {s.is_master ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-800">Master</span> : null}
                  </div>
                  <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                    <span className="font-mono">{s.id}</span> · join={s.join_key} · priority={s.priority}
                    {s.last_imported_at ? ` · letzter Import ${new Date(s.last_imported_at).toLocaleString('de-DE')}` : ''}
                    {typeof s.last_row_count === 'number' ? ` · ${s.last_row_count} Zeilen` : ''}
                    {hasUpdate && update.state === 'update_available' ? (
                      <>
                        {' · '}
                        <span
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ color: 'var(--tf-primary)' }}
                        >
                          <Sparkles size={11} />
                          neue CSV vom {new Date(update.lastModified).toLocaleString('de-DE')}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {isConfirming ? (
                  <div
                    className="flex items-center gap-2 max-w-[60%]"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[11.5px] text-[var(--tf-text-secondary)] text-right">
                      Schema dauerhaft löschen?<br />
                      Re-Import-Konfiguration geht verloren. Die Felder dieser Quelle fallen
                      aus den Anträgen; Anträge, die nur sie trug, werden entfernt.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={e => { e.stopPropagation(); onConfirmDelete(s); }}
                    >
                      Endgültig löschen
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={e => { e.stopPropagation(); if (hasUpdate) onAutoUpdate(s); }}
                      disabled={!sessionActive || !hasUpdate}
                      title={
                        hasUpdate && update.state === 'update_available'
                          ? `Neuere Version vom ${new Date(update.lastModified).toLocaleString('de-DE')} importieren`
                          : update?.state === 'local_fixture'
                            ? 'Dev-Test-Fixture (docs/fixtures) — keine externe Quelle zum Aktualisieren'
                            : update?.state === 'no_handle'
                            ? "Noch keine Quelldatei registriert — einmal 'CSV neu wählen' nutzen, damit Auto-Update aktiv wird"
                            : update?.state === 'permission_required'
                              ? "Datei-Zugriff nicht erlaubt — 'CSV neu wählen' nutzen, um die Quelldatei neu zuzuweisen"
                              : update?.state === 'file_missing'
                                ? "Quelldatei am alten Speicherort nicht gefunden — 'CSV neu wählen' nutzen"
                                : "Keine neuere Version am Ablageort erkannt"
                      }
                    >
                      <Sparkles size={13} /> CSV Daten aktualisieren
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); onRemap(s); }}
                      disabled={!sessionActive || !s.last_imported_at}
                      title={
                        s.last_imported_at
                          ? 'Spalten der gespeicherten CSV neu zuordnen (z.B. Eigenes Feld → Standardfeld) — ohne Datei neu zu wählen'
                          : 'Noch kein Import — zuerst „CSV neu wählen" nutzen'
                      }
                    >
                      <Columns3 size={13} /> Spalten neu mappen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); onReselect(s); }}
                      disabled={!sessionActive}
                      title="Andere CSV-Datei wählen — z.B. wenn die Datei an einem neuen Ort liegt"
                    >
                      <RefreshCw size={13} /> CSV neu wählen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                      disabled={!sessionActive}
                      title="Schema löschen"
                      aria-label="Schema löschen"
                      className="h-8 w-8 p-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
