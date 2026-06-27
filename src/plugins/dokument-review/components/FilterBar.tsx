/**
 * Vier Filter-Dimensionen als Pills mit Count-Badges. Dimension 1
 * (Ansicht) ist immer sichtbar, Dimension 2 (Confidence) nur in
 * "Alle Dokumente". Dimensionen 3 (Typ) und 4 (Source) immer aktiv.
 */
import { useMemo } from 'react';
import type { ManifestEntry, MatchConfidence } from '@/phase2';
import { useDokumentReviewStore } from '../store';
import {
  ALL_CONFIDENCES,
  ALL_SOURCES,
  isInReviewQueue,
  uniqueDocTypes,
} from '../filtering';

interface Props {
  entries: ManifestEntry[];
}

export function FilterBar({ entries }: Props): React.ReactElement {
  const viewMode = useDokumentReviewStore(s => s.viewMode);
  const confidenceFilter = useDokumentReviewStore(s => s.confidenceFilter);
  const docTypeFilter = useDokumentReviewStore(s => s.docTypeFilter);
  const sourceFilter = useDokumentReviewStore(s => s.sourceFilter);
  const setViewMode = useDokumentReviewStore(s => s.setViewMode);
  const setConfidenceFilter = useDokumentReviewStore(s => s.setConfidenceFilter);
  const setDocTypeFilter = useDokumentReviewStore(s => s.setDocTypeFilter);
  const setSourceFilter = useDokumentReviewStore(s => s.setSourceFilter);

  const counts = useMemo(() => {
    const reviewCount = entries.filter(isInReviewQueue).length;
    const confidenceCounts = new Map<NonNullable<MatchConfidence>, number>();
    const docTypeCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    for (const e of entries) {
      if (e.match_confidence) {
        confidenceCounts.set(e.match_confidence, (confidenceCounts.get(e.match_confidence) ?? 0) + 1);
      }
      docTypeCounts.set(e.doc_type, (docTypeCounts.get(e.doc_type) ?? 0) + 1);
      sourceCounts.set(e.triage_source, (sourceCounts.get(e.triage_source) ?? 0) + 1);
    }
    return { reviewCount, confidenceCounts, docTypeCounts, sourceCounts };
  }, [entries]);

  const docTypes = useMemo(() => uniqueDocTypes(entries), [entries]);

  return (
    <div className="flex flex-col gap-2.5">
      <Row label="Ansicht">
        <Pill
          label="Review-Queue"
          count={counts.reviewCount}
          active={viewMode === 'review-queue'}
          onClick={() => setViewMode('review-queue')}
        />
        <Pill
          label="Alle Dokumente"
          count={entries.length}
          active={viewMode === 'all'}
          onClick={() => setViewMode('all')}
        />
        <Pill
          label="Pending"
          count={null}
          active={viewMode === 'pending'}
          onClick={() => setViewMode('pending')}
        />
      </Row>

      {viewMode === 'all' && (
        <Row label="Confidence">
          <Pill label="Alle" count={null} active={confidenceFilter === 'all'} onClick={() => setConfidenceFilter('all')} />
          {ALL_CONFIDENCES.map(c => (
            <Pill
              key={c}
              label={c}
              count={counts.confidenceCounts.get(c) ?? 0}
              active={confidenceFilter === c}
              onClick={() => setConfidenceFilter(c)}
            />
          ))}
        </Row>
      )}

      {viewMode !== 'pending' && (
        <Row label="Typ">
          <Pill label="Alle" count={null} active={docTypeFilter === 'all'} onClick={() => setDocTypeFilter('all')} />
          {docTypes.map(t => (
            <Pill
              key={t}
              label={t}
              count={counts.docTypeCounts.get(t) ?? 0}
              active={docTypeFilter === t}
              onClick={() => setDocTypeFilter(t as typeof docTypeFilter)}
            />
          ))}
        </Row>
      )}

      {viewMode !== 'pending' && (
        <Row label="Source">
          <Pill label="Alle" count={null} active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')} />
          {ALL_SOURCES.map(s => (
            <Pill
              key={s}
              label={s}
              count={counts.sourceCounts.get(s) ?? 0}
              active={sourceFilter === s}
              onClick={() => setSourceFilter(s)}
            />
          ))}
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div
        className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]"
        style={{ minWidth: '72px' }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

interface PillProps {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}

function Pill({ label, count, active, onClick }: PillProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full text-[11.5px] transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
          : 'bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
      }`}
      style={{
        padding: '4px 12px',
        border: `0.5px solid ${active ? 'transparent' : 'var(--tf-border)'}`,
      }}
    >
      <span>{label}</span>
      {count !== null && <span className="opacity-60 text-[10.5px]">{count.toLocaleString('de-DE')}</span>}
    </button>
  );
}
