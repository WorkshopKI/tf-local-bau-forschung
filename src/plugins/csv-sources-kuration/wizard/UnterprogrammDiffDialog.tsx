import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DiffEntry {
  code: string;
  name?: string;
  impactRows: number;
}

interface Props {
  open: boolean;
  added: DiffEntry[];
  removed: DiffEntry[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnterprogrammDiffDialog({ open, added, removed, onConfirm, onCancel }: Props): React.ReactElement | null {
  if (!open) return null;
  const sumAdded = added.reduce((s, e) => s + e.impactRows, 0);
  const sumRemoved = removed.reduce((s, e) => s + e.impactRows, 0);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Unterprogramm-Auswahl hat sich geändert"
      className="max-w-[560px]"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onCancel}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={onConfirm}>Bestätigen und importieren</Button>
        </>
      }
    >
      <div className="text-[12.5px] text-[var(--tf-text-secondary)] mb-3">
        Diese Aktion kann nicht rückgängig gemacht werden. Löschungen entfernen auch Feld-Historie und räumen Verbünde auf.
      </div>

      {added.length > 0 ? (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Hinzugefügt ({added.length})
          </div>
          <ul className="text-[12.5px]">
            {added.map(e => (
              <li key={e.code} className="py-0.5">
                <span className="font-mono">{e.code}</span>
                {e.name ? <span className="text-[var(--tf-text-secondary)]"> — {e.name}</span> : null}
                <span className="text-[var(--tf-text-tertiary)]"> · {e.impactRows.toLocaleString('de-DE')} Zeilen werden neu importiert</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {removed.length > 0 ? (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Entfernt ({removed.length})
          </div>
          <ul className="text-[12.5px]">
            {removed.map(e => (
              <li key={e.code} className="py-0.5">
                <span className="font-mono">{e.code}</span>
                {e.name ? <span className="text-[var(--tf-text-secondary)]"> — {e.name}</span> : null}
                <span className="text-red-800"> · {e.impactRows.toLocaleString('de-DE')} Anträge werden gelöscht</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 pt-2 text-[12px] text-[var(--tf-text-secondary)]"
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        Zusammenfassung: <b>{sumAdded.toLocaleString('de-DE')}</b> neu /
        <b className="ml-1 text-red-800">{sumRemoved.toLocaleString('de-DE')}</b> gelöscht
      </div>
    </Dialog>
  );
}
