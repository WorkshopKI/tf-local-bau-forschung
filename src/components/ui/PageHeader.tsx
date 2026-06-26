import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Seitentitel (H1). */
  title: string;
  /** Optionaler Meta-/Profil-Text rechts neben dem Titel, durch eine vertikale
   *  Haarlinie abgesetzt (z.B. Auslastung „Embedding-Katalog …", Förderanträge
   *  „Profil: THÜ"). */
  subtitle?: React.ReactNode;
  /** Optionaler Inhalt direkt neben dem Titel OHNE Trenner (z.B. eine
   *  Bearbeiter-Filter-Pill). */
  meta?: React.ReactNode;
  /** Optionale rechtsbündige Aktionen. */
  actions?: React.ReactNode;
  /** Zusätzliche Klassen am Wrapper (z.B. Bottom-Margin / abweichendes gap). */
  className?: string;
}

/**
 * Kanonischer Seitenkopf: großer Titel (+ optionale Meta-Zeile / Aktionen).
 * Domänenfrei — destilliert aus den hand-rolled H1s der Module (Förderanträge,
 * Auslastung, Einstellungen). Styling ausschließlich über --tf-*-Tokens.
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">
        {title}
      </h1>
      {meta}
      {subtitle != null && (
        <p
          className="text-[12px] text-[var(--tf-text-tertiary)]"
          style={{ paddingLeft: 14, marginLeft: 14, borderLeft: '0.5px solid var(--tf-border)' }}
        >
          {subtitle}
        </p>
      )}
      {actions != null && <div className="ml-auto shrink-0">{actions}</div>}
    </div>
  );
}
