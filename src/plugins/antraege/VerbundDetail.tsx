import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund } from '@/core/services/csv';
import type { Antrag, Verbund } from '@/core/services/csv/types';

interface Props {
  verbundId: string;
}

export function VerbundDetail({ verbundId }: Props): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const backToList = (): void => navigate('/antraege');
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      setVerbund(v);
      setAntraege(a.sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen)));
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb]);

  if (!verbund) {
    return (
      <div className="p-6">
        <button
          onClick={backToList}
          className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4"
        >
          <ArrowLeft size={14} /> Alle Anträge
        </button>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">Verbund {verbundId} nicht gefunden.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={backToList}
        className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4"
      >
        <ArrowLeft size={14} /> Alle Anträge
      </button>

      <div className="mb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">
            Verbund {verbund.akronym ?? verbund.verbund_id}
          </h1>
          <span className="font-mono text-[12px] text-[var(--tf-text-tertiary)]">{verbund.verbund_id}</span>
          {verbund.status ? (
            <span className="px-2 py-0.5 rounded-full text-[11.5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">
              VB-Status: {verbund.status}
            </span>
          ) : null}
        </div>
        {verbund.titel ? <div className="mt-1 text-[13px] text-[var(--tf-text-secondary)]">{verbund.titel}</div> : null}
        <div className="mt-1 text-[12px] text-[var(--tf-text-tertiary)]">
          {antraege.length} Teilanträge
        </div>
      </div>

      <div className="overflow-hidden" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}>
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
                onClick={() => openAntrag(a.aktenzeichen)}
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
    </div>
  );
}

function str(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'string') return v;
  return String(v);
}
