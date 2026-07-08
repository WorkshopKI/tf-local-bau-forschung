/**
 * Gemeinsame Layout-Primitives fuer die Einstellungs-Tabs (Profil, Meine
 * Technologien, …). Inline-Row-Layout aus dem Design-Handoff
 * `_design/handoff/einstellungen-*` ("Variante-B-Stil").
 */
import { Tooltip } from '@/components/ui/Tooltip';

export function SettingsRow({
  children,
  gap = 'md',
}: {
  children: React.ReactNode;
  gap?: 'md' | 'lg';
}): React.ReactElement {
  const gapCls = gap === 'lg' ? 'gap-4' : 'gap-5';
  return <div className={`flex items-center ${gapCls} flex-wrap min-h-9`}>{children}</div>;
}

export function SettingsRowGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="inline-flex items-center gap-2.5">{children}</div>;
}

export function SettingsRowSeparator(): React.ReactElement {
  return <div className="w-px h-5 bg-[var(--tf-border)]" aria-hidden />;
}

export function Avatar({ initials }: { initials: string }): React.ReactElement {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-medium shrink-0"
      style={{
        background: 'hsl(var(--tf-primary-h), var(--tf-primary-s), 35%)',
        letterSpacing: '0.03em',
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

/** 16-px-Info-Icon mit Tooltip, tastatur-fokussierbar. */
export function InfoHint({ text }: { text: string }): React.ReactElement {
  return (
    <Tooltip text={text}>
      <span
        tabIndex={0}
        role="img"
        aria-label="Info"
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-medium text-[var(--tf-text-tertiary)] cursor-help bg-[var(--tf-bg)] hover:text-[var(--tf-text)] focus:text-[var(--tf-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
        style={{ border: '0.5px solid var(--tf-border-hover)', lineHeight: 1 }}
      >
        i
      </span>
    </Tooltip>
  );
}

/**
 * Section-Header gemaess Design-Handoff: uppercase 10.5px Label, optional
 * Mono-Counter, optional Info-Icon, trailing-Hairline ueber `flex-1`.
 *
 * (Bewusst NICHT die globale `<SectionHeader>` ueberschrieben — die
 * Darstellung/Speicher-Tabs nutzen weiterhin ihre Border-Bottom-Variante.)
 */
export function SettingsSectionHeader({
  label,
  count,
  hint,
  right,
  action,
}: {
  label: string;
  count?: number;
  hint?: string;
  /** Optionaler rechtsbündiger Zusatz nach der Hairline (z.B. „6 gewählt"). Tertiär. */
  right?: React.ReactNode;
  /**
   * Optionale primär-farbige Aktion nach der Hairline (z.B. „Neu zählen").
   * Handoff `.sh-action` — für klickbare Zusätze, während `right` tertiäre
   * Zustandstexte trägt.
   */
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] shrink-0">
        {label}
      </span>
      {count != null && (
        <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
          {count}
        </span>
      )}
      {hint && <InfoHint text={hint} />}
      <div className="flex-1 h-px bg-[var(--tf-border)]" aria-hidden />
      {right != null && (
        <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">{right}</span>
      )}
      {action != null && <span className="shrink-0">{action}</span>}
    </div>
  );
}

/**
 * Datei-/Ordner-Zeile gemäß Design-Handoff `.frow`: Icon-Kachel + Name·Wert
 * (+ optional grüner Status-Punkt + Info) + optionale Meta-Zeile darunter +
 * rechtsbündige Aktionen. Aufeinanderfolgende Rows tragen eine Trenn-Hairline
 * oben (`first={false}`).
 */
export function SettingsFileRow({
  icon,
  name,
  value,
  connected,
  hint,
  meta,
  actions,
  first = false,
}: {
  icon: React.ReactNode;
  name: string;
  value?: string;
  /** Zeigt den grünen „verbunden"-Punkt hinter Name/Wert. */
  connected?: boolean;
  hint?: string;
  /** Optionale zweite Zeile unter dem Namen (z.B. „Letzter CSV-Import: …"). */
  meta?: React.ReactNode;
  /** Rechtsbündige Aktionen (Buttons). */
  actions?: React.ReactNode;
  first?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${first ? '' : 'border-t border-[var(--tf-border)]'}`}
    >
      <span className="w-[30px] h-[30px] rounded-lg bg-[var(--tf-bg-secondary)] inline-flex items-center justify-center text-[var(--tf-text-secondary)] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium text-[var(--tf-text)] flex items-center gap-[7px] flex-wrap leading-tight">
          <span>{name}</span>
          {value && (
            <>
              <span className="text-[var(--tf-text-tertiary)] font-normal">·</span>
              <span className="font-normal text-[var(--tf-text-secondary)]">{value}</span>
            </>
          )}
          {connected && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--tf-success-text)] inline-block"
              aria-hidden
            />
          )}
          {hint && <InfoHint text={hint} />}
        </p>
        {meta && <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-0.5 leading-snug">{meta}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * Gestrichelte Hinweis-Karte gemäß Design-Handoff `.notecard`: Badge + Text +
 * optionaler Info-Hint (z.B. „Persönliche Dokumentenquellen · In Vorbereitung").
 */
export function SettingsNoteCard({
  badge,
  children,
  hint,
}: {
  badge?: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}): React.ReactElement {
  return (
    <div
      className="rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg-secondary)] px-3.5 py-3 flex items-center gap-3 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]"
      style={{ border: '0.5px dashed var(--tf-border-hover)' }}
    >
      {badge}
      <span className="flex-1">{children}</span>
      {hint && <InfoHint text={hint} />}
    </div>
  );
}
