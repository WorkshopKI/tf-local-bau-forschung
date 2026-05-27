/**
 * InlineCapsHeader — Sektion-Header im Linear-Stil:
 *
 *   [LABEL (caps)] [Count]  ────────────────────────
 *
 * Caps-Label + optionaler Count + Hairline füllt den Rest. Wird in mehreren
 * Sub-Sektionen des Übersicht-Tabs verwendet (Warnungen, MA-Liste, …).
 *
 * Im Gegensatz zum globalen `src/ui/SectionHeader.tsx` mit Border-Bottom
 * unter dem ganzen Label-Text steht die Hairline hier inline rechts neben
 * dem Label — passend zum Handoff-Design.
 */
interface Props {
  label: string;
  count?: string;
  /** Rechts neben der Hairline platzierter Inhalt, z.B. ein View-Switch. */
  trailing?: React.ReactNode;
}

export function InlineCapsHeader({ label, count, trailing }: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="uppercase text-[var(--tf-text-tertiary)] shrink-0"
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: 'var(--tf-tracking-caps)',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {count && (
        <span
          className="text-[var(--tf-text-tertiary)] shrink-0"
          style={{ fontSize: 11.5, lineHeight: 1 }}
        >
          {count}
        </span>
      )}
      <span
        aria-hidden
        className="flex-1"
        style={{ height: '0.5px', background: 'var(--tf-border)' }}
      />
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
