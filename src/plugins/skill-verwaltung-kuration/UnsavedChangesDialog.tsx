import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import type { LeaveGuardDialogProps } from './editorGuard';

/**
 * Nachfrage beim Verlassen eines Editors mit ungespeicherten Änderungen
 * (Skill-Verwaltung). Drei Optionen — daher der gestylte Dialog statt
 * `window.confirm` (das nur OK/Abbrechen kann).
 */
export function UnsavedChangesDialog({ open, busy, error, onSave, onDiscard, onCancel }: LeaveGuardDialogProps): React.ReactElement {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="sm"
      dismissOnOverlayClick={false}
      title="Ungespeicherte Änderungen"
      description="Die aktuelle Bearbeitung hat ungespeicherte Änderungen. Möchten Sie sie speichern, bevor Sie wechseln?"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDiscard}
            className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50"
          >
            Verwerfen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      )}
    >
      {error && <Alert variant="danger">⚠ {error}</Alert>}
    </Dialog>
  );
}
