/**
 * Dev-Bereich: DMS-Quellen anlegen, verbinden, bearbeiten, loeschen.
 *
 * Sichtbar wenn `isDevInfraPanelEnabled() || import.meta.env.DEV`. Kurator
 * sieht die Section nicht — er nutzt nur die Aktivieren-Section weiter unten.
 */
import { useState } from 'react';
import { Plus, Pencil, Link as LinkIcon, Unlink, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  clearDmsSourceHandle,
  pickAndStoreDmsSourceHandle,
} from '@/core/services/infrastructure/smb-handle';
import {
  deleteDmsSource,
  type DmsSourceEntry,
  type DmsSourceHandleStatus,
} from '@/core/services/dms-sources';
import { SectionHeader } from '@/ui/SectionHeader';
import { SourceFormDialog, type SourceFormMode } from '../components/SourceFormDialog';

const STATUS_LABEL: Record<DmsSourceHandleStatus, { text: string; tone: 'ok' | 'warn' | 'danger' }> = {
  connected: { text: 'verbunden', tone: 'ok' },
  permission_lost: { text: 'Berechtigung verloren', tone: 'warn' },
  missing: { text: 'kein Handle', tone: 'danger' },
};

const TONE_BADGE: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  warn: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  danger: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
};

export interface VerwaltenSectionProps {
  sources: DmsSourceEntry[];
  handleStatus: Record<string, DmsSourceHandleStatus>;
  onChanged: () => Promise<void> | void;
}

export function VerwaltenSection({ sources, handleStatus, onChanged }: VerwaltenSectionProps): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();

  const [formMode, setFormMode] = useState<SourceFormMode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onConnect = async (s: DmsSourceEntry): Promise<void> => {
    setError(null);
    setBusyId(s.id);
    try {
      const r = await pickAndStoreDmsSourceHandle(storage.idb, s.id);
      if (!r.ok) {
        if (r.reason !== 'aborted') {
          setError(r.message ?? `Picker fehlgeschlagen: ${r.reason}`);
        }
        return;
      }
      await logAudit(storage.idb, {
        action: 'dms_source_handle_picked',
        user: session.kuratorName ?? undefined,
        details: { id: s.id, label: s.label },
      });
      await onChanged();
    } catch (e) {
      setError(`Verbinden fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const onDisconnect = async (s: DmsSourceEntry): Promise<void> => {
    setError(null);
    setBusyId(s.id);
    try {
      await clearDmsSourceHandle(storage.idb, s.id);
      await logAudit(storage.idb, {
        action: 'dms_source_handle_lost',
        user: session.kuratorName ?? undefined,
        details: { id: s.id, label: s.label, reason: 'manual_disconnect' },
      });
      await onChanged();
    } catch (e) {
      setError(`Trennen fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async (s: DmsSourceEntry): Promise<void> => {
    setError(null);
    setBusyId(s.id);
    try {
      await clearDmsSourceHandle(storage.idb, s.id);
      await deleteDmsSource(storage.idb, s.id);
      await logAudit(storage.idb, {
        action: 'dms_source_removed',
        user: session.kuratorName ?? undefined,
        details: { id: s.id, label: s.label },
      });
      setDeleteConfirmId(null);
      await onChanged();
    } catch (e) {
      setError(`Löschen fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label={`DMS-Quellen verwalten (${sources.length})`} />
        <Button size="sm" onClick={() => setFormMode({ kind: 'create' })}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Quelle hinzufügen
        </Button>
      </div>

      <p className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
        Konfiguration der verfügbaren DMS-Dokumentenpfade. Diese werden read-only
        gemountet. Kuratoren wählen weiter unten welche aktiv sind und stoßen
        die Indexierung an.
      </p>

      {error && (
        <div className="mb-3 rounded-md bg-[var(--tf-danger-bg)] px-3 py-2 text-[12px] text-[var(--tf-danger-text)]">
          {error}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="py-8 text-center text-[12.5px] text-[var(--tf-text-tertiary)]">
          Noch keine DMS-Quelle konfiguriert.
        </div>
      ) : (
        <ul className="space-y-2">
          {sources.map(s => {
            const status = handleStatus[s.id] ?? 'missing';
            const statusInfo = STATUS_LABEL[status];
            const isBusy = busyId === s.id;
            return (
              <li
                key={s.id}
                className="rounded-md p-3"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--tf-text)] truncate">
                        {s.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-medium ${TONE_BADGE[statusInfo.tone]}`}
                      >
                        {statusInfo.text}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)] font-mono">
                      {s.sub_roots.length === 0
                        ? 'Sub-Roots: (ganzer Handle)'
                        : `Sub-Roots: ${s.sub_roots.length}× (${s.sub_roots.slice(0, 3).map(p => p || '/').join(', ')}${s.sub_roots.length > 3 ? '…' : ''})`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setFormMode({ kind: 'edit', source: s })}
                      disabled={isBusy}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {status === 'missing' || status === 'permission_lost' ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void onConnect(s)}
                        disabled={isBusy}
                        title={status === 'permission_lost' ? 'Berechtigung erneuern' : 'Verbinden'}
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" />
                          : status === 'permission_lost' ? <RefreshCw className="h-3 w-3" />
                          : <LinkIcon className="h-3 w-3" />}
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void onDisconnect(s)}
                        disabled={isBusy}
                        title="Trennen"
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeleteConfirmId(s.id)}
                      disabled={isBusy}
                      title="Löschen"
                    >
                      <Trash2 className="h-3 w-3 text-[var(--tf-danger-text)]" />
                    </Button>
                  </div>
                </div>

                {deleteConfirmId === s.id && (
                  <div className="mt-2 rounded-md bg-[var(--tf-danger-bg)] px-3 py-2 text-[12px] text-[var(--tf-danger-text)]">
                    <p className="font-medium mb-2">
                      Quelle „{s.label}" wirklich löschen?
                    </p>
                    <p className="text-[11.5px] mb-2">
                      Bereits indexierte Manifest-Einträge bleiben bestehen, werden
                      aber nicht mehr aktualisiert. Der Handle wird getrennt.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => void onConfirmDelete(s)}
                        disabled={isBusy}
                      >
                        Ja, löschen
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isBusy}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {formMode && (
        <SourceFormDialog
          open={true}
          mode={formMode}
          onClose={() => setFormMode(null)}
          onSaved={async () => {
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
