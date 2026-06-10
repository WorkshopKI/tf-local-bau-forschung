/** Tag-Liste mit optionalem Highlight matchender Tags. */
interface Props {
  tags: readonly string[];
  highlight?: string[];
  /** Wieviele anzeigen, Rest als "+N" Hinweis. Default unbegrenzt. */
  max?: number;
}

export function TechnologieTags({ tags, highlight = [], max }: Props): React.ReactElement {
  const highlightSet = new Set(highlight.map(h => h.toLowerCase()));
  const visible = max != null && tags.length > max ? tags.slice(0, max) : tags;
  const rest = max != null && tags.length > max ? tags.length - max : 0;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(tag => {
        const isHi = highlightSet.has(tag.toLowerCase());
        const cls = isHi
          ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200 ring-inset'
          : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]';
        return (
          <span
            key={tag}
            className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded ${cls}`}
          >
            {tag}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="text-[11px] px-2 py-0.5 text-[var(--tf-text-tertiary)]">
          +{rest}
        </span>
      )}
    </div>
  );
}
