/**
 * Add/Edit-Dialog fuer eine DMS-Source.
 *
 * Im Create-Mode wird die Source erst nach Klick auf "Anlegen" persistiert,
 * danach kann optional gleich der Picker angeworfen werden. Sub-Roots werden
 * nur im Edit-Mode angeboten — sie brauchen einen verbundenen Handle.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createDmsSource,
  updateDmsSource,
  type DmsSourceEntry,
} from '@/core/services/dms-sources';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  getDmsSourceHandle,
  pickAndStoreDmsSourceHandle,
} from '@/core/services/infrastructure/smb-handle';
import { SubRootsTreePicker } from './SubRootsTreePicker';

export type SourceFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; source: DmsSourceEntry };

export interface SourceFormDialogProps {
  open: boolean;
  mode: SourceFormMode;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function SourceFormDialog({ open, mode, onClose, onSaved }: SourceFormDialogProps): React.ReactElement | null {
  const storage = useStorage();
  const session = useKuratorSession();

  const [label, setLabel] = useState('');
  const [subRoots, setSubRoots] = useState<string[]>([]);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on open + load existing handle in edit mode
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode.kind === 'edit') {
      setLabel(mode.source.label);
      setSubRoots(mode.source.sub_roots);
      void getDmsSourceHandle(storage.idb, mode.source.id).then(setHandle);
    } else {
      setLabel('');
      setSubRoots([]);
      setHandle(null);
    }
  }, [open, mode, storage.idb]);

  if (!open) return null;

  const isCreate = mode.kind === 'create';
  const editId = mode.kind === 'edit' ? mode.source.id : null;

  const handleConnect = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      // Wenn wir noch keine Source-ID haben (Create-Mode), erst anlegen.
      let id = editId;
      if (!id) {
        const created = await createDmsSource(storage.idb, {
          label: label.trim() || 'Neue DMS-Quelle',
          sub_roots: [],
          is_active: false,
          created_by: session.kuratorName ?? 'dev',
        });
        id = created.id;
        await logAudit(storage.idb, {
          action: 'dms_source_added',
          user: session.kuratorName ?? undefined,
          details: { id, label: created.label },
        });
      }
      const r = await pickAndStoreDmsSourceHandle(storage.idb, id);
      if (!r.ok) {
        if (r.reason !== 'aborted') {
          setError(r.message ?? `Picker fehlgeschlagen: ${r.reason}`);
        }
        // Bei Create-Mode + Abort: die soeben angelegte Source wieder loeschen?
        // Nein — der Kurator kann sie auch ohne Handle behalten und spaeter verbinden.
        return;
      }
      setHandle(r.handle);
      await logAudit(storage.idb, {
        action: 'dms_source_handle_picked',
        user: session.kuratorName ?? undefined,
        details: { id },
      });
      // Wenn wir frisch angelegt haben, Caller informieren damit die Liste sich refresht.
      if (isCreate) {
        onSaved(id);
      }
    } catch (e) {
      setError(`Verbinden fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!label.trim()) {
      setError('Label darf nicht leer sein.');
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        const before = mode.kind === 'edit' ? mode.source : null;
        await updateDmsSource(storage.idb, editId, {
          label: label.trim(),
          sub_roots: subRoots,
        });
        if (before && before.label !== label.trim()) {
          await logAudit(storage.idb, {
            action: 'dms_source_label_changed',
            user: session.kuratorName ?? undefined,
            details: { id: editId, from: before.label, to: label.trim() },
          });
        }
        if (
          before
          && JSON.stringify(before.sub_roots) !== JSON.stringify(subRoots)
        ) {
          await logAudit(storage.idb, {
            action: 'dms_source_subroots_changed',
            user: session.kuratorName ?? undefined,
            details: { id: editId, sub_roots: subRoots },
          });
        }
        onSaved(editId);
      } else {
        const created = await createDmsSource(storage.idb, {
          label: label.trim(),
          sub_roots: subRoots,
          is_active: false,
          created_by: session.kuratorName ?? 'dev',
        });
        await logAudit(storage.idb, {
          action: 'dms_source_added',
          user: session.kuratorName ?? undefined,
          details: { id: created.id, label: created.label },
        });
        onSaved(created.id);
      }
      onClose();
    } catch (e) {
      setError(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isCreate ? 'Neue DMS-Quelle' : 'DMS-Quelle bearbeiten'}
      description={
        isCreate
          ? 'Quelle anlegen, dann Verzeichnis verbinden und optional Sub-Roots wählen.'
          : 'Label, Sub-Roots und Verbindung bearbeiten.'
      }
      dismissOnOverlayClick={false}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || !label.trim()}>
            {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isCreate ? 'Anlegen' : 'Speichern'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[12.5px] font-medium text-[var(--tf-text)]">
            Label
          </label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="z.B. DMS Hauptarchiv"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12.5px] font-medium text-[var(--tf-text)]">
            Verzeichnis (read-only)
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleConnect()}
              disabled={busy}
            >
              {handle ? 'Erneut verbinden' : 'Verzeichnis auswählen'}
            </Button>
            <span className="text-[12px] text-[var(--tf-text-secondary)]">
              {handle
                ? `verbunden: ${(handle as FileSystemDirectoryHandle).name}`
                : 'nicht verbunden'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Der Browser-Picker fragt nur Lese-Rechte an („Dateien lesen").
            Es wird nie in das Verzeichnis geschrieben.
          </p>
        </div>

        {!isCreate && (
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-[var(--tf-text)]">
              Sub-Roots (optional)
            </label>
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              Auswahl einschränken auf bestimmte Unterverzeichnisse. Leer =
              ganzes Verzeichnis wird gescannt.
            </p>
            <SubRootsTreePicker
              handle={handle}
              value={subRoots}
              onChange={setSubRoots}
              onError={msg => setError(msg)}
            />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[var(--tf-danger-bg)] px-3 py-2 text-[12px] text-[var(--tf-danger-text)]">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
