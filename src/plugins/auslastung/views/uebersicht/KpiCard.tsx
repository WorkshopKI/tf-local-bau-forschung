/**
 * KpiCard — eine einzelne KPI-Box mit Caps-Label, Hauptwert + Of-Text,
 * Mini-Progress-Bar und Meta-Zeile. Vom Handoff-Design definiert.
 *
 * Layout:
 *   LABEL (caps)
 *   primary  ofText
 *   ▓▓▓░░░░░░ ← Mini-Progress (4px hoch)
 *   meta · meta · meta
 */
interface Props {
  label: string;
  /** Hauptzahl, z.B. "31" oder "540 h". */
  primary: string;
  /** Sekundärer Text neben der Hauptzahl, z.B. "/ 79 aktiv". */
  ofText?: string;
  /** Progress 0..100. Bei 0 wird der Fill nicht gerendert. */
  progressPct: number;
  /** Optional: Override-Farbe für die Fill (CSS color/var). Default `--tf-primary`. */
  progressColor?: string;
  /** Optional: Meta-Zeile unter dem Bar, z.B. "12 ohne Buchungen · 0 abgemeldet". */
  meta?: string;
}

export function KpiCard({
  label, primary, ofText, progressPct, progressColor, meta,
}: Props): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, progressPct));
  return (
    <div
      style={{
        border: '0.5px solid var(--tf-border)',
        borderRadius: 10,
        padding: '14px 16px',
        background: 'var(--tf-bg)',
      }}
    >
      <p
        className="uppercase text-[var(--tf-text-tertiary)]"
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: 'var(--tf-tracking-caps)',
        }}
      >
        {label}
      </p>

      <div className="flex items-baseline gap-2 mt-1">
        <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--tf-text)', lineHeight: 1.1 }}>
          {primary}
        </span>
        {ofText && (
          <span style={{ fontSize: 12.5, color: 'var(--tf-text-secondary)' }}>
            {ofText}
          </span>
        )}
      </div>

      <div
        className="mt-3"
        style={{
          height: 4,
          background: 'var(--tf-bg-secondary)',
          borderRadius: 'var(--tf-radius-pill)',
          overflow: 'hidden',
        }}
      >
        {clamped > 0 && (
          <div
            style={{
              width: `${clamped}%`,
              height: '100%',
              background: progressColor ?? 'var(--tf-primary)',
              transition: 'width 200ms ease-out',
            }}
          />
        )}
      </div>

      {meta && (
        <p
          className="mt-2 text-[var(--tf-text-tertiary)]"
          style={{ fontSize: 11.5, lineHeight: 1.4 }}
        >
          {meta}
        </p>
      )}
    </div>
  );
}
