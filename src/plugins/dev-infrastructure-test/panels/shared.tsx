import type { ReactNode } from 'react';

export function DevRow({ label, children }: { label: string; children: ReactNode }): React.ReactElement {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function DevLog({ lines }: { lines: string[] }): React.ReactElement {
  if (lines.length === 0) {
    return (
      <div className="rounded-md bg-[var(--tf-bg-secondary)] px-3 py-2 text-[11px] text-[var(--tf-text-tertiary)]">
        Keine Einträge.
      </div>
    );
  }
  return (
    <div
      className="max-h-[180px] overflow-y-auto rounded-md bg-[var(--tf-bg-secondary)] p-2 font-mono text-[10.5px] leading-snug text-[var(--tf-text-secondary)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {lines.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap break-words">{l}</div>
      ))}
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }): React.ReactElement {
  const bg =
    tone === 'ok' ? 'bg-emerald-50 text-emerald-800'
    : tone === 'warn' ? 'bg-amber-50 text-amber-800'
    : tone === 'bad' ? 'bg-red-50 text-red-800'
    : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${bg}`}>
      {label}
    </span>
  );
}

export function Spacer({ h = 8 }: { h?: number }): React.ReactElement {
  return <div style={{ height: h }} />;
}
