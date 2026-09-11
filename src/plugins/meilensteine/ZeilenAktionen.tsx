/**
 * Das Bedienbündel einer Bedingungs-Zeile — für Blätter und Gruppen dasselbe:
 * der **Griff** zum Ziehen und ein **⋯-Menü** mit den Umbau-Schaltern.
 *
 * Bis v6.58 standen hier sieben Icons nebeneinander, per `ml-auto` an den
 * rechten Rand geschoben. Die PL fand den Bereich damit „nicht übersichtlich":
 * bei voller Breite lag das Bündel eine halbe Bildschirmbreite von seiner Zeile
 * entfernt, und sieben graue Zeichen je Zeile lasen sich als Rauschen. Das Menü
 * steht jetzt direkt am Zeileninhalt und schreibt aus, was es tut.
 *
 * **Ohne Maus erreichbar**: ein Radix-DropdownMenu (Tab auf ⋯, Enter,
 * Pfeiltasten). Der Grund, weshalb die Schalter früher „immer sichtbar"
 * standen, gilt damit weiter. Gesperrte Einträge bleiben sichtbar und nennen
 * ihren Grund in einer zweiten Zeile, statt zu verblassen (Pitfall #14) — es
 * sind dieselben Gründe, die vorher im Tooltip standen. Die Farben bleiben
 * gemessen: gesperrt `--tf-text-tertiary`, der Grund `--tf-text-secondary`
 * (5,33:1), weil er Bedeutung trägt.
 *
 * **Tastatur-Ereignisse enden am Menü.** Es liegt im Portal, React reicht seine
 * Ereignisse aber durch den KOMPONENTEN-Baum weiter — und darüber liegt der
 * Meilenstein-`TfTree`, dessen Pfeiltasten sonst die Auswahl verschöben.
 */
import {
  ChevronDown, ChevronUp, Group, GripVertical, IndentDecrease, IndentIncrease, MoreHorizontal, X,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ZeilenAktionenProps {
  /** Ziehen erlaubt? Der Griff bekommt dann die HTML5-Drag-Eigenschaften. */
  griffProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
  kannHoch: boolean;
  kannRunter: boolean;
  kannEinruecken: boolean;
  kannAusruecken: boolean;
  kannVerpacken: boolean;
  /** Warum Einrücken gerade nicht geht — die zweite Zeile des gesperrten Eintrags. */
  einrueckenGrund?: string;
  /** Warum Ausrücken gerade nicht geht. */
  ausrueckenGrund?: string;
  /** Warum Verpacken gerade nicht geht. */
  verpackenGrund?: string;
  onHoch: () => void;
  onRunter: () => void;
  onEinruecken: () => void;
  onAusruecken: () => void;
  onVerpacken: () => void;
  onEntfernen: () => void;
  /** „Bedingung" oder „Gruppe" — steht in den Beschriftungen. */
  was: string;
}

function Eintrag({ icon: Icon, label, grund, aus, onSelect, gefahr = false }: {
  icon: LucideIcon;
  label: string;
  /** Warum gesperrt — erscheint nur, wenn `aus`. */
  grund?: string;
  aus: boolean;
  onSelect: () => void;
  gefahr?: boolean;
}): React.ReactElement {
  const farbe = aus
    ? 'text-[var(--tf-text-tertiary)]'
    : (gefahr ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text)]');
  return (
    <DropdownMenuItem
      disabled={aus}
      onSelect={onSelect}
      className={`items-start text-[12.5px] data-disabled:opacity-100 ${farbe}`}
    >
      <Icon className="mt-[2px] size-3.5" />
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {aus && grund && (
          <span className="text-[11px] leading-snug text-[var(--tf-text-secondary)]">{grund}</span>
        )}
      </span>
    </DropdownMenuItem>
  );
}

export function ZeilenAktionen({
  griffProps, kannHoch, kannRunter, kannEinruecken, kannAusruecken, kannVerpacken,
  einrueckenGrund, ausrueckenGrund, verpackenGrund,
  onHoch, onRunter, onEinruecken, onAusruecken, onVerpacken, onEntfernen, was,
}: ZeilenAktionenProps): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {griffProps && (
        <span
          {...griffProps}
          title={`${was} ziehen — umsortieren oder in eine andere Gruppe`}
          className="px-0.5 py-0.5 rounded cursor-grab active:cursor-grabbing
            text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
        >
          <GripVertical size={14} />
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${was}: weitere Aktionen`}
            title={`${was}: verschieben, ein-/ausrücken, verpacken, entfernen`}
            className="p-0.5 rounded cursor-pointer text-[var(--tf-text-secondary)]
              hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] data-[state=open]:bg-[var(--tf-hover)]"
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72" onKeyDown={e => e.stopPropagation()}>
          <Eintrag
            icon={ChevronUp} label="Nach oben" aus={!kannHoch}
            grund={`${was} steht schon ganz oben.`} onSelect={onHoch}
          />
          <Eintrag
            icon={ChevronDown} label="Nach unten" aus={!kannRunter}
            grund={`${was} steht schon ganz unten.`} onSelect={onRunter}
          />
          <DropdownMenuSeparator />
          <Eintrag
            icon={IndentDecrease} label="Eine Ebene höher — hinter die eigene Gruppe" aus={!kannAusruecken}
            grund={ausrueckenGrund ?? 'Steht bereits auf der obersten Ebene — parallel zu den übrigen Bedingungen.'}
            onSelect={onAusruecken}
          />
          <Eintrag
            icon={IndentIncrease} label="In die Gruppe darüber" aus={!kannEinruecken}
            grund={einrueckenGrund ?? 'Nur möglich, wenn direkt darüber eine Gruppe steht.'}
            onSelect={onEinruecken}
          />
          <Eintrag
            icon={Group} label="In eine eigene Gruppe verpacken" aus={!kannVerpacken}
            grund={verpackenGrund ?? 'Die tiefste Ebene ist erreicht.'}
            onSelect={onVerpacken}
          />
          <DropdownMenuSeparator />
          <Eintrag icon={X} label={`${was} entfernen`} aus={false} gefahr onSelect={onEntfernen} />
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
