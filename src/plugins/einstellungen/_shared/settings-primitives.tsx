/**
 * Gemeinsame Layout-Primitives fuer die Einstellungs-Tabs (Profil, Meine
 * Technologien, …). Inline-Row-Layout aus dem Design-Handoff
 * `_design/handoff/einstellungen-*` ("Variante-B-Stil").
 */
import { Tooltip } from '@/ui';

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
}: {
  label: string;
  count?: number;
  hint?: string;
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
    </div>
  );
}
