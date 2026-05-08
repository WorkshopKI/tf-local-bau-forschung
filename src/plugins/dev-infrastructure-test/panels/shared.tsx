import type { ReactNode } from 'react';

// ============================================================
// Legacy-Bausteine (werden noch von alten Panels verwendet).
// ============================================================

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

// ============================================================
// Neue Bausteine nach Handoff dev-infra v2 — Field / ActionRow /
// Archive / Danger / StatusDot. Werden vom Dashboard und (später)
// von den restrukturierten Panels verwendet.
// ============================================================

export type StatusTone = 'success' | 'warning' | 'danger' | 'default';

export function StatusDot({ tone }: { tone: StatusTone }): React.ReactElement {
  const color =
    tone === 'success' ? 'var(--tf-success-text)'
    : tone === 'warning' ? 'var(--tf-warning-text)'
    : tone === 'danger' ? 'var(--tf-danger-text)'
    : 'var(--tf-text-tertiary)';
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 99,
        background: color,
      }}
    />
  );
}

export function SectionCaption({ children, right }: { children: ReactNode; right?: ReactNode }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between mt-6 mb-2.5">
      <h3
        className="text-[11px] uppercase text-[var(--tf-text-tertiary)] font-medium"
        style={{ letterSpacing: '0.08em' }}
      >
        {children}
      </h3>
      {right ? <span className="text-[11px] text-[var(--tf-text-tertiary)]">{right}</span> : null}
    </div>
  );
}

export function Field({ label, hint, children }: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-4">
      <div
        className="text-[11px] uppercase text-[var(--tf-text-tertiary)] mb-1.5"
        style={{ letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      {children}
      {hint ? (
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

export function ActionRow({ title, hint, btn, lastRun, status }: {
  title: string;
  hint?: string;
  btn: ReactNode;
  lastRun?: string;
  /**
   * Inline-Status pro Aktion: zeigt z.B. den aktuellen Handle-Namen oder
   * "noch nicht gesetzt", damit der User auf einen Blick sieht, ob die
   * Aktion schon erfolgreich war und worauf sie sich bezieht.
   */
  status?: ReactNode;
}): React.ReactElement {
  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[var(--tf-text)]">{title}</div>
        {hint ? (
          <div className="text-[12px] text-[var(--tf-text-secondary)] mt-1 leading-relaxed">{hint}</div>
        ) : null}
        {status ? (
          <div className="text-[11.5px] mt-1.5 flex items-center gap-1.5 flex-wrap">{status}</div>
        ) : null}
        {lastRun ? (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1 font-mono">zuletzt {lastRun}</div>
        ) : null}
      </div>
      <div className="shrink-0">{btn}</div>
    </div>
  );
}

export function Archive({ title = 'Selten gebraucht / Archiv', children, defaultOpen = false }: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}): React.ReactElement {
  return (
    <details
      className="mt-4 pt-3"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
      open={defaultOpen}
    >
      <summary className="cursor-pointer text-[12.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] select-none">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function Danger({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <details
      className="mt-6 rounded-[var(--tf-radius)] px-3.5 py-2.5"
      style={{
        background: 'var(--tf-danger-bg)',
        border: '0.5px solid var(--tf-danger-border)',
      }}
    >
      <summary className="cursor-pointer text-[13px] font-medium text-[var(--tf-danger-text)] select-none">
        ⚠ Gefahrenzone — destruktive Aktionen
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
