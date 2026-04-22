interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function TextContainsFacet({ value, onChange }: Props): React.ReactElement {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Text enthält…"
      className="w-full px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
    />
  );
}
