/**
 * Monitor der Batch-Generierung: Zeile je Antrag mit Live-Status, Gesamt-
 * fortschritt, Pausieren/Fortsetzen/Abbrechen, Link zur Gutachten-Sektion.
 * KEINE Review-Queue/Facette — Entwürfe werden je Antrag über die Gutachten-
 * Sektion bearbeitet.
 */
import { Loader2, Check, ArrowRight } from 'lucide-react';
import type { BatchEintrag } from '@/core/services/gutachten-batch';
import type { UseBatchJob } from './useBatchJob';

interface Props {
  batch: UseBatchJob;
  onClose: () => void;
  onOpenAntrag: (fkz: string) => void;
}

function Status({ e }: { e: BatchEintrag }): React.ReactElement {
  switch (e.status) {
    case 'in_arbeit':
      return <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]"><Loader2 size={12} className="animate-spin" /> in Arbeit…</span>;
    case 'fertig':
      return <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-success-text)]"><Check size={12} /> {e.checkKurz ?? 'fertig'}</span>;
    case 'uebersprungen':
      return <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">übersprungen{e.grund ? `: ${e.grund}` : ''}</span>;
    case 'fehler':
      return <span className="text-[11.5px] text-[var(--tf-danger-text)]" title={e.fehlerText}>fehlgeschlagen{e.fehlerText ? `: ${e.fehlerText}` : ''}</span>;
    default:
      return <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">wartet</span>;
  }
}

export function BatchMonitor({ batch, onClose, onOpenAntrag }: Props): React.ReactElement | null {
  const job = batch.job;
  if (!job) return null;

  const terminal = (s: BatchEintrag['status']): boolean => s === 'fertig' || s === 'uebersprungen' || s === 'fehler';
  const done = job.eintraege.filter(e => terminal(e.status)).length;
  // Ein aus IDB geladener Job (hatFortsetzbaren) hat KEINEN aktiven Runner mehr
  // (z.B. nach Reload) → als fortsetzbar behandeln, nicht als „läuft".
  const aktivLaeuft = job.jobStatus === 'laeuft' && !batch.hatFortsetzbaren;
  const fortsetzbar = job.jobStatus === 'pausiert' || batch.hatFortsetzbaren;
  const fertig = job.jobStatus === 'fertig' || job.jobStatus === 'abgebrochen';

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Gutachten-Entwürfe</h2>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{done} von {job.eintraege.length}</span>
        {aktivLaeuft && <Loader2 size={13} className="animate-spin text-[var(--tf-text-tertiary)]" />}
      </div>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-4">
        {fertig ? 'Lauf beendet. Entwürfe je Antrag in der Gutachten-Sektion freigeben.' : 'Nur Entwürfe — Overlay geöffnet lassen.'}
      </p>

      {batch.error && (
        <div className="mb-3 rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>⚠ {batch.error}</div>
      )}

      <div className="mb-5 max-h-[50vh] overflow-y-auto">
        {job.eintraege.map(e => (
          <div key={e.aktenzeichen} className="flex items-center gap-3 py-2 border-b-[0.5px] border-[var(--tf-border)] last:border-b-0">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] shrink-0">{e.fkz}</span>
            <span className="text-[13px] text-[var(--tf-text)] truncate flex-1" title={e.titel}>{e.titel}</span>
            <Status e={e} />
            <button
              type="button"
              onClick={() => onOpenAntrag(e.fkz)}
              className="inline-flex items-center gap-0.5 text-[11.5px] text-[var(--tf-primary)] hover:underline shrink-0"
              title="Zur Gutachten-Sektion"
            >
              öffnen <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {aktivLaeuft && (
          <button type="button" onClick={batch.pause} className="px-4 py-2 rounded-lg text-[13.5px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)]">Pausieren</button>
        )}
        {fortsetzbar && (
          <button type="button" onClick={batch.fortsetzen} className="px-4 py-2 rounded-lg text-[13.5px] bg-[var(--tf-text)] text-[var(--tf-bg)]">Fortsetzen</button>
        )}
        {(aktivLaeuft || fortsetzbar) && (
          <button type="button" onClick={batch.abbrechenJob} className="text-[13px] text-[var(--tf-danger-text)] hover:underline">Abbrechen</button>
        )}
        {fertig && (
          <button type="button" onClick={() => batch.verwerfen()} className="text-[13px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">Lauf verwerfen</button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="text-[13px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">Schließen</button>
      </div>
    </div>
  );
}
