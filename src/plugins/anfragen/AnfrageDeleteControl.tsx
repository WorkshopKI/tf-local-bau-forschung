/**
 * Wiederverwendbare Lösch-Kontrolle für eine Anfrage: Trash-Icon-Trigger →
 * Inline-Zwei-Schritt-Bestätigung (die App hat keinen AlertDialog; Muster wie
 * `csv-sources-kuration/CsvSourcesPage.tsx`). Async strikt über `useAsyncAction`
 * (Pitfall #15). `stopPropagation` ist eingebaut, damit Klicks nicht zusätzlich
 * die Zeilen-/Karten-Selektion auslösen — einsetzbar im Detail-Header wie auch
 * als Hover-Aktion in Liste/Tabelle/Karten.
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { RowAction } from '@/components/ui/RowAction';
import { useAnfragenStore } from './store';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
  /** Nach erfolgreichem Löschen (z.B. Detail schließen). */
  onDeleted?: () => void;
  /** Trash nur bei Hover über die umgebende `.group`-Zeile zeigen (Liste/
   *  Tabelle/Karten). Während der Bestätigung bleibt die Kontrolle sichtbar. */
  revealOnHover?: boolean;
}

export function AnfrageDeleteControl({ anfrage, onDeleted, revealOnHover }: Props): React.ReactElement {
  const storage = useStorage();
  const remove = useAnfragenStore(s => s.remove);
  const [confirming, setConfirming] = useState(false);

  const del = useAsyncAction(
    async () => {
      await remove(anfrage.id, storage);
      onDeleted?.();
    },
    { onSuccess: () => setConfirming(false) },
  );

  // Reveal-on-Hover nur im Idle-Zustand; bei aktiver Bestätigung immer sichtbar.
  const reveal = revealOnHover && !confirming;
  const rootCls = `inline-flex items-center${reveal ? ' opacity-0 group-hover:opacity-100 transition-opacity' : ''}`;

  return (
    <span className={rootCls} onClick={e => e.stopPropagation()}>
      {confirming ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--tf-text-secondary)] whitespace-nowrap">Löschen?</span>
          <button
            type="button"
            onClick={() => del.run()}
            disabled={del.busy}
            className="text-[11px] px-2 py-0.5 rounded-[var(--tf-radius)] bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            {del.busy ? 'Lösche…' : 'Ja, löschen'}
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); del.clearError(); }}
            className="text-[11px] px-2 py-0.5 rounded-[var(--tf-radius)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer transition-colors"
          >
            Abbrechen
          </button>
          {del.error && (
            <span className="text-[11px] text-[var(--tf-danger-text)]">Fehler: {del.error}</span>
          )}
        </span>
      ) : (
        <RowAction danger title="Anfrage löschen" onClick={() => setConfirming(true)}>
          <Trash2 size={14} />
        </RowAction>
      )}
    </span>
  );
}
