/**
 * Rechte Spalte. Zeigt 4 Sections (Datei / Triage / Match / DMS) und die
 * 5 Override-Aktionen (Typ aendern / Antrag zuordnen / irrelevant /
 * relevant ohne Zuordnung / re-triage). Nach jeder Aktion ruft
 * advanceToNext() den naechsten Eintrag in der aktuellen gefilterten Liste
 * auf — fuer Batch-Workflows.
 */
import { useMemo, useRef } from 'react';
import { CheckCircle2, RefreshCcw, ShieldX, XCircle } from 'lucide-react';
import {
  CONFIDENCE_BADGE_CLASSES,
  TRIAGE_SOURCE_BADGE_CLASSES,
  type DocType,
  type ManifestEntry,
} from '@/phase2';
import { Button } from '@/ui';
import type { Antrag } from '@/core/services/csv/types';
import { useDokumentReviewStore } from '../store';
import { applyFilters } from '../filtering';
import { useReviewActions } from '../hooks/useReviewActions';
import { AntragAutocomplete, type AntragAutocompleteHandle } from './AntragAutocomplete';

const DOC_TYPES: DocType[] = [
  'projektbeschreibung', 'antragsunterlagen', 'gutachten', 'gutachten_qs',
  'verwendungsnachweis', 'verwendungsnachweispruefung', 'bescheid',
  'aenderungsbescheid', 'nachforderung', 'korrespondenz', 'checkliste',
  'de_minimis', 'sonstiges', 'irrelevant',
];

interface Props {
  entries: ManifestEntry[];
  antraege: Antrag[];
  onReloadEntry: (filename: string) => Promise<void>;
  onRemoveEntry: (filename: string) => void;
}

export function DetailPanel({ entries, antraege, onReloadEntry, onRemoveEntry }: Props): React.ReactElement {
  const selectedFilename = useDokumentReviewStore(s => s.selectedFilename);
  const setSelected = useDokumentReviewStore(s => s.setSelected);
  const viewMode = useDokumentReviewStore(s => s.viewMode);
  const confidenceFilter = useDokumentReviewStore(s => s.confidenceFilter);
  const docTypeFilter = useDokumentReviewStore(s => s.docTypeFilter);
  const sourceFilter = useDokumentReviewStore(s => s.sourceFilter);
  const sortKey = useDokumentReviewStore(s => s.sortKey);
  const autocompleteRef = useRef<AntragAutocompleteHandle | null>(null);

  const entry = useMemo(
    () => (selectedFilename ? entries.find(e => e.filename === selectedFilename) ?? null : null),
    [selectedFilename, entries],
  );

  const filteredSnapshot = useMemo(
    () => applyFilters(entries, { viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey }),
    [entries, viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey],
  );

  const advanceToNext = (currentFilename: string): void => {
    if (viewMode !== 'review-queue' && viewMode !== 'all') return;
    const idx = filteredSnapshot.findIndex(e => e.filename === currentFilename);
    if (idx === -1) {
      const fallback = filteredSnapshot.find(e => e.filename !== currentFilename);
      setSelected(fallback?.filename ?? null);
      return;
    }
    const next = filteredSnapshot[idx + 1] ?? filteredSnapshot[idx - 1] ?? null;
    setSelected(next?.filename ?? null);
  };

  const actions = useReviewActions(
    async (filename) => { await onReloadEntry(filename); },
    (filename) => { onRemoveEntry(filename); },
  );

  if (!entry) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center text-center p-12 gap-2 text-[var(--tf-text-secondary)]">
          <CheckCircle2 size={28} className="opacity-50" />
          <div className="text-[12.5px]">Keinen Eintrag ausgewaehlt — links einen waehlen.</div>
        </div>
      </Container>
    );
  }

  const confidenceClass = entry.match_confidence
    ? CONFIDENCE_BADGE_CLASSES[entry.match_confidence]
    : 'text-zinc-700 bg-zinc-50';
  const sourceClass = TRIAGE_SOURCE_BADGE_CLASSES[entry.triage_source] ?? 'text-slate-700 bg-slate-50';

  return (
    <Container>
      <div className="flex flex-col gap-4 p-4 overflow-y-auto">
        <div>
          <h3 className="font-mono text-[13px] text-[var(--tf-text)] break-all">{entry.filename}</h3>
          <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{entry.filepath}</div>
        </div>

        <Section title="Datei-Info">
          <Kv k="Groesse">{(entry.size_bytes / 1024).toFixed(1)} KB</Kv>
          <Kv k="mtime">{entry.mtime}</Kv>
          <Kv k="Format">{deriveFormat(entry.filename)}</Kv>
        </Section>

        <Section title="Triage">
          <Kv k="doc_type"><Badge className="text-zinc-800 bg-zinc-50">{entry.doc_type}</Badge></Kv>
          <Kv k="State"><Badge className="text-slate-800 bg-slate-50">{entry.triage_state}</Badge></Kv>
          <Kv k="Stage">{entry.triage_stage}</Kv>
          <Kv k="Source"><Badge className={sourceClass}>{entry.triage_source}</Badge></Kv>
          <Kv k="Reason"><span className="font-mono text-[11.5px]">{entry.triage_reason}</span></Kv>
          <Kv k="Classified at">{entry.classified_at}</Kv>
          {entry.requires_review && (
            <Kv k="Review"><Badge className="text-amber-800 bg-amber-50">requires_review</Badge></Kv>
          )}
        </Section>

        <Section title="Match">
          <Kv k="Antrag">
            {entry.matched_antrag_id
              ? <span className="font-mono text-[12px]">{entry.matched_antrag_id}</span>
              : <span className="text-[var(--tf-text-tertiary)]">nicht zugeordnet</span>}
          </Kv>
          <Kv k="Method">{entry.match_method ?? '—'}</Kv>
          <Kv k="Confidence">
            {entry.match_confidence
              ? <Badge className={confidenceClass}>{entry.match_confidence}</Badge>
              : '—'}
          </Kv>
          <Kv k="FKZ">{entry.extracted_fkz ?? '—'}</Kv>
          <Kv k="Akronym">{entry.extracted_akronym ?? '—'}</Kv>
          {entry.candidate_antrag_ids.length > 0 && (
            <Kv k="Kandidaten">
              <div className="flex flex-wrap gap-1.5">
                {entry.candidate_antrag_ids.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={async () => {
                      await actions.assignAntrag(entry, id);
                      advanceToNext(entry.filename);
                    }}
                    className="font-mono text-[11.5px] px-2 py-0.5 rounded-[6px] bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </Kv>
          )}
        </Section>

        {(entry.dms_bezeichnung || entry.dms_aktenplan || entry.creator_kuerzel) && (
          <Section title="DMS-CSV">
            {entry.dms_bezeichnung && <Kv k="Bezeichnung">{entry.dms_bezeichnung}</Kv>}
            {entry.dms_aktenplan && <Kv k="Aktenplan">{entry.dms_aktenplan}</Kv>}
            {entry.creator_kuerzel && <Kv k="Erstellt von">{entry.creator_kuerzel}</Kv>}
          </Section>
        )}

        <Section title="Aktionen">
          <div className="flex flex-col gap-3">
            <div>
              <Label>Typ aendern</Label>
              <select
                value={entry.doc_type}
                onChange={async (e) => {
                  await actions.changeDocType(entry, e.target.value as DocType);
                }}
                className="w-full bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] rounded-[var(--tf-radius)] px-3 py-2"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <Label>Antrag zuordnen</Label>
              <AntragAutocomplete
                ref={autocompleteRef}
                antraege={antraege}
                onSelect={async (aktenzeichen) => {
                  await actions.assignAntrag(entry, aktenzeichen);
                  advanceToNext(entry.filename);
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="primary"
                icon={ShieldX}
                onClick={async () => {
                  await actions.markIrrelevant(entry);
                  advanceToNext(entry.filename);
                }}
              >
                Irrelevant
              </Button>
              <Button
                variant="secondary"
                icon={CheckCircle2}
                onClick={async () => {
                  await actions.confirmRelevantWithoutMatch(entry);
                  advanceToNext(entry.filename);
                }}
              >
                Relevant ohne Zuordnung
              </Button>
              <Button
                variant="danger"
                icon={RefreshCcw}
                onClick={async () => {
                  await actions.reTriage(entry);
                  advanceToNext(entry.filename);
                }}
              >
                Erneut klassifizieren
              </Button>
              <Button
                variant="ghost"
                icon={XCircle}
                onClick={() => setSelected(null)}
              >
                Schliessen
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </Container>
  );
}

function Container({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="flex flex-col rounded-[12px] border-[0.5px] bg-[var(--tf-bg)] overflow-hidden"
      style={{ borderColor: 'var(--tf-border)' }}
    >
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]"
      >
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-2 text-[12px]">
      <div className="text-[var(--tf-text-tertiary)]">{k}</div>
      <div className="text-[var(--tf-text)] break-words">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-1">
      {children}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full text-[10.5px] font-medium ${className}`}
      style={{ padding: '1.5px 8px' }}
    >
      {children}
    </span>
  );
}

function deriveFormat(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '—';
  return filename.slice(dot + 1).toUpperCase();
}
