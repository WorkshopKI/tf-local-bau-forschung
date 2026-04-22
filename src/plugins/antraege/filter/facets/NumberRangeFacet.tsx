interface Props {
  value: { min?: number; max?: number };
  onChange: (value: { min?: number; max?: number }) => void;
}

export function NumberRangeFacet({ value, onChange }: Props): React.ReactElement {
  const update = (k: 'min' | 'max', raw: string): void => {
    if (raw === '') {
      onChange({ ...value, [k]: undefined });
      return;
    }
    const n = parseFloat(raw);
    if (isNaN(n)) return;
    onChange({ ...value, [k]: n });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        placeholder="Min"
        value={value.min === undefined ? '' : String(value.min)}
        onChange={e => update('min', e.target.value)}
        className="min-w-0 flex-1 px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
      <span className="text-[11px] text-[var(--tf-text-tertiary)]">bis</span>
      <input
        type="number"
        placeholder="Max"
        value={value.max === undefined ? '' : String(value.max)}
        onChange={e => update('max', e.target.value)}
        className="min-w-0 flex-1 px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
      />
    </div>
  );
}
