/**
 * Bausteine des Startseiten-Menüs — Maße aus dem Handoff (§5): Panel min. 250 px,
 * Radius 11 px, Rahmen 0.5 px, Innenabstand 5 px; Einträge 7/10 px, Radius 7 px,
 * Schrift 12,5 px; Gruppentitel 10 px Versalien in `--tf-text-tertiary`.
 *
 * Alle Farben laufen über `--tf-*` — der Handoff-Prototyp führt eigene Hex-Werte,
 * die hier keine Entsprechung brauchen: sein Light-Satz IST der Bestand
 * (`--app/--card/--bd/--hov` = `--tf-desk/--tf-bg/--tf-border/--tf-hover`).
 */
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Ein Panel des Menüs (Hauptmenü, Untermenü, Einstellungs-Ansicht). */
export function MenuePanel({ breite, maxHoehe, children }: {
  /** Handoff: Hauptmenü min. 250 px, Untermenü 268 px. */
  breite: number;
  /**
   * Deckel in Pixeln statt der `78vh`-Klasse — das Untermenü hängt an seiner
   * Zeile und kann deshalb tiefer beginnen als das Hauptmenü; sein Platz nach
   * unten misst der Aufrufer.
   */
  maxHoehe?: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={`rounded-[11px] bg-[var(--tf-bg)] p-[5px] overflow-y-auto${maxHoehe ? '' : ' max-h-[78vh]'}`}
      style={{
        width: breite,
        maxHeight: maxHoehe,
        border: '0.5px solid var(--tf-border-hover)',
        boxShadow: 'var(--tf-shadow-dialog)',
      }}
    >
      {children}
    </div>
  );
}

/** Gruppentitel; `aktion` ist der „alle"-Schalter der Spalte. */
export function MenueLabel({ children, aktion }: {
  children: React.ReactNode;
  aktion?: { label: string; onClick: () => void };
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-2 pb-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
        {children}
      </span>
      {aktion ? (
        <button
          type="button"
          onClick={aktion.onClick}
          className="ml-auto rounded-[5px] px-1 py-0.5 text-[11px] text-[var(--tf-primary)] cursor-pointer hover:bg-[var(--tf-hover)] focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-1"
        >
          {aktion.label}
        </button>
      ) : null}
    </div>
  );
}

export function MenueTrenner(): React.ReactElement {
  return <div className="my-[5px] mx-1.5 h-[0.5px] bg-[var(--tf-border)]" aria-hidden />;
}

export interface MenueZeileProps {
  label: string;
  icon?: LucideIcon;
  /** Rechtsbündiger Zusatz — Positionsanzeige „2 / 5" oder Tastenkürzel. */
  kuerzel?: string;
  /** Führt in ein Untermenü: Pfeil rechts, öffnet beim Überfahren und beim Klick. */
  untermenue?: boolean;
  /** Am Spaltenrand ausgegraut statt versteckt (Handoff §2.2). */
  deaktiviert?: boolean;
  /** Hebt die Zeile hervor, solange ihr Untermenü offen ist. */
  aktiv?: boolean;
  onClick?: () => void;
  onHover?: (el: HTMLElement) => void;
}

export function MenueZeile({
  label, icon: Icon, kuerzel, untermenue, deaktiviert, aktiv, onClick, onHover,
}: MenueZeileProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={deaktiviert}
      // Marker für den Panel-Handler: das Überfahren JEDER anderen Zeile schließt
      // das offene Untermenü — sonst bliebe es stehen, während der Zeiger schon
      // zwei Einträge weiter ist.
      data-untermenue={untermenue ? '1' : undefined}
      aria-haspopup={untermenue ? 'menu' : undefined}
      aria-expanded={untermenue ? !!aktiv : undefined}
      // Überfahren, Klick und `→` öffnen das Untermenü — der bloße FOKUS nicht:
      // Radix setzt den Fokus beim Öffnen auf die erste Zeile, ein `onFocus` hier
      // hätte also jedes Menü sofort mit offenem Untermenü gezeigt (v4.7.0-Fehler).
      onClick={e => { onClick?.(); if (untermenue) onHover?.(e.currentTarget); }}
      onMouseEnter={e => onHover?.(e.currentTarget)}
      onKeyDown={e => {
        if (untermenue && e.key === 'ArrowRight') { e.preventDefault(); onHover?.(e.currentTarget); }
      }}
      className={`flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-[-2px] ${
        deaktiviert
          ? 'text-[var(--tf-text-tertiary)] cursor-default'
          : `text-[var(--tf-text)] cursor-pointer hover:bg-[var(--tf-hover)]${aktiv ? ' bg-[var(--tf-hover)]' : ''}`
      }`}
    >
      {Icon ? <Icon size={14} strokeWidth={1.3} className="shrink-0 text-[var(--tf-text-tertiary)]" /> : null}
      <span className="truncate">{label}</span>
      {kuerzel ? (
        <span className="ml-auto shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">{kuerzel}</span>
      ) : null}
      {untermenue ? (
        <ChevronRight
          size={13}
          className={`shrink-0 text-[var(--tf-text-tertiary)]${kuerzel ? '' : ' ml-auto'}`}
        />
      ) : null}
    </button>
  );
}

/** Kästchen-Zeile der Widget-Checkliste — Häkchen links, Pfeile beim Überfahren. */
export function MenueHakenZeile({
  label, icon: Icon, an, onToggle, hoch, runter,
}: {
  label: string;
  icon: LucideIcon;
  an: boolean;
  onToggle: () => void;
  hoch?: { moeglich: boolean; onClick: () => void };
  runter?: { moeglich: boolean; onClick: () => void };
}): React.ReactElement {
  return (
    <div className="group flex items-center gap-2.5 rounded-[7px] px-2.5 py-[6px] hover:bg-[var(--tf-hover)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={an}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-[12.5px] text-[var(--tf-text)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-2"
      >
        <span
          aria-hidden
          className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px]"
          style={an
            ? { background: 'var(--tf-primary)', border: '1px solid var(--tf-primary)' }
            : { border: '1px solid var(--tf-border-hover)' }}
        >
          {/* Häkchen mit `invisible` statt bedingtem Rendern: konstante Breite,
              kein Sprung beim Umschalten (Pitfall #14). */}
          <svg viewBox="0 0 16 16" width={10} height={10} className={an ? '' : 'invisible'}>
            <path d="m3.5 8.5 3 3 6-6" fill="none" stroke="var(--tf-primary-foreground)" strokeWidth={2.4} />
          </svg>
        </span>
        <Icon size={14} strokeWidth={1.3} className="shrink-0 text-[var(--tf-text-tertiary)]" />
        <span className="truncate">{label}</span>
      </button>
      <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {[hoch, runter].map((p, i) => p ? (
          <button
            key={i}
            type="button"
            disabled={!p.moeglich}
            aria-label={`${label} ${i === 0 ? 'nach oben' : 'nach unten'}`}
            onClick={p.onClick}
            className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] ${
              p.moeglich
                ? 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-border)] hover:text-[var(--tf-text)] cursor-pointer'
                : 'text-[var(--tf-text-tertiary)] opacity-30 cursor-default'
            }`}
          >
            <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              {i === 0
                ? <path d="M8 12.4V4M4.6 7.4 8 4l3.4 3.4" />
                : <path d="M8 3.6V12M4.6 8.6 8 12l3.4-3.4" />}
            </svg>
          </button>
        ) : null)}
      </span>
    </div>
  );
}
