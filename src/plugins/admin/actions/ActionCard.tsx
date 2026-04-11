/** Shared layout wrapper fuer Action-Cards im Verwaltungs-Tab. */

interface ActionCardProps {
  title: string;
  status?: string;
  children: React.ReactNode;
}

export function ActionCard({ title, status, children }: ActionCardProps): React.ReactElement {
  return (
    <div className="p-[14px] rounded-[var(--tf-radius)] space-y-2"
      style={{ border: '0.5px solid var(--tf-border)' }}>
      <div>
        <p className="text-[13px] font-medium text-[var(--tf-text)]">{title}</p>
        {status && <p className="text-[12px] text-[var(--tf-text-secondary)]">{status}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
