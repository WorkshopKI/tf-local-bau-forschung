/**
 * Linke Spalte der Review-Queue. Filtert + sortiert das Manifest lokal,
 * paginiert in 50er-Bloecke (analog DokumenteListe). Selektion synchron
 * mit Store, sodass KeyboardHandler und DetailPanel zusammenspielen.
 */
import { useEffect, useMemo } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import type { ManifestEntry } from '@/phase2';
import { useDokumentReviewStore } from '../store';
import { applyFilters } from '../filtering';
import { ManifestListItem } from './ManifestListItem';

const PAGE_SIZE = 50;

interface Props {
  entries: ManifestEntry[];
  loading: boolean;
}

export function ManifestList({ entries, loading }: Props): React.ReactElement {
  const viewMode = useDokumentReviewStore(s => s.viewMode);
  const confidenceFilter = useDokumentReviewStore(s => s.confidenceFilter);
  const docTypeFilter = useDokumentReviewStore(s => s.docTypeFilter);
  const sourceFilter = useDokumentReviewStore(s => s.sourceFilter);
  const sortKey = useDokumentReviewStore(s => s.sortKey);
  const setSortKey = useDokumentReviewStore(s => s.setSortKey);
  const page = useDokumentReviewStore(s => s.page);
  const setPage = useDokumentReviewStore(s => s.setPage);
  const selectedFilename = useDokumentReviewStore(s => s.selectedFilename);
  const setSelected = useDokumentReviewStore(s => s.setSelected);

  const filtered = useMemo(
    () => applyFilters(entries, { viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey }),
    [entries, viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Wenn Selektion durch Filter verloren geht: ersten Page-Eintrag aktivieren.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedFilename) setSelected(null);
      return;
    }
    const stillVisible = selectedFilename && filtered.some(e => e.filename === selectedFilename);
    if (!stillVisible && pageEntries[0]) {
      setSelected(pageEntries[0].filename);
    }
  }, [filtered, pageEntries, selectedFilename, setSelected]);

  if (loading && entries.length === 0) {
    return <Container><div className="text-[12px] text-[var(--tf-text-secondary)] p-4">Lade Manifest…</div></Container>;
  }

  if (filtered.length === 0) {
    return (
      <Container>
        <EmptyState viewMode={viewMode} hasAnyEntries={entries.length > 0} />
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex items-center justify-between px-3 py-2 border-b-[0.5px]" style={{ borderColor: 'var(--tf-border)' }}>
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          {filtered.length.toLocaleString('de-DE')} Eintraege · Seite {safePage + 1} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="text-[11px] bg-transparent text-[var(--tf-text-secondary)] border-[0.5px] rounded-[6px] px-2 py-1 cursor-pointer"
            style={{ borderColor: 'var(--tf-border)' }}
            aria-label="Sortierung"
          >
            <option value="review_then_classified_desc">Review zuerst</option>
            <option value="filename">Dateiname</option>
            <option value="doc_type">Typ</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pageEntries.map(e => (
          <ManifestListItem
            key={e.filename}
            entry={e}
            selected={e.filename === selectedFilename}
            onSelect={() => setSelected(e.filename)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t-[0.5px]" style={{ borderColor: 'var(--tf-border)' }}>
        <button
          type="button"
          onClick={() => setPage(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft size={12} /> Zurueck
        </button>
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Weiter <ChevronRight size={12} />
        </button>
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

function EmptyState({ viewMode, hasAnyEntries }: { viewMode: string; hasAnyEntries: boolean }): React.ReactElement {
  if (!hasAnyEntries) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 gap-2 text-[var(--tf-text-secondary)]">
        <FileSearch size={28} className="opacity-60" />
        <div className="text-[13px]">Noch keine Triage-Daten.</div>
        <div className="text-[11.5px] opacity-80">Bitte zuerst im Suchindex-Plugin einen Bulk-Scan starten.</div>
      </div>
    );
  }
  if (viewMode === 'review-queue') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 gap-2 text-emerald-700">
        <CheckCircle2 size={28} />
        <div className="text-[13px]">Keine offenen Reviews — alle Dokumente wurden triagiert.</div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center p-10 text-[12px] text-[var(--tf-text-secondary)]">
      Keine Eintraege fuer diesen Filter.
    </div>
  );
}
