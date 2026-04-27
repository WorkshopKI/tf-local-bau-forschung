interface Props {
  value: { from?: string; to?: string };
  /** Frühestes Datum unter den aktuell gefilterten Antraegen (ISO YYYY-MM-DD), falls vorhanden. */
  minDate?: string;
  /** Spätestes Datum unter den aktuell gefilterten Antraegen (ISO YYYY-MM-DD), falls vorhanden. */
  maxDate?: string;
  onChange: (value: { from?: string; to?: string }) => void;
}

export function DateRangeFacet({ value, minDate, maxDate, onChange }: Props): React.ReactElement {
  const formatLabel = (iso: string): string => {
    // ISO YYYY-MM-DD → DD.MM.YYYY für deutsche UI
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
  };

  const hasValue = value.from !== undefined || value.to !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {(minDate || maxDate || hasValue) ? (
        <div className="flex flex-wrap gap-1 mb-0.5">
          {hasValue ? (
            <button
              type="button"
              onClick={() => onChange({})}
              className="px-1.5 py-0.5 rounded text-[11px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]"
              title="Datums-Filter zurücksetzen"
            >
              Alle
            </button>
          ) : null}
          {minDate ? (
            <button
              type="button"
              onClick={() => onChange({ ...value, from: minDate })}
              className="px-1.5 py-0.5 rounded text-[11px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]"
              title={`Von auf ältestes Datum (${formatLabel(minDate)}) setzen`}
            >
              Ältestes: {formatLabel(minDate)}
            </button>
          ) : null}
          {maxDate ? (
            <button
              type="button"
              onClick={() => onChange({ ...value, to: maxDate })}
              className="px-1.5 py-0.5 rounded text-[11px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]"
              title={`Bis auf neuestes Datum (${formatLabel(maxDate)}) setzen`}
            >
              Neuestes: {formatLabel(maxDate)}
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Von</label>
      <input
        type="date"
        value={value.from ?? ''}
        min={minDate}
        max={maxDate}
        onChange={e => onChange({ ...value, from: e.target.value || undefined })}
        className="px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Bis</label>
      <input
        type="date"
        value={value.to ?? ''}
        min={minDate}
        max={maxDate}
        onChange={e => onChange({ ...value, to: e.target.value || undefined })}
        className="px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
    </div>
  );
}
