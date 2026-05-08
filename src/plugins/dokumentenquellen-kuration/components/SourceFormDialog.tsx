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
  /** Im Create-Mode: ID der bereits angelegten Source, sobald "Verzeichnis
   * auswaehlen" einmal erfolgreich war. Wird beim Speichern als Update-Target
   * verwendet, damit kein Duplikat entsteht. */
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on open + load existing handle in edit mode
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreatedSourceId(null);
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
  /** Effective ID: bei Edit die existierende, bei Create die seit dem ersten
   * Connect angelegte Source. */
  const effectiveId = editId ?? createdSourceId;

  const handleConnect = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      // Wenn wir noch keine Source-ID haben (Create-Mode, erster Connect),
      // legen wir die Source an. Default-Label = (kommt vom Picker, gleich
      // unten); falls der User schon manuell ein Label getippt hat, wird
      // dieses verwendet.
      let id = effectiveId;
      if (!id) {
        const created = await createDmsSource(storage.idb, {
          label: label.trim() || 'Neue DMS-Quelle',
          sub_roots: [],
          is_active: false,
          created_by: session.kuratorName ?? 'dev',
        });
        id = created.id;
        setCreatedSourceId(id);
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
        // Bei Create-Mode + Abort: die soeben angelegte Source bleibt ohne
        // Handle. Der Kurator kann den Picker erneut ausloesen.
        return;
      }
      setHandle(r.handle);
      // Auto-prefill Label mit dem Ordnernamen, wenn der User noch keines
      // getippt hat. So muss er im Standardfall nichts mehr eingeben — der
      // Ordnername ist meist gut genug.
      if (!label.trim()) {
        setLabel(r.handle.name);
        // Im Create-Mode auch den persistierten Eintrag updaten, damit der
        // Listen-Refresh nach onSaved() den richtigen Label sieht.
        if (isCreate) {
          try {
            await updateDmsSource(storage.idb, id, { label: r.handle.name });
          } catch { /* best-effort */ }
        }
      }
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
      if (effectiveId) {
        // Update-Pfad: greift sowohl im echten Edit-Mode als auch im
        // Create-Mode nach dem ersten Connect (createdSourceId gesetzt).
        const before = mode.kind === 'edit' ? mode.source : null;
        await updateDmsSource(storage.idb, effectiveId, {
          label: label.trim(),
          sub_roots: subRoots,
        });
        if (before && before.label !== label.trim()) {
          await logAudit(storage.idb, {
            action: 'dms_source_label_changed',
            user: session.kuratorName ?? undefined,
            details: { id: effectiveId, from: before.label, to: label.trim() },
          });
        }
        if (
          before
          && JSON.stringify(before.sub_roots) !== JSON.stringify(subRoots)
        ) {
          await logAudit(storage.idb, {
            action: 'dms_source_subroots_changed',
            user: session.kuratorName ?? undefined,
            details: { id: effectiveId, sub_roots: subRoots },
          });
        }
        onSaved(effectiveId);
      } else {
        // Create-Mode ohne Connect: Source ohne Handle anlegen.
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
          ? 'Verzeichnis auswählen, Label vergeben und optional Sub-Roots einschränken.'
          : 'Verbindung, Label und Sub-Roots bearbeiten.'
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
            1. Verzeichnis (read-only)
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleConnect()}
              disabled={busy}
            >
              {handle ? 'Anderen Ordner wählen' : 'Verzeichnis auswählen'}
            </Button>
            <span className="text-[12px] text-[var(--tf-text-secondary)] truncate">
              {handle
                ? `verbunden: ${(handle as FileSystemDirectoryHandle).name}`
                : 'nicht verbunden'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Der Browser-Picker fragt nur Lese-Rechte an. Chrome formuliert das als
            „eigene Kopien davon erstellen" — gemeint ist: die App liest Datei-Inhalte
            bei Bedarf in den Arbeitsspeicher (z. B. erste Seite eines PDFs für die
            Klassifikation). Es werden keine Dateien auf deine Festplatte kopiert,
            das DMS-Verzeichnis bleibt unverändert.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12.5px] font-medium text-[var(--tf-text)]">
            2. Label
          </label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={handle ? handle.name : 'z.B. DMS Hauptarchiv'}
          />
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            {handle
              ? 'Vor-belegt mit dem Ordnernamen. Du kannst es überschreiben, falls die Quelle in der Liste anders heißen soll.'
              : 'Anzeige-Name in der DMS-Quellen-Liste.'}
          </p>
        </div>

        {handle && (
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-[var(--tf-text)]">
              3. Sub-Roots (optional)
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
