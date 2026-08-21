/**
 * Das Bedienbündel am rechten Rand einer Bedingungs-Zeile — für Blätter und
 * Gruppen dasselbe.
 *
 * Bis v5.2 war die Hierarchie beim Anlegen zementiert: eine Bedingung konnte
 * nachträglich weder die Ebene noch den Platz wechseln, und wer sich vertan
 * hatte, löschte und legte neu an. Die Schalter hier sind der Rückweg.
 *
 * Sie stehen **immer** da, nicht erst beim Überfahren: der Meilenstein-Baum
 * eine Ebene höher macht es genauso, und ein Schalter, den man erst finden
 * muss, indem man mit der Maus darüberfährt, ist per Tastatur gar nicht zu
 * erreichen. Gesperrte Schalter nennen ihren Grund im Tooltip, statt zu
 * verblassen (Pitfall #14).
 *
 * **Ein gesperrter Schalter sagt, warum** (v6.3). Vorher trug er in beiden
 * Zuständen denselben `title` — „Eine Ebene höher — hinter die eigene Gruppe"
 * stand also auch dort, wo es keine höhere Ebene gibt, und versprach eine
 * Wirkung, die er nicht hatte. Dazu kommt die Farbe: `--tf-border-hover` war
 * als 12-px-Icon praktisch unsichtbar, weshalb ein korrekt gesperrter Schalter
 * wie ein kaputter aussah. Aktiv trägt jetzt `--tf-text-secondary` (gemessen
 * 5,33:1), gesperrt `--tf-text-tertiary` — beide sichtbar, klar unterscheidbar.
 */
import {
  ChevronDown, ChevronUp, Group, GripVertical, IndentDecrease, IndentIncrease, X,
} from 'lucide-react';

export interface ZeilenAktionenProps {
  /** Ziehen erlaubt? Der Griff bekommt dann die HTML5-Drag-Eigenschaften. */
  griffProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
  kannHoch: boolean;
  kannRunter: boolean;
  kannEinruecken: boolean;
  kannAusruecken: boolean;
  kannVerpacken: boolean;
  /** Warum Einrücken gerade nicht geht — der Tooltip des gesperrten Schalters. */
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
  /** „Bedingung" oder „Gruppe" — steht in den Beschriftungen der Schalter. */
  was: string;
}

const KNOPF = 'p-0.5 rounded cursor-pointer hover:text-[var(--tf-text)] '
  + 'disabled:cursor-not-allowed';

function Schalter({ label, titel, gesperrtTitel, aus, onClick, children }: {
  label: string;
  /** Was der Schalter tut — im aktiven Zustand. */
  titel: string;
  /** Warum er gerade nicht kann — im gesperrten Zustand. */
  gesperrtTitel: string;
  aus: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button" aria-label={label} title={aus ? gesperrtTitel : titel} disabled={aus}
      onClick={onClick}
      className={KNOPF}
      style={{ color: aus ? 'var(--tf-text-tertiary)' : 'var(--tf-text-secondary)' }}
    >
      {children}
    </button>
  );
}

/** Trennt zwei Schalter-Paare, damit sieben Icons nicht als graue Kette lesen. */
const LUECKE = <span aria-hidden className="w-1.5" />;

export function ZeilenAktionen({
  griffProps, kannHoch, kannRunter, kannEinruecken, kannAusruecken, kannVerpacken,
  einrueckenGrund, ausrueckenGrund, verpackenGrund,
  onHoch, onRunter, onEinruecken, onAusruecken, onVerpacken, onEntfernen, was,
}: ZeilenAktionenProps): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0">
      {griffProps && (
        <>
          <span
            {...griffProps}
            title={`${was} ziehen — umsortieren oder in eine andere Gruppe`}
            className="px-1 py-0.5 rounded cursor-grab active:cursor-grabbing
              text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
          >
            <GripVertical size={14} />
          </span>
          {LUECKE}
        </>
      )}
      <Schalter
        label={`${was} nach oben`} titel="Nach oben"
        gesperrtTitel={`${was} steht schon ganz oben.`}
        aus={!kannHoch} onClick={onHoch}
      >
        <ChevronUp size={13} />
      </Schalter>
      <Schalter
        label={`${was} nach unten`} titel="Nach unten"
        gesperrtTitel={`${was} steht schon ganz unten.`}
        aus={!kannRunter} onClick={onRunter}
      >
        <ChevronDown size={13} />
      </Schalter>
      {LUECKE}
      <Schalter
        label={`${was} ausrücken`} titel="Eine Ebene höher — hinter die eigene Gruppe"
        gesperrtTitel={ausrueckenGrund
          ?? 'Steht bereits auf der obersten Ebene — parallel zu den übrigen Bedingungen.'}
        aus={!kannAusruecken} onClick={onAusruecken}
      >
        <IndentDecrease size={13} />
      </Schalter>
      <Schalter
        label={`${was} einrücken`} titel="In die Gruppe darüber"
        gesperrtTitel={einrueckenGrund
          ?? 'Nur möglich, wenn direkt darüber eine Gruppe steht.'}
        aus={!kannEinruecken} onClick={onEinruecken}
      >
        <IndentIncrease size={13} />
      </Schalter>
      {LUECKE}
      <Schalter
        label={`${was} in eine eigene Gruppe verpacken`}
        titel="Eine Gruppe darum legen — die Aussage bleibt gleich; danach lassen sich weitere Bedingungen hineinziehen"
        gesperrtTitel={verpackenGrund ?? 'Die tiefste Ebene ist erreicht.'}
        aus={!kannVerpacken} onClick={onVerpacken}
      >
        <Group size={13} />
      </Schalter>
      {LUECKE}
      <button
        type="button" aria-label={`${was} entfernen`} title={`${was} entfernen`}
        onClick={onEntfernen}
        className="p-0.5 rounded cursor-pointer text-[var(--tf-text-secondary)]
          hover:text-[var(--tf-danger-text)]"
      >
        <X size={13} />
      </button>
    </span>
  );
}
