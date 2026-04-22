import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { getAntrag, getHistoryByAz, loadSchema, listSchemas } from '@/core/services/csv';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup } from './buildDisplayRows';
import { FieldHistoryModal } from './FieldHistoryModal';
import { useAntraegeStore } from './store';

interface Props {
  aktenzeichen: string;
}

export function AntragDetail({ aktenzeichen }: Props): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const { verbuende } = useAntraegeStore();
  const backToList = (): void => navigate('/antraege');
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);
  const [antrag, setAntrag] = useState<Antrag | null>(null);
  const [historyCounts, setHistoryCounts] = useState<Record<string, number>>({});
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [historyField, setHistoryField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await getAntrag(storage.idb, aktenzeichen);
      if (cancelled) return;
      setAntrag(a);
      if (!a) return;
      const hist = await getHistoryByAz(storage.idb, aktenzeichen);
      const counts: Record<string, number> = {};
      for (const h of hist) counts[h.feld] = (counts[h.feld] ?? 0) + 1;
      if (cancelled) return;
      setHistoryCounts(counts);

      const ids = [...new Set(Object.values(a._field_sources ?? {}))];
      const names: Record<string, string> = {};
      const loadedSchemas: CsvSchema[] = [];
      for (const id of ids) {
        const s = await loadSchema(storage.idb, id);
        if (s) {
          names[id] = s.csv_source_name;
          loadedSchemas.push(s);
        }
      }
      // Alle Schemas des Programms laden (auch Nicht-Source-Schemas können group_path liefern)
      const allSchemas = await listSchemas(storage.idb, a.programm_id);
      if (cancelled) return;
      setSourceNames(names);
      // Merge ohne Duplikate
      const byId = new Map<string, CsvSchema>();
      for (const s of allSchemas) byId.set(s.id, s);
      for (const s of loadedSchemas) byId.set(s.id, s);
      setSchemas([...byId.values()]);
    })();
    return () => { cancelled = true; };
  }, [aktenzeichen, storage.idb]);

  const groups: DisplayGroup[] = useMemo(() => {
    if (!antrag) return [];
    const rows = buildDisplayRows(antrag);
    return groupDisplayRows(rows, schemas);
  }, [antrag, schemas]);

  const isGroupedView = groups.length > 1 || groups.some(g => g.path.length > 0);

  const verbund = useMemo(() => {
    if (!antrag || typeof antrag.verbund_id !== 'string') return null;
    return verbuende.find(v => v.verbund_id === antrag.verbund_id) ?? null;
  }, [antrag, verbuende]);

  if (!antrag) {
    return (
      <div className="p-6">
        <button
          onClick={backToList}
          className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4"
        >
          <ArrowLeft size={14} /> Alle Anträge
        </button>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">Antrag {aktenzeichen} nicht gefunden.</div>
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
            {typeof antrag.titel === 'string' && antrag.titel ? antrag.titel : antrag.aktenzeichen}
          </h1>
          <span className="font-mono text-[12px] text-[var(--tf-text-tertiary)]">{antrag.aktenzeichen}</span>
          {typeof antrag.akronym === 'string' && antrag.akronym ? (
            <span className="text-[12px] text-[var(--tf-text-secondary)]">{antrag.akronym}</span>
          ) : null}
        </div>
      </div>

      {verbund ? (
        <div
          className="mb-5 p-3 rounded-lg flex items-center justify-between"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="text-[13px]">
            Teil des Verbundes <strong>{verbund.akronym ?? verbund.verbund_id}</strong> ({verbund.teilantrags_ids.length} Teilanträge)
          </div>
          <Button size="sm" variant="outline" onClick={() => openVerbund(verbund.verbund_id)}>
            Verbund öffnen
          </Button>
        </div>
      ) : null}

      <div className="space-y-4">
        {groups.map(group => (
          <div
            key={group.label}
            className="overflow-hidden"
            style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}
          >
            {isGroupedView ? (
              <div
                className="px-3 py-2 text-[12.5px] font-medium text-[var(--tf-text)]"
                style={{ borderBottom: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
              >
                {group.label}
              </div>
            ) : null}
            <table className="w-full text-[13px]">
              <tbody>
                {group.rows.map((r, i) => (
                  <tr key={r.field} style={i > 0 ? { borderTop: '0.5px solid var(--tf-border)' } : undefined}>
                    <td className="p-3 align-top text-[var(--tf-text-secondary)] w-[220px]">{r.label}</td>
                    <td className="p-3 align-top">
                      <div>{r.value}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--tf-text-tertiary)]">
                        <span>Quelle: {r.sourceSchemaId ? (sourceNames[r.sourceSchemaId] ?? r.sourceSchemaId) : '—'}</span>
                        {historyCounts[r.field] ? (
                          <button
                            onClick={() => setHistoryField(r.field)}
                            className="text-[var(--tf-primary)] hover:underline"
                          >
                            ↻ {historyCounts[r.field]} {historyCounts[r.field] === 1 ? 'Änderung' : 'Änderungen'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <FieldHistoryModal aktenzeichen={aktenzeichen} feld={historyField} onClose={() => setHistoryField(null)} />
    </div>
  );
}
