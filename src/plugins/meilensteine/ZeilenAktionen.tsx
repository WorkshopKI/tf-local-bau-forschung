/**
 * Das Bedienbündel am rechten Rand einer Bedingungs-Zeile — für Blätter und
 * Gruppen dasselbe.
 *
 * Bis v5.2 war die Hierarchie beim Anlegen zementiert: eine Bedingung konnte
 * nachträglich weder die Ebene noch den Platz wechseln, und wer sich vertan
 * hatte, löschte und legte neu an. Die fünf Schalter hier sind der Rückweg.
 *
 * Sie stehen **immer** da, nicht erst beim Überfahren: der Meilenstein-Baum
 * eine Ebene höher macht es genauso, und ein Schalter, den man erst finden
 * muss, indem man mit der Maus darüberfährt, ist per Tastatur gar nicht zu
 * erreichen. Gesperrte Schalter nennen ihren Grund im Tooltip, statt zu
 * verblassen (Pitfall #14).
 */
import { ChevronDown, ChevronUp, GripVertical, IndentDecrease, IndentIncrease, X } from 'lucide-react';

export interface ZeilenAktionenProps {
  /** Ziehen erlaubt? Der Griff bekommt dann die HTML5-Drag-Eigenschaften. */
  griffProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
  kannHoch: boolean;
  kannRunter: boolean;
  kannEinruecken: boolean;
  kannAusruecken: boolean;
  /** Warum Einrücken gerade nicht geht — der Tooltip des gesperrten Schalters. */
  einrueckenGrund?: string;
  onHoch: () => void;
  onRunter: () => void;
  onEinruecken: () => void;
  onAusruecken: () => void;
  onEntfernen: () => void;
  /** „Bedingung" oder „Gruppe" — steht in den Beschriftungen der Schalter. */
  was: string;
}

const KNOPF = 'p-0.5 rounded cursor-pointer text-[var(--tf-text-tertiary)] '
  + 'hover:text-[var(--tf-text)] disabled:cursor-not-allowed';

function Schalter({ label, titel, aus, onClick, children }: {
  label: string;
  titel: string;
  aus: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button" aria-label={label} title={titel} disabled={aus}
      onClick={onClick}
      className={KNOPF}
      style={aus ? { color: 'var(--tf-border-hover)' } : undefined}
    >
      {children}
    </button>
  );
}

export function ZeilenAktionen({
  griffProps, kannHoch, kannRunter, kannEinruecken, kannAusruecken, einrueckenGrund,
  onHoch, onRunter, onEinruecken, onAusruecken, onEntfernen, was,
}: ZeilenAktionenProps): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0">
      {griffProps && (
        <span
          {...griffProps}
          title={`${was} ziehen — umsortieren oder in eine andere Gruppe`}
          className="px-0.5 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing"
        >
          <GripVertical size={12} />
        </span>
      )}
      <Schalter
        label={`${was} nach oben`} titel="Nach oben"
        aus={!kannHoch} onClick={onHoch}
      >
        <ChevronUp size={12} />
      </Schalter>
      <Schalter
        label={`${was} nach unten`} titel="Nach unten"
        aus={!kannRunter} onClick={onRunter}
      >
        <ChevronDown size={12} />
      </Schalter>
      <Schalter
        label={`${was} ausrücken`} titel="Eine Ebene höher — hinter die eigene Gruppe"
        aus={!kannAusruecken} onClick={onAusruecken}
      >
        <IndentDecrease size={12} />
      </Schalter>
      <Schalter
        label={`${was} einrücken`}
        titel={kannEinruecken
          ? 'In die Gruppe darüber'
          : (einrueckenGrund ?? 'Nur möglich, wenn direkt darüber eine Gruppe steht.')}
        aus={!kannEinruecken} onClick={onEinruecken}
      >
        <IndentIncrease size={12} />
      </Schalter>
      <button
        type="button" aria-label={`${was} entfernen`} title={`${was} entfernen`}
        onClick={onEntfernen}
        className="p-0.5 rounded cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
      >
        <X size={12} />
      </button>
    </span>
  );
}
