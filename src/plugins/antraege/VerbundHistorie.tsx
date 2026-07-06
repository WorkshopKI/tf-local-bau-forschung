/**
 * Verbund-Historie-Liste (aus `VerbundDetail` herausgelöst, Journey-Paket 2
 * Phase 7). Reine Anzeige der Feld-Änderungen (neueste zuerst); der Aufrufer
 * übergibt die bereits sortierte Liste.
 */
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { VerbundHistorieEntry } from '@/core/services/csv/types';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return iso;
  }
}

function str(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'string') return v;
  return String(v);
}

export function VerbundHistorie({ history }: { history: VerbundHistorieEntry[] }): React.ReactElement {
  if (history.length === 0) {
    return (
      <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
        Noch keine Verbund-Änderungen erfasst.
      </div>
    );
  }

  return (
    <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
      {history.map((h, i) => (
        <div
          key={h.id}
          className="px-3 py-2 text-[12.5px]"
          style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums">
              {formatDateTime(h.geaendert_am)}
            </span>
            <span className="font-medium text-[var(--tf-text)]">{getCanonicalLabel(h.feld)}</span>
            <span className="text-[var(--tf-text-tertiary)]">→</span>
          </div>
          <div className="mt-0.5 text-[12px]">
            <span className="font-mono line-through text-[var(--tf-text-tertiary)]">{str(h.alt_wert)}</span>
            <span className="mx-2 text-[var(--tf-text-tertiary)]">→</span>
            <span className="font-mono text-[var(--tf-text)]">{str(h.neu_wert)}</span>
          </div>
          {h.csv_schema_id ? (
            <div className="mt-0.5 text-[10.5px] text-[var(--tf-text-tertiary)] font-mono">
              Quelle: {h.csv_schema_id}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
