import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Unterprogramm } from '@/core/services/csv/types';

interface Props {
  pending: { up: Unterprogramm; nextAktiv: boolean } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AktivConfirmDialog({ pending, onCancel, onConfirm }: Props): React.ReactElement | null {
  if (!pending) return null;
  const { up, nextAktiv } = pending;
  const count = up.antrag_count_cached ?? 0;

  return (
    <Dialog
      open={true}
      onClose={onCancel}
      title={nextAktiv ? 'Unterprogramm aktivieren?' : 'Unterprogramm deaktivieren?'}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onCancel}>Abbrechen</Button>
          <Button size="sm" variant={nextAktiv ? 'default' : 'destructive'} onClick={onConfirm}>
            {nextAktiv ? 'Aktivieren' : 'Deaktivieren'}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-[var(--tf-text-secondary)]">
        <div className="mb-2">
          <span className="font-mono">{up.code}</span>
          {up.name ? <span> — {up.name}</span> : null}
        </div>
        {nextAktiv ? (
          <p>
            Beim nächsten Re-Import der Master-CSV werden Anträge dieses Unterprogramms neu importiert.
            Solange nicht neu importiert wird, bleibt der Bestand unverändert.
          </p>
        ) : (
          <p>
            <strong>{count.toLocaleString('de-DE')} Anträge</strong> werden beim nächsten Re-Import der Master-CSV gelöscht
            — inklusive Feld-Historie und Verbund-Referenzen.
            Die Änderung wird erst mit dem nächsten Import wirksam.
          </p>
        )}
      </div>
    </Dialog>
  );
}
