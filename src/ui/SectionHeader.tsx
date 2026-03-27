interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
}

export function SectionHeader({ label, action }: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
