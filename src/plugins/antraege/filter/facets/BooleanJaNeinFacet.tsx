interface Props {
  filterId: string;
  counts: Map<string, number>;
  selected: 'ja' | 'nein' | 'beide';
  onChange: (mode: 'ja' | 'nein' | 'beide') => void;
}

export function BooleanJaNeinFacet({ filterId, counts, selected, onChange }: Props): React.ReactElement {
  const jaN = counts.get('ja') ?? 0;
  const neinN = counts.get('nein') ?? 0;
  const beideN = jaN + neinN;
  const options: { mode: 'ja' | 'nein' | 'beide'; label: string; n: number }[] = [
    { mode: 'ja', label: 'Ja', n: jaN },
    { mode: 'nein', label: 'Nein', n: neinN },
    { mode: 'beide', label: 'Beide', n: beideN },
  ];
  return (
    <div className="flex flex-col gap-1">
      {options.map(o => (
        <label
          key={o.mode}
          className="flex items-center justify-between gap-2 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--tf-bg-secondary)] rounded px-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="radio"
              name={filterId}
              checked={selected === o.mode}
              onChange={() => onChange(o.mode)}
              className="accent-[var(--tf-primary)]"
            />
            <span className="text-[var(--tf-text)]">{o.label}</span>
          </div>
          <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{o.n}</span>
        </label>
      ))}
    </div>
  );
}
