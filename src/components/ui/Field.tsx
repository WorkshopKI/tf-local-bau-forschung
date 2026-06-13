interface FieldProps {
  label: string;
  value: string;
}

export function Field({ label, value }: FieldProps): React.ReactElement {
  return (
    <div>
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">{label}</p>
      <p className="text-[14px] font-medium text-[var(--tf-text)]">{value}</p>
    </div>
  );
}
