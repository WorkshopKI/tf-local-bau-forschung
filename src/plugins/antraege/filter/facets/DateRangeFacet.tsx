interface Props {
  value: { from?: string; to?: string };
  onChange: (value: { from?: string; to?: string }) => void;
}

export function DateRangeFacet({ value, onChange }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Von</label>
      <input
        type="date"
        value={value.from ?? ''}
        onChange={e => onChange({ ...value, from: e.target.value || undefined })}
        className="px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Bis</label>
      <input
        type="date"
        value={value.to ?? ''}
        onChange={e => onChange({ ...value, to: e.target.value || undefined })}
        className="px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
    </div>
  );
}
