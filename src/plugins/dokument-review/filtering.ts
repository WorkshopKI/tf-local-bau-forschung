/**
 * Filter- und Sort-Logik fuer die Manifest-Liste. Wird sowohl in
 * FilterBar (zur Anzeige der Count-Badges pro Pill) als auch in
 * ManifestList (zum tatsaechlichen Filtern) konsumiert.
 */
import type { ManifestEntry, MatchConfidence, ClassifierSource } from '@/phase2';
import type {
  ConfidenceFilter,
  DocTypeFilter,
  SortKey,
  SourceFilter,
  ViewMode,
} from './store';

export function isInReviewQueue(entry: ManifestEntry): boolean {
  return (
    entry.requires_review ||
    entry.triage_state === 'review' ||
    entry.match_confidence === 'orphan'
  );
}

const CONFIDENCE_RANK: Record<NonNullable<MatchConfidence>, number> = {
  high: 0,
  medium: 1,
  low: 2,
  orphan: 3,
};

interface FilterCriteria {
  viewMode: ViewMode;
  confidenceFilter: ConfidenceFilter;
  docTypeFilter: DocTypeFilter;
  sourceFilter: SourceFilter;
  sortKey: SortKey;
}

export function applyFilters(entries: ManifestEntry[], c: FilterCriteria): ManifestEntry[] {
  let result = entries;
  if (c.viewMode === 'review-queue') {
    result = result.filter(isInReviewQueue);
  }
  if (c.confidenceFilter !== 'all') {
    result = result.filter(e => e.match_confidence === c.confidenceFilter);
  }
  if (c.docTypeFilter !== 'all') {
    result = result.filter(e => e.doc_type === c.docTypeFilter);
  }
  if (c.sourceFilter !== 'all') {
    result = result.filter(e => e.triage_source === c.sourceFilter);
  }
  return sortEntries(result, c.sortKey);
}

export function sortEntries(entries: ManifestEntry[], sortKey: SortKey): ManifestEntry[] {
  const arr = entries.slice();
  switch (sortKey) {
    case 'filename':
      arr.sort((a, b) => a.filename.localeCompare(b.filename));
      break;
    case 'doc_type':
      arr.sort((a, b) => a.doc_type.localeCompare(b.doc_type) || a.filename.localeCompare(b.filename));
      break;
    case 'confidence':
      arr.sort((a, b) => {
        const ra = a.match_confidence ? CONFIDENCE_RANK[a.match_confidence] : 4;
        const rb = b.match_confidence ? CONFIDENCE_RANK[b.match_confidence] : 4;
        return ra - rb || a.filename.localeCompare(b.filename);
      });
      break;
    case 'review_then_classified_desc':
    default:
      arr.sort((a, b) => {
        const ra = isInReviewQueue(a) ? 0 : 1;
        const rb = isInReviewQueue(b) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return b.classified_at.localeCompare(a.classified_at);
      });
      break;
  }
  return arr;
}

export function uniqueDocTypes(entries: ManifestEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) set.add(e.doc_type);
  return Array.from(set).sort();
}

export const ALL_SOURCES: ClassifierSource[] = ['dms_csv', 'stage1', 'stage2', 'stage3', 'manual'];
export const ALL_CONFIDENCES: NonNullable<MatchConfidence>[] = ['high', 'medium', 'low', 'orphan'];
