/**
 * EIN Menü für mehrere Darstellungs-Achsen einer Liste (Gruppierung, Dichte,
 * Sichtbarkeit …) — statt je Achse ein eigenes „…: …"-Dropdown in der Toolbar.
 *
 * Der Knopf trägt im Normalfall nur „Darstellung" und ist damit schmaler als
 * jeder einzelne Vorgänger. Weicht eine Achse ab, steht ihr Wert dahinter
 * („Darstellung: Antrag mit TV"); weichen mehrere ab, folgt die Zahl der
 * übrigen als „+2" statt einer wachsenden Kette — was gerade anders ist, bleibt
 * sichtbar, ohne dass der Knopf mit jeder Achse breiter wird.
 *
 * **Zeilen-Pattern** (Design-Handoff, `_design/handoff/dropdown/`): eine Achse =
 * EINE Zeile, Beschriftung links, Auswahl rechts. Vorher kostete jede Achse
 * zwei Beschriftungszeilen plus eine 30-px-Zeile je Wert; drei Achsen ergaben
 * ein Menü von rund 430 px. Die Erklärzeile unter der Überschrift ist damit
 * ersatzlos entfallen — die Beschriftung erklärt die Achse selbst.
 *
 * **Das Menü bleibt nach einer Wahl offen.** Es ist kein Einzel-Schalter,
 * sondern mehrere nebeneinander; nach jedem Klick zu schließen zwänge zum
 * Wiederöffnen, sobald jemand zwei Achsen stellt. Geschlossen wird per Klick
 * daneben (`useClickOutside`) oder mit Esc.
 *
 * Welche Achsen gelten und was als Standard zählt, rechnet der Aufrufer in
 * einem reinen Modul (`darstellungsAchsen.ts` je Seite) — hier steht nur die
 * Darstellung. „Zurücksetzen" braucht deshalb auch keine eigene Prop: es sind
 * dieselben `onChange`, die ein Klick auf den Standardwert auslösen würde.
 *
 * Aus dem Handoff bewusst NICHT übernommen: die `chips`-Variante (kein Label
 * beider Seiten ist lang genug dafür), der eigene Popover-Schatten (DESIGN_GUIDE
 * Kap. 5 lässt genau einen zu — `--tf-shadow-dialog`), die Zustands-Haltung per
 * `localStorage` (die liegt bei den Seiten) und alle Hex-Werte (→ `--tf-*`,
 * sonst wäre der Dark Mode kaputt).
 *
 * Visuelle Familie = `ColumnPicker`/`MultiSelectDropdown` (gerahmter Knopf +
 * Menü, `--tf-*`-Theming), damit die Toolbar-Steuerungen einer Seite fluchten.
 * Geteilt seit v3.24 (vorher `plugins/antraege/`), Aufrufer: Förderanträge und
 * Feedback-Board.
 */
import { useId, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { SegmentedToggle } from './SegmentedToggle';
import { Switch } from './switch';
import {
  darstellungsZusammenfassung,
  schalterAn,
  schalterAusKey,
  zuruecksetzenAufrufe,
  type DarstellungAchse,
} from './darstellungsAchsen';

interface Props<Id extends string> {
  achsen: readonly DarstellungAchse<Id>[];
  onChange: (id: Id, key: string) => void;
  /** Tooltip des Knopfes — er nennt die Achsen dieser Seite beim Namen. */
  titel?: string;
  /** Auf den Trigger gemergt (z.B. `h-8`, wo die Toolbar 32px fährt). */
  className?: string;
}

/** Eine Achse als Zeile: Beschriftung links, Bedienelement rechts. */
function Zeile<Id extends string>({ achse, trenner, onChange }: {
  achse: DarstellungAchse<Id>;
  /** Ab der zweiten Zeile eine Haarlinie darüber. */
  trenner: boolean;
  onChange: (id: Id, key: string) => void;
}): React.ReactElement {
  const gestapelt = achse.stapel === true;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-[7px] px-2 py-[7px] rounded-[var(--tf-radius)] min-h-[34px]"
      // Haarlinie als inset-Schatten statt als `border`: ein Rand zählt zur
      // Zeilenhöhe und verschöbe die 34px-Rasterung um einen halben Pixel.
      style={trenner ? { boxShadow: 'inset 0 0.5px 0 var(--tf-border)' } : undefined}
    >
      <span
        className={gestapelt
          ? 'w-full text-[11px] uppercase tracking-[0.05em] text-[var(--tf-text-tertiary)]'
          : 'shrink-0 pl-0.5 text-[12.5px] leading-[1.3] text-[var(--tf-text-secondary)]'}
      >
        {achse.label}
      </span>
      {achse.art === 'schalter' ? (
        <Switch
          className="ml-auto"
          aria-label={achse.label}
          checked={schalterAn(achse)}
          onCheckedChange={an => onChange(achse.id, an ? achse.anKey : schalterAusKey(achse))}
        />
      ) : (
        <div className={gestapelt ? 'w-full' : 'ml-auto min-w-0'}>
          <SegmentedToggle
            rolle="auswahl"
            breit={gestapelt}
            ariaLabel={achse.label}
            value={achse.value}
            onChange={key => onChange(achse.id, key)}
            options={achse.options.map(o => ({ id: o.key, label: o.label }))}
          />
        </div>
      )}
    </div>
  );
}

export function DarstellungDropdown<Id extends string>({
  achsen, onChange, titel, className,
}: Props<Id>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const menueId = useId();
  useClickOutside(containerRef, () => setOpen(false), open);

  const { text, weitere } = darstellungsZusammenfassung(achsen);
  const alleAufStandard = text === '';

  const zuruecksetzen = (): void => {
    // Dieselben Aufrufe, die ein Klick auf den jeweiligen Standardwert
    // auslösen würde — kein zweiter Schreibweg an den Stores vorbei.
    for (const { id, key } of zuruecksetzenAufrufe(achsen)) onChange(id, key);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={e => {
        if (e.key !== 'Escape' || !open) return;
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menueId : undefined}
        title={titel ?? 'Darstellung der Liste'}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-1${className ? ` ${className}` : ''}`}
        style={open
          ? { border: '0.5px solid var(--tf-primary)', boxShadow: '0 0 0 2.5px var(--tf-primary-light)' }
          : { border: '0.5px solid var(--tf-border)' }}
      >
        <SlidersHorizontal size={14} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[var(--tf-text-tertiary)]">
          Darstellung{alleAufStandard ? '' : ':'}
        </span>
        {alleAufStandard ? null : <span className="font-medium">{text}</span>}
        {weitere > 0 ? (
          <span className="font-medium text-[var(--tf-primary)]">+{weitere}</span>
        ) : null}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          id={menueId}
          role="dialog"
          aria-label="Darstellung"
          className="absolute top-full right-0 mt-1.5 z-[100] w-[380px] max-w-[calc(100vw-24px)] bg-[var(--tf-bg)] rounded-[var(--tf-radius-lg)] overflow-hidden"
          style={{ border: '0.5px solid var(--tf-border)', boxShadow: 'var(--tf-shadow-dialog)' }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{
              borderBottom: '0.5px solid var(--tf-border)',
              background: 'var(--tf-card-surface)',
            }}
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
              Darstellung
            </span>
            <button
              type="button"
              onClick={zuruecksetzen}
              disabled={alleAufStandard}
              className="ml-auto text-[11.5px] px-[5px] py-[3px] rounded-[5px] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text-secondary)] disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-1"
            >
              Zurücksetzen
            </button>
          </div>
          <div className="px-1.5 pt-1 pb-1.5">
            {achsen.map((a, i) => (
              <Zeile key={a.id} achse={a} trenner={i > 0} onChange={onChange} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
