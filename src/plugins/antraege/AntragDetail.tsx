import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getAntrag, getHistoryByAz, loadSchema, listSchemas } from '@/core/services/csv';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup } from './buildDisplayRows';
import { FieldHistoryModal } from './FieldHistoryModal';
import { AntragDokumenteSection } from './AntragDokumenteSection';
import { EckdatenCard } from './EckdatenCard';
import { KlassifikationPills } from './KlassifikationPills';
import { AlleFelderSection } from './AlleFelderSection';
import { WorkflowStepper } from './WorkflowStepper';
import { findFieldValue } from './fieldLookup';
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

function formatGermanDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return iso;
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
  const status = strOrNull(antrag.status);
  const eingang = strOrNull(antrag.antragsdatum);
  const foerdersumme = typeof antrag.foerdersumme === 'number' ? antrag.foerdersumme : null;
  const vorhabenInhalt = strOrNull(findFieldValue(antrag, ['vb_inhalt', 'vb inhalt', 'vorhaben_inhalt', 'vorhabeninhalt', 'beschreibung', 'kurzbeschreibung']));

  return (
    <PanelShell onClose={onClose}>
      {/* Header (full-width) */}
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-snug">{titel}</h1>
        <div className="mt-3 flex items-center gap-4 flex-wrap text-[12.5px]">
          {status ? (
            <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
          ) : null}
          {foerdersumme !== null && foerdersumme > 0 ? (
            <span className="text-[var(--tf-text-secondary)]">
              <span className="text-[var(--tf-text-tertiary)]">Fördersumme</span>{' '}
              {foerdersumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
          ) : null}
          {eingang ? (
            <span className="text-[var(--tf-text-secondary)]">
              <span className="text-[var(--tf-text-tertiary)]">Eingang</span> {formatGermanDate(eingang)}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2-column layout via Container Query: ab Panel-Breite >= 768 px 2-spaltig, sonst gestackt. */}
      <div className="@container">
        <div className="grid grid-cols-1 @3xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="min-w-0 space-y-6">
            {verbund && verbund.teilantrags_ids.length > 1 ? (
              <div
                className="p-3 rounded-lg"
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

            {vorhabenInhalt ? (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">Vorhaben-Inhalt</h3>
                <div
                  className="rounded-[var(--tf-radius)] p-4 text-[13px] leading-relaxed text-[var(--tf-text)] whitespace-pre-wrap"
                  style={{ background: 'var(--tf-bg-secondary)' }}
                >
                  {vorhabenInhalt}
                </div>
              </div>
            ) : null}

            {status ? (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">Status &amp; Workflow</h3>
                <WorkflowStepper status={status} />
              </div>
            ) : null}

            <KlassifikationPills antrag={antrag} />

            <AlleFelderSection
              groups={groups}
              schemas={schemas}
              sourceNames={sourceNames}
              historyCounts={historyCounts}
              onOpenHistory={setHistoryField}
            />

            <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="wichtig" preview />

            <AntragDokumenteSection aktenzeichen={aktenzeichen} variant="sonstige" />
          </div>

          <div className="min-w-0">
            <EckdatenCard antrag={antrag} />
          </div>
        </div>
      </div>

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
