import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund, getVerbundHistoryByVerbund } from '@/core/services/csv';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { Antrag, Verbund, VerbundHistorieEntry } from '@/core/services/csv/types';

interface Props {
  verbundId: string;
  onClose: () => void;
  onOpenAntrag: (aktenzeichen: string) => void;
}

export function VerbundDetail({ verbundId, onClose, onOpenAntrag }: Props): React.ReactElement {
  const storage = useStorage();
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [history, setHistory] = useState<VerbundHistorieEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      const h = await getVerbundHistoryByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      setVerbund(v);
      setAntraege(a.sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen)));
      setHistory(h.sort((x, y) => y.geaendert_am.localeCompare(x.geaendert_am)));
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb]);

  if (!verbund) {
    return (
      <PanelShell onClose={onClose}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">Verbund {verbundId} nicht gefunden.</div>
      </PanelShell>
    );
  }

  return (
    <PanelShell onClose={onClose}>
      <div className="mb-5">
        <div className="text-[12px] text-[var(--tf-text-tertiary)] mb-0.5">
          Verbund · <span className="font-mono">{verbund.verbund_id}</span>
        </div>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">
          {verbund.akronym ?? verbund.verbund_id}
        </h1>
        <div className="mt-2 flex items-center gap-3 flex-wrap text-[12.5px]">
          {verbund.status ? (
            <span className="px-2 py-0.5 rounded-full text-[11.5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">
              {verbund.status}
            </span>
          ) : null}
          <span className="text-[var(--tf-text-tertiary)]">{antraege.length} Teilanträge</span>
        </div>
        {verbund.titel ? <div className="mt-2 text-[13px] text-[var(--tf-text-secondary)]">{verbund.titel}</div> : null}
      </div>

      <div className="overflow-hidden mb-6" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              <th className="p-3">Aktenzeichen</th>
              <th className="p-3">Titel</th>
              <th className="p-3">Antragsteller</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {antraege.map(a => (
              <tr
                key={a.aktenzeichen}
                className="cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                style={{ borderTop: '0.5px solid var(--tf-border)' }}
                onClick={() => onOpenAntrag(a.aktenzeichen)}
              >
                <td className="p-3 font-mono text-[12px]">{a.aktenzeichen}</td>
                <td className="p-3 max-w-[400px] truncate">{str(a.titel)}</td>
                <td className="p-3">{str(a.antragsteller)}</td>
                <td className="p-3">{str(a.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
          Verbund-Historie
        </h2>
        {history.length === 0 ? (
          <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
            Noch keine Verbund-Änderungen erfasst.
          </div>
        ) : (
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
        )}
      </div>
    </PanelShell>
  );
}

function PanelShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      <div className="sticky top-0 z-10 flex justify-end px-4 pt-3 pb-1 bg-[var(--tf-bg)]">
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          aria-label="Detail schließen"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 pb-8">{children}</div>
    </div>
  );
}

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
