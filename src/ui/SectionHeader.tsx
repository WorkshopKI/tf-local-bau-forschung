interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
}

export function SectionHeader({ label, action }: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between pb-1.5 mb-3"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <span className="text-[13px] font-medium text-[var(--tf-text)]">
        {label}
      </span>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
