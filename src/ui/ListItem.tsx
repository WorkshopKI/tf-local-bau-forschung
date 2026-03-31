interface ListItemProps {
  title: string | React.ReactNode;
  subtitle?: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  last?: boolean;
}

export function ListItem({ title, subtitle, meta, icon, onClick, last }: ListItemProps): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${onClick ? 'cursor-pointer hover:opacity-70' : ''}`}
      style={!last ? { borderBottom: '0.5px solid var(--tf-border)' } : undefined}
      onClick={onClick}
    >
      {icon && (
        <div className="w-7 h-7 rounded-full bg-[var(--tf-bg-secondary)] flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-[var(--tf-text)] truncate">{title}</p>
        {subtitle && <p className="text-[12px] text-[var(--tf-text-secondary)] truncate">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0 flex items-center gap-2">{meta}</div>}
    </div>
  );
}
