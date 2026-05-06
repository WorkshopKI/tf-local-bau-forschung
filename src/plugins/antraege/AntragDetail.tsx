import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, CollapsibleSection } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getAntrag, getHistoryByAz, loadSchema, listSchemas } from '@/core/services/csv';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup } from './buildDisplayRows';
import { FieldHistoryModal } from './FieldHistoryModal';
import { AntragDokumenteSection } from './AntragDokumenteSection';
import { AntragstellerCard } from './AntragstellerCard';
import { WorkflowStepper } from './WorkflowStepper';
import { useAntraegeStore } from './store';

interface Props {
  aktenzeichen: string;
  onClose: () => void;
  onOpenVerbund: (verbundId: string) => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function AntragDetail({ aktenzeichen, onClose, onOpenVerbund }: Props): React.ReactElement {
  const storage = useStorage();
  const { verbuende } = useAntraegeStore();
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
      const allSchemas = await listSchemas(storage.idb, a.programm_id);
      if (cancelled) return;
      setSourceNames(names);
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
      <PanelShell onClose={onClose}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">Antrag {aktenzeichen} nicht gefunden.</div>
      </PanelShell>
    );
  }

  const titel = strOrNull(antrag.titel) ?? antrag.aktenzeichen;
  const akronym = strOrNull(antrag.akronym);
  const status = strOrNull(antrag.status);
  const frist = strOrNull(antrag.frist_datum);

  return (
    <PanelShell onClose={onClose}>
      {/* Header */}
      <div className="mb-5">
        <div className="text-[12px] text-[var(--tf-text-tertiary)] mb-0.5">
          Vorhaben{akronym ? `: ${akronym}` : ''} · <span className="font-mono">{antrag.aktenzeichen}</span>
        </div>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">{titel}</h1>
        <div className="mt-2 flex items-center gap-3 flex-wrap text-[12.5px]">
          {status ? (
            <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
          ) : null}
          {frist ? (
            <span className="text-[var(--tf-text-secondary)]">Frist {formatDate(frist)}</span>
          ) : null}
          {strOrNull(antrag.unterprogramm_id) ? (
            <span className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{antrag.unterprogramm_id}</span>
          ) : null}
        </div>
      </div>

      {verbund && verbund.teilantrags_ids.length > 1 ? (
        <div
          className="mb-5 p-3 rounded-lg"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13px]">
              Teil des Verbundes <strong>{verbund.akronym ?? verbund.verbund_id}</strong> ({verbund.teilantrags_ids.length} Teilanträge)
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpenVerbund(verbund.verbund_id)}>
              Verbund öffnen
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-5">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">Antragsteller</h3>
        <AntragstellerCard antrag={antrag} />
      </div>

      {status ? (
        <div className="mb-5">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">Status &amp; Workflow</h3>
          <WorkflowStepper status={status} />
        </div>
      ) : null}

      <div className="mb-5">
        <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="wichtig" preview />
      </div>

      <CollapsibleSection
        label="Alle Felder"
        subtitle={`${groups.reduce((n, g) => n + g.rows.length, 0)} Werte`}
        defaultOpen={false}
      >
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
      </CollapsibleSection>

      <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="sonstige" />

      <FieldHistoryModal aktenzeichen={aktenzeichen} feld={historyField} onClose={() => setHistoryField(null)} />
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
