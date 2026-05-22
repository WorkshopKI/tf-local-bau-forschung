import { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getAntrag,
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
import { WorkflowStepper } from './WorkflowStepper';
import { TvDetailBlock } from './TvDetailBlock';
import {
  isPseudoVerbundId,
  aktenzeichenFromPseudoVerbundId,
  buildPseudoVerbund,
} from './pseudoVerbund';

interface Props {
  verbundId: string;
  /** Wenn gesetzt: dieser TV wird beim Mounten automatisch in der TV-Liste
   *  expandiert. Aenderungen werden via useEffect in den internen State
   *  uebernommen, damit Wechsel zwischen TVs ueber URL/Liste auch nach
   *  Mount-Zeit greifen. */
  initialExpandedTvAz?: string;
  onClose: () => void;
  /** Wird ausgeloest, wenn ein Klick aus einer Sub-Section (z.B. Netzwerk-
   *  Mitglieder) auf einen Antrag in einem anderen Verbund navigieren will.
   *  Updatet die URL — der Container resolved den Verbund neu. Im selben
   *  Verbund fuehrt das zum prop-getriggerten Re-Sync von `expandedTvAz`. */
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

export function VerbundDetail({
  verbundId,
  initialExpandedTvAz,
  onClose,
  onOpenAntrag,
}: Props): React.ReactElement {
  const storage = useStorage();
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [history, setHistory] = useState<VerbundHistorieEntry[]>([]);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [historyField, setHistoryField] = useState<string | null>(null);

  const isPseudo = isPseudoVerbundId(verbundId);

  // Default-Expansion: pseudo → automatisch der einzige TV; sonst initialer
  // Prop-Wert (kann null/undefined sein). Wird im useEffect unten synchron
  // gehalten, sodass Prop-Aenderungen den State updaten.
  const [expandedTvAz, setExpandedTvAz] = useState<string | null>(() => {
    if (isPseudo) return aktenzeichenFromPseudoVerbundId(verbundId);
    return initialExpandedTvAz ?? null;
  });

  useEffect(() => {
    if (isPseudo) {
      setExpandedTvAz(aktenzeichenFromPseudoVerbundId(verbundId));
    } else {
      setExpandedTvAz(initialExpandedTvAz ?? null);
    }
  }, [verbundId, initialExpandedTvAz, isPseudo]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchemasFor(tvs: Antrag[]): Promise<void> {
      if (tvs.length === 0 || cancelled) return;
      const lead = tvs[0]!;
      const ids = new Set<string>();
      for (const tv of tvs) {
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

    (async () => {
      if (isPseudo) {
        // Standalone-Antrag: synthetischer Verbund, einziger TV expandiert.
        const az = aktenzeichenFromPseudoVerbundId(verbundId);
        const a = await getAntrag(storage.idb, az);
        if (cancelled) return;
        if (!a) {
          setVerbund(null);
          setAntraege([]);
          setHistory([]);
          return;
        }
        setVerbund(buildPseudoVerbund(a));
        setAntraege([a]);
        setHistory([]);
        await loadSchemasFor([a]);
        return;
      }

      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      const h = await getVerbundHistoryByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      setVerbund(v);
      // Lead-First-Sort: Netzwerk-Lead-TVs (Suffix 01/02 + vb_phase 1/2) zuerst,
      // dann nach Aktenzeichen aufsteigend.
      const sorted = [...a].sort((x, y) => {
        const xLead = isNetzwerkLead(x);
        const yLead = isNetzwerkLead(y);
        if (xLead !== yLead) return xLead ? -1 : 1;
        return x.aktenzeichen.localeCompare(y.aktenzeichen);
      });
      setAntraege(sorted);
      setHistory(h.sort((x, y) => y.geaendert_am.localeCompare(x.geaendert_am)));
      await loadSchemasFor(sorted);
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb, isPseudo]);

  const historyCounts = useMemo<Record<string, number>>(() => ({}), []);

  if (!verbund) {
    return (
      <PanelShell onClose={onClose}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">
          {isPseudo
            ? `Antrag ${aktenzeichenFromPseudoVerbundId(verbundId)} nicht gefunden.`
            : `Verbund ${verbundId} nicht gefunden.`}
        </div>
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

  // Stepper-Daten: bei expandiertem TV → TV-Status, sonst Verbund-Aggregat.
  const expandedTv = expandedTvAz ? antraege.find(a => a.aktenzeichen === expandedTvAz) ?? null : null;
  const stepperStatus = expandedTv
    ? strOrNull(expandedTv.status)
    : displayStatus;
  const stepperHeading = (() => {
    if (isPseudo) return 'Status & Workflow';
    if (expandedTv) {
      const idx = antraege.findIndex(a => a.aktenzeichen === expandedTv.aktenzeichen);
      const tvLabel = strOrNull(expandedTv.antragsteller)
        ?? strOrNull(expandedTv.akronym)
        ?? expandedTv.aktenzeichen;
      return `Status & Workflow — TV ${idx + 1}: ${tvLabel}`;
    }
    return 'Status & Workflow — Verbund';
  })();

  // Header-Aktenzeichen: bei pseudo zeigt die echte Aktenzeichen-ID, nicht die
  // __pseudo__-Synthetik.
  const headerId = isPseudo ? aktenzeichenFromPseudoVerbundId(verbundId) : verbund.verbund_id;

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
          <span className="text-[12px] text-[var(--tf-text-tertiary)] font-mono">{headerId}</span>
        </div>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">{akronym}</h1>
        {titel ? <div className="mt-1 text-[14px] text-[var(--tf-text-secondary)]">{titel}</div> : null}
      </div>

      {/* STAMMDATEN — nur fuer echte Verbuende. Bei pseudo (Standalone) sind
          die Stammdaten identisch zu EckdatenCard, das spaeter im TvDetailBlock
          rendert; doppelte Anzeige vermeiden. */}
      {!isPseudo ? (
        <div
          className="rounded-[var(--tf-radius)] p-4 mb-6"
          style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
        >
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-3">
            Stammdaten
          </h3>
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
      ) : null}

      {/* STATUS & WORKFLOW — immer sichtbar (wenn ein Status vorhanden ist).
          Inhalt wechselt zwischen Verbund- und expandiertem TV-Status. */}
      {stepperStatus ? (
        <div className="mb-6">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
            {stepperHeading}
          </h3>
          <WorkflowStepper status={stepperStatus} />
        </div>
      ) : null}

      {/* TEILVORHABEN — bei echtem Verbund: expandable Rows mit Inline-Detail.
          Bei Pseudo: einziger TV wird direkt darunter (ohne Liste) gerendert. */}
      {!isPseudo ? (
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
              const foerderN = tvFoerder !== null
                ? Number(String(tvFoerder).replace(/\./g, '').replace(',', '.'))
                : null;
              const rolle = tvRolle(tv, idx, antraege);
              const isExpanded = expandedTvAz === tv.aktenzeichen;
              return (
                <div key={tv.aktenzeichen}>
                  <button
                    type="button"
                    onClick={() => setExpandedTvAz(isExpanded ? null : tv.aktenzeichen)}
                    aria-expanded={isExpanded}
                    className={`w-full text-left rounded-[var(--tf-radius)] px-3 py-2 transition-colors ${
                      isExpanded
                        ? 'bg-[var(--tf-primary)]/5'
                        : 'hover:bg-[var(--tf-bg-secondary)]'
                    }`}
                    style={{
                      border: '0.5px solid var(--tf-border)',
                      borderLeftWidth: isExpanded ? '2px' : '0.5px',
                      borderLeftColor: isExpanded ? 'var(--tf-primary)' : 'var(--tf-border)',
                    }}
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
                      <span className="shrink-0 text-[var(--tf-text-tertiary)] pt-0.5">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    </div>
                  </button>
                  {isExpanded ? (
                    <div
                      className="mt-3 mb-3 ml-3 pl-4 pb-2"
                      style={{ borderLeft: '2px solid var(--tf-primary)' }}
                    >
                      <TvDetailBlock aktenzeichen={tv.aktenzeichen} onOpenAntrag={onOpenAntrag} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Pseudo-Verbund: TV-Detail direkt (kein Liste, kein Toggle).
        expandedTvAz ? (
          <div className="mb-6">
            <TvDetailBlock aktenzeichen={expandedTvAz} onOpenAntrag={onOpenAntrag} />
          </div>
        ) : null
      )}

      {/* ALLE FELDER (Verbund-Aggregat) — nur fuer echte Verbuende. Bei pseudo
          waere das ein Duplikat von TvDetailBlock.AlleFelderSection. */}
      {!isPseudo && antraege.length > 0 ? (
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

      {/* Verbund-Historie — nur fuer echte Verbuende (pseudo hat keine). */}
      {!isPseudo ? (
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
      ) : null}

      {/* Field-History-Modal — fuer Verbund-Felder am Lead-TV. */}
      {lead && !isPseudo ? (
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
