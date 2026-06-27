import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onDiscard}
            className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
          >
            Verwerfen
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            onClick={onSave}
          >
            Speichern
          </Button>
        </div>
      )}
    >
      {error && <Alert variant="danger">⚠ {error}</Alert>}
    </Dialog>
  );
}
