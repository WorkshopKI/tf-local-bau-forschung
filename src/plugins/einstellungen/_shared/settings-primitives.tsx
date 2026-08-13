/**
 * Gemeinsame Layout-Primitives fuer die Einstellungs-Tabs (Profil, Meine
 * Technologien, …). Inline-Row-Layout aus dem Design-Handoff
 * `_design/handoff/einstellungen-*` ("Variante-B-Stil").
 */
import { ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';

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

export function Avatar({ text }: { text: string }): React.ReactElement {
  // 3+ Zeichen (z.B. „THÜ"): kleinere Schrift damit das Kürzel im 36-px-Kreis Platz hat.
  const fontSize = text.length >= 3 ? 10 : 13;
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{
        background: 'hsl(var(--tf-primary-h), var(--tf-primary-s), 35%)',
        letterSpacing: '0.03em',
        fontSize,
      }}
      aria-hidden
    >
      {text}
    </div>
  );
}

/**
 * 15-px-Info-ⓘ mit KLICK-Popover (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`).
 *
 * Bis v4.27 ein Hover-Tooltip. Der Redesign-Grundsatz lautet „jeder Satz, der
 * ueber eine Zeile hinausgeht, gehoert ins ⓘ" — damit tragen diese Texte jetzt
 * die Erklaerungen, die vorher als Absatz auf der Seite standen. Ein
 * Hover-Tooltip taugt dafuer nicht: er verschwindet beim Lesen, ist per
 * Tastatur muehsam und auf Touch gar nicht erreichbar. Radix regelt „genau
 * eines offen", Esc und Klick daneben.
 */
export function InfoHint({ text, titel }: { text: string; titel?: string }): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={titel ? `Info: ${titel}` : 'Info'}
        className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9.5px] font-medium text-[var(--tf-text-tertiary)] cursor-pointer bg-transparent shrink-0 hover:text-[var(--tf-primary)] hover:border-[var(--tf-primary)] data-[state=open]:text-[var(--tf-primary)] data-[state=open]:border-[var(--tf-primary)] data-[state=open]:bg-[var(--tf-primary-light)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
        style={{ border: '0.5px solid var(--tf-border-hover)', lineHeight: 1 }}
      >
        i
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[320px] gap-1 bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] text-[12px] leading-[1.55] px-3 py-2.5 rounded-[var(--tf-radius)] ring-0"
        style={{ border: '0.5px solid var(--tf-border)', boxShadow: 'var(--tf-shadow-dialog)' }}
      >
        {titel && (
          <span className="block text-[12px] font-medium text-[var(--tf-text)]">{titel}</span>
        )}
        {text}
      </PopoverContent>
    </Popover>
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
 * Aufklappbarer Einstellungs-Abschnitt im `SettingsSectionHeader`-Look
 * (uppercase 10.5px-Label + Hairline), erweitert um einen führenden Chevron und
 * einen klickbaren Kopf. Auf-/Zu-Zustand persistiert pro `storageKey`
 * (localStorage, unter `file://` verfügbar) über `useCollapsedSection`.
 *
 * Eingeklappt wird der Body NICHT gemountet (leichtgewichtig, spart Scrollhöhe);
 * der `<section id>`-Anker bleibt aber immer erhalten, damit die Einstellungs-
 * Suche + Deep-Links (`?sektion=…`) weiter zum Kopf springen können.
 */
export function CollapsibleSettingsSection({
  id,
  label,
  storageKey,
  defaultOpen = true,
  count,
  right,
  children,
}: {
  id: string;
  label: string;
  /** localStorage-Key für den persistenten Auf-/Zu-Zustand. */
  storageKey: string;
  /** Startzustand, falls noch kein Wert gespeichert ist (Default: offen). */
  defaultOpen?: boolean;
  count?: number;
  /** Rechtsbündiger Zusatz nach der Hairline (z.B. „6 sichtbar") — auch sichtbar
   *  wenn eingeklappt, als Kurz-Zusammenfassung. */
  right?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  const [open, toggle] = useCollapsedSection(storageKey, { defaultOpen });
  return (
    <section id={id} className="scroll-mt-20">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`group flex items-center gap-2.5 w-full text-left ${open ? 'mb-3.5' : ''}`}
      >
        <ChevronRight
          size={13}
          className="shrink-0 text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-text-secondary)]"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--tf-duration-med) var(--tf-ease)',
          }}
        />
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] shrink-0 group-hover:text-[var(--tf-text-secondary)]">
          {label}
        </span>
        {count != null && (
          <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
            {count}
          </span>
        )}
        <div className="flex-1 h-px bg-[var(--tf-border)]" aria-hidden />
        {right != null && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">{right}</span>
        )}
      </button>
      {open && children}
    </section>
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
  spacious = false,
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
  /** Größerer vertikaler Innenabstand (py-4 statt py-3) — opt-in, damit nur
   *  gezielte Abschnitte (z.B. Speicherorte) luftiger werden, kein globaler Drift. */
  spacious?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 ${spacious ? 'py-4' : 'py-3'} ${first ? '' : 'border-t border-[var(--tf-border)]'}`}
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

export interface SettingsChipToggleOption {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
  /** Tooltip (Grund bei `disabled`). */
  title?: string;
}

/**
 * Mehrfachauswahl-Chips mit Check-Icon für Einstellungs-Formulare (v2.229,
 * Home-Widget-Mockups). Dünne Komposition über den kanonischen `ToggleChip`
 * (layout-stabil, Pitfall #14) — hier kommt nur das Options-Mapping dazu.
 *
 * Der frühere klickbare `suffix` („· 2 Sp." als verschachteltes `role="button"`
 * IM Chip) ist entfallen: eine zweite Einstellung gehört nicht als verstecktes
 * Klickziel in einen Auswahl-Chip. Wer Auswahl UND einen Wert je Zeile braucht,
 * nimmt `LaneListe` (@/components/ui/LaneListe).
 *
 * Bewusst GENERISCH gehalten: das UI-Redesign-Paket 4 (Settings-Chips-Pattern)
 * setzt später auf dieses Primitive auf — keine Widget-Spezifika einbauen.
 */
export function SettingsChipToggle({
  options,
  selectedKeys,
  onToggle,
}: {
  options: SettingsChipToggleOption[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <ToggleChip
          key={opt.key}
          selected={selectedKeys.has(opt.key)}
          disabled={opt.disabled}
          title={opt.title}
          onToggle={() => onToggle(opt.key)}
          label={opt.label}
        />
      ))}
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
