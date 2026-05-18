import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getVerbund,
  listAntraegeByVerbund,
  getVerbundHistoryByVerbund,
  loadSchema,
  listSchemas,
  formatGermanDate,
} from '@/core/services/csv';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { Antrag, Verbund, VerbundHistorieEntry, CsvSchema } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { dominantStatus, sumFoerdersumme } from './groupAggregates';
import { isNetzwerkLead } from './netzwerk';
import { FieldHistoryModal } from './FieldHistoryModal';
import { VerbundAlleFelder } from './VerbundAlleFelder';

interface Props {
  verbundId: string;
  onClose: () => void;
  onOpenAntrag: (aktenzeichen: string) => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function strOrNumOrNull(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof v === 'number') return String(v);
  return null;
}

function formatEuro(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/** TV-Rolle für die TEILVORHABEN-Anzeige. Heuristik:
 *  - Netzwerk-Lead (Suffix 01/02 + vb_phase 1/2) → Konsortialführer
 *  - Erster TV in der Lead-First-Sortierung, falls kein expliziter Netzwerk-Lead → Konsortialführer
 *  - Alle anderen → Verbundpartner */
function tvRolle(tv: Antrag, idx: number, sorted: Antrag[]): string {
  if (isNetzwerkLead(tv)) return 'Konsortialführer';
  const anyLead = sorted.some(t => isNetzwerkLead(t));
  if (!anyLead && idx === 0) return 'Konsortialführer';
  return 'Verbundpartner';
}

export function VerbundDetail({ verbundId, onClose, onOpenAntrag }: Props): React.ReactElement {
  const storage = useStorage();
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [history, setHistory] = useState<VerbundHistorieEntry[]>([]);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [historyField, setHistoryField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      const h = await getVerbundHistoryByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      setVerbund(v);
      // Lead-First-Sort: Netzwerk-Lead-TVs (Suffix 01/02 + vb_phase 1/2) zuerst,
      // dann nach Aktenzeichen aufsteigend. Stabilisiert die TV-Reihenfolge in
      // der Liste und die "TV 1 = Konsortialführer"-Heuristik.
      const sorted = [...a].sort((x, y) => {
        const xLead = isNetzwerkLead(x);
        const yLead = isNetzwerkLead(y);
        if (xLead !== yLead) return xLead ? -1 : 1;
        return x.aktenzeichen.localeCompare(y.aktenzeichen);
      });
      setAntraege(sorted);
      setHistory(h.sort((x, y) => y.geaendert_am.localeCompare(x.geaendert_am)));

      // Schemas + Source-Names für die ALLE-FELDER-Section vorbereiten
      // (analog zu AntragDetail.tsx). Source-Tracking holt sich `mergeAntraegeForDisplay`
      // aus dem Lead-TV; die Schema-Liste umfasst alle Schemas des Programms,
      // damit Custom-Felder aus secondary CSVs auch ihre Gruppen-Pfade finden.
      if (sorted.length > 0 && !cancelled) {
        const lead = sorted[0]!;
        const ids = new Set<string>();
        for (const tv of sorted) {
          for (const sid of Object.values(tv._field_sources ?? {})) ids.add(sid);
        }
        const names: Record<string, string> = {};
        const loaded: CsvSchema[] = [];
        for (const id of ids) {
          const s = await loadSchema(storage.idb, id);
          if (s) {
            names[id] = s.csv_source_name;
            loaded.push(s);
          }
        }
        const all = await listSchemas(storage.idb, lead.programm_id);
        if (cancelled) return;
        const byId = new Map<string, CsvSchema>();
        for (const s of all) byId.set(s.id, s);
        for (const s of loaded) byId.set(s.id, s);
        setSourceNames(names);
        setSchemas([...byId.values()]);
      }
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb]);

  const historyCounts = useMemo<Record<string, number>>(() => ({}), []);

  if (!verbund) {
    return (
      <PanelShell onClose={onClose}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">Verbund {verbundId} nicht gefunden.</div>
      </PanelShell>
    );
  }

  const lead = antraege[0];
  const verbundStatus = strOrNull(verbund.status);
  const displayStatus = verbundStatus ?? dominantStatus(antraege, null);
  const akronym = strOrNull(verbund.akronym) ?? strOrNull(lead?.akronym) ?? verbund.verbund_id;
  const titel = strOrNull(verbund.titel) ?? strOrNull(lead?.titel);
  const antragsteller = strOrNull(lead?.antragsteller);
  const programm = strOrNull(lead?.foerdergeber) ?? lead?.programm_id ?? null;
  const antragsdatum = strOrNull(lead?.antragsdatum);
  const foerdersumme = sumFoerdersumme(antraege as ReadonlyArray<Record<string, unknown>>);

  return (
    <PanelShell onClose={onClose}>
      {/* Header-Block: Status-Pill, Akronym, Untertitel */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {displayStatus ? (
            <Badge variant={getStatusVariant(displayStatus)}>
              {getStatusLabel(displayStatus)}
            </Badge>
          ) : null}
          <span className="text-[12px] text-[var(--tf-text-tertiary)] font-mono">{verbund.verbund_id}</span>
        </div>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">{akronym}</h1>
        {titel ? <div className="mt-1 text-[14px] text-[var(--tf-text-secondary)]">{titel}</div> : null}
      </div>

      {/* STAMMDATEN */}
      <div
        className="rounded-[var(--tf-radius)] p-4 mb-6"
        style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
      >
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-3">Stammdaten</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <KeyVal label="Antragsteller" value={antragsteller ?? '—'} />
          <KeyVal label="Programm" value={programm ?? '—'} />
          <KeyVal
            label="Antragsdatum"
            value={antragsdatum ? formatGermanDate(antragsdatum) : '—'}
          />
          <KeyVal label="Fördervolumen (geplant)" value={formatEuro(foerdersumme)} />
          <KeyVal label="Förderkennzeichen" value={verbund.verbund_id} mono />
          <KeyVal
            label="Verbund"
            value={`${antraege.length} ${antraege.length === 1 ? 'Teilvorhaben' : 'Teilvorhaben'}`}
          />
        </div>
      </div>

      {/* TEILVORHABEN */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
            Teilvorhaben
          </h3>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">·</span>
          <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{antraege.length}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {antraege.map((tv, idx) => {
            const tvAntragsteller = strOrNull(tv.antragsteller) ?? '—';
            const tvTitel = strOrNull(tv.titel);
            const tvStatus = strOrNull(tv.status);
            const tvFoerder = strOrNumOrNull(tv.foerdersumme);
            const foerderN = tvFoerder !== null ? Number(String(tvFoerder).replace(/\./g, '').replace(',', '.')) : null;
            const rolle = tvRolle(tv, idx, antraege);
            return (
              <button
                type="button"
                key={tv.aktenzeichen}
                onClick={() => onOpenAntrag(tv.aktenzeichen)}
                className="w-full text-left rounded-[var(--tf-radius)] px-3 py-2 hover:bg-[var(--tf-bg-secondary)] transition-colors"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] tabular-nums w-8 pt-0.5">
                    TV {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--tf-text)] truncate" title={tvAntragsteller}>
                      {tvAntragsteller}
                    </div>
                    <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                      {rolle} · <span className="font-mono">{tv.aktenzeichen}</span>
                      {foerderN !== null ? <> · {formatEuro(foerderN)}</> : null}
                    </div>
                    {tvTitel ? (
                      <div className="text-[11.5px] text-[var(--tf-text-secondary)] mt-0.5 truncate" title={tvTitel}>
                        {tvTitel}
                      </div>
                    ) : null}
                  </div>
                  {tvStatus ? (
                    <Badge
                      variant={getStatusVariant(tvStatus)}
                      className="shrink-0 min-w-[100px] justify-center whitespace-nowrap"
                    >
                      {getStatusLabel(tvStatus)}
                    </Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ALLE FELDER (Verbund-Aggregat) */}
      {antraege.length > 0 ? (
        <div className="mt-6 pt-6" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <VerbundAlleFelder
            tvs={antraege}
            schemas={schemas}
            sourceNames={sourceNames}
            historyCounts={historyCounts}
            onOpenHistory={setHistoryField}
          />
        </div>
      ) : null}

      {/* Verbund-Historie */}
      <div className="mt-6 pt-6" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
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

      {/* Field-History-Modal (geteilt mit AntragDetail). Greift auf
          aktenzeichen-basiertes History-Store zu — für Verbund-Felder erst
          mal nicht über alle TVs aggregiert (Folgepatch). */}
      {lead ? (
        <FieldHistoryModal
          aktenzeichen={lead.aktenzeichen}
          feld={historyField}
          onClose={() => setHistoryField(null)}
        />
      ) : null}
    </PanelShell>
  );
}

interface KeyValProps {
  label: string;
  value: string;
  mono?: boolean;
}

function KeyVal({ label, value, mono = false }: KeyValProps): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">
        {label}
      </div>
      <div className={`text-[12.5px] text-[var(--tf-text)] truncate ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
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
