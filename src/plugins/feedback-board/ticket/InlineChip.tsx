/**
 * Inline-Chip = Verwaltung direkt an der Karte (v3.12, Handoff feedback-redesign).
 *
 * Der Kern des Redesigns: Status, Aufwand, Zuständigkeit und Bereich sind
 * klickbare Chips mit Popover statt Felder in einem eingeklappten Akkordeon vier
 * Ebenen tiefer. Ohne Schreibrecht (oder in der Nutzer-Vorschau) rendert
 * derselbe Chip read-only — gleiche Optik, gleiche Breite, kein Layout-Sprung
 * zwischen den Rollen.
 *
 * Popover statt eines eigenen Menüs: ein DropdownMenu ist im Projekt nicht
 * installiert, und Radix' Popover portalt — sonst schnitte das `overflow` der
 * Board-Spalte das Menü ab.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { IconComponent } from '@/components/feedback/feedbackUi';

export interface InlineChipProps {
  label: string;
  /** Farbpunkt vor dem Label (Statusfarbe). */
  dot?: string;
  icon?: IconComponent;
  /** Nichts gesetzt → gestrichelter Rand, tertiäre Schrift. */
  leer?: boolean;
  /** Zusätzliche Klasse, z.B. `bereich`. */
  klasse?: string;
  titel?: string;
  /** Fehlt das Menü, ist der Chip eine reine Anzeige (kein Knopf). */
  menue?: (schliessen: () => void) => React.ReactNode;
}

export function InlineChip({
  label, dot, icon: Icon, leer, klasse, titel, menue,
}: InlineChipProps): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const klassen = ['fb-chip', leer ? 'leer' : '', klasse ?? '', menue ? '' : 'ro']
    .filter(Boolean).join(' ');

  const inhalt = (
    <>
      {dot && <span className="fb-dot" style={{ background: dot }} aria-hidden />}
      {Icon && <Icon size={11} aria-hidden />}
      <span className="fb-chip-text">{label}</span>
      {menue && <ChevronDown size={10} className="opacity-50 shrink-0" aria-hidden />}
    </>
  );

  if (!menue) {
    return <span className={klassen} title={titel ?? label}>{inhalt}</span>;
  }

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={klassen}
          title={titel ?? label}
          // Der Klick darf NICHT zur Karte durchperlen — sonst öffnet jeder
          // Chip-Klick nebenbei das Detail-Panel.
          onClick={e => e.stopPropagation()}
        >
          {inhalt}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-[196px] max-w-[280px] p-[5px]"
        onClick={e => e.stopPropagation()}
      >
        {menue(() => setOffen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Eine Zeile im Chip-Popover — dieselbe Optik für Auswahl- und Aktionsmenüs. */
export function PopZeile({ label, sub, dot, icon: Icon, aktiv, gefahr, onClick }: {
  label: string;
  sub?: string;
  dot?: string;
  icon?: IconComponent;
  aktiv?: boolean;
  gefahr?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={['fb-pop-i', aktiv ? 'an' : '', gefahr ? 'gefahr' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {dot && <span className="fb-dot" style={{ background: dot }} aria-hidden />}
      {Icon && <Icon size={13} aria-hidden />}
      <span className="truncate">{label}</span>
      {sub && <span className="fb-sub">{sub}</span>}
    </button>
  );
}

export function PopLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="fb-pop-lbl">{children}</div>;
}

export function PopTrenner(): React.ReactElement {
  return <div className="fb-pop-sep" aria-hidden />;
}
