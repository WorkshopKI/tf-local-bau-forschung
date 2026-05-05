/**
 * Einzelner Listeneintrag der Review-Queue. Compact 2-line-Format mit
 * Badges fuer doc_type / confidence / triage_source und einer Subline
 * fuer FKZ + Antrags-Zuordnung.
 */
import {
  CONFIDENCE_BADGE_CLASSES,
  TRIAGE_SOURCE_BADGE_CLASSES,
  type ManifestEntry,
} from '@/phase2';

interface Props {
  entry: ManifestEntry;
  selected: boolean;
  onSelect: () => void;
}

export function ManifestListItem({ entry, selected, onSelect }: Props): React.ReactElement {
  const confidenceClass = entry.match_confidence
    ? CONFIDENCE_BADGE_CLASSES[entry.match_confidence]
    : 'text-zinc-700 bg-zinc-50';
  const sourceClass = TRIAGE_SOURCE_BADGE_CLASSES[entry.triage_source] ?? 'text-slate-700 bg-slate-50';

  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected ? 'true' : 'false'}
      title={entry.dms_bezeichnung ?? entry.filepath}
      className="w-full text-left px-3 py-2 border-b-[0.5px] hover:bg-[var(--tf-hover)] cursor-pointer transition-colors data-[selected=true]:bg-[var(--tf-hover)] data-[selected=true]:border-l-2"
      style={{
        borderColor: 'var(--tf-border)',
        borderLeftColor: selected ? 'var(--tf-text)' : 'transparent',
        borderLeftWidth: selected ? '2px' : '0',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[11.5px] text-[var(--tf-text)] truncate flex-1" title={entry.filename}>
          {entry.filename}
        </span>
        {entry.requires_review && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">
            Review
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
        <Badge className="text-zinc-800 bg-zinc-50">{entry.doc_type}</Badge>
        {entry.match_confidence && (
          <Badge className={confidenceClass}>{entry.match_confidence}</Badge>
        )}
        <Badge className={sourceClass}>{entry.triage_source}</Badge>
        <span className="text-[var(--tf-text-tertiary)] font-mono">
          {entry.extracted_fkz ?? 'kein FKZ'}
        </span>
        <span className="text-[var(--tf-text-tertiary)] truncate">
          {entry.matched_antrag_id ? `→ ${entry.matched_antrag_id}` : 'nicht zugeordnet'}
        </span>
      </div>
    </button>
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
