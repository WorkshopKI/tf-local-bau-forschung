interface ProgressBarProps {
  value: number;
  label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps): React.ReactElement {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 bg-[var(--tf-bg-secondary)] rounded-sm overflow-hidden">
        <div
          className="h-full bg-[var(--tf-text)] rounded-sm transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <span className="text-[13px] text-[var(--tf-text-secondary)] shrink-0">{label}</span>
      )}
    </div>
  );
}
