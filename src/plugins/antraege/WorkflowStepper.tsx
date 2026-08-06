/**
 * Die ZAH-Phasen-Leiste des Verbund-Kopfes.
 *
 * Die Position kommt aus dem AMTLICHEN Status (`statusZuStepperPosition`), nicht
 * aus einem WorkflowRun. Darstellung: passierte Stationen tragen ein Häkchen,
 * die aktive einen betonten Ring (fett), künftige einen leeren Ring (gedämpft).
 * Terminal-negativ (`abgelehnt` / `abgelehnt/zurückgezogen`): rotes X an der
 * Abschluss-Station, Status-Label als Beschriftung.
 *
 * **Marker neben der Leiste, nicht darin.** Irrläufer und Sonderstatus laufen
 * neben dem Verfahren — sie bekommen keine Station, sondern ein Kennzeichen
 * davor. Ebenso ein Status, den der Katalog nicht kennt: dann steht die Leiste
 * gedämpft da, statt fälschlich Station 1 zu betonen.
 *
 * `collapsible` (Kompakt-/Narrow-Kontext): eingeklappt nur eine Status-Pille +
 * „Alle Schritte ↓"; sonst die volle Leiste.
 */
import { Fragment, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getStatusVariant, type BadgeVariant } from '@/core/utils/status-mappings';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { zahPhasenGeneration } from '@/core/status/zah-phasen';
import { getStepperStations, statusZuStepperPosition } from './statusZuStepperPosition';

function activeClassFor(variant: BadgeVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]';
    case 'warning':
      return 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]';
    case 'info':
      return 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]';
    case 'error':
      return 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]';
    default:
      return 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]';
  }
}

interface Props {
  status: string;
  /**
   * Eingeklappt-Modus (Kompakt-Layout): Default zeigt nur die Status-Pille
   * „● <Station>, Schritt n/m" (bzw. „✕ <Status>" bei Terminal) + „Alle
   * Schritte ↓"; aufgeklappt der volle Stepper. Ohne den Prop immer voll.
   */
  collapsible?: boolean;
}

export function WorkflowStepper({ status, collapsible = false }: Props): React.ReactElement {
  // Der Generationszähler ist die Abhängigkeit, nicht die Stationen selbst: die
  // Liste kommt aus einem Modul-Register, das der Katalog beim Veröffentlichen
  // neu setzt — ohne ihn zeigte die Leiste ihren Stand vom Mounten.
  const generation = zahPhasenGeneration();
  const stationen = useMemo(() => getStepperStations(), [generation]);
  const { station, terminal, marker } = useMemo(
    () => statusZuStepperPosition(status),
    [status, generation],
  );
  const [open, setOpen] = useState(!collapsible);

  /** Kennzeichen neben der Leiste: Marker bzw. „nicht im Katalog". Der Chip
   *  zeigt die Kurzform, der Tooltip den vollen Bezeichner. */
  const zusatz = marker
    ? 'läuft neben dem Verfahren'
    : station === null && !terminal ? 'keiner Phase zugeordnet' : null;
  const kennzeichen = zusatz === null ? null : `${statusKurzLabel(status)} · ${zusatz}`;
  const kennzeichenVoll = zusatz === null ? undefined : `${statusLabel(status)} · ${zusatz}`;

  const toggle = (label: string, onClick: () => void): React.ReactElement => (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] whitespace-nowrap shrink-0"
    >
      {label}
    </button>
  );

  if (collapsible && !open) {
    const badgeClass = terminal
      ? 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]'
      : activeClassFor(getStatusVariant(status));
    return (
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 h-[26px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap ${badgeClass}`}
          title={statusLabel(status)}
        >
          {terminal ? (
            <X size={13} aria-hidden="true" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
          )}
          {terminal || station === null
            ? statusKurzLabel(status)
            : `${stationen[station - 1]?.label ?? ''}, Schritt ${station} / ${stationen.length}`}
        </span>
        {toggle('Alle Schritte ↓', () => setOpen(true))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-0.5">
      {kennzeichen !== null ? (
        <span
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] whitespace-nowrap bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]"
          title={kennzeichenVoll}
        >
          {kennzeichen}
        </span>
      ) : null}
      {stationen.map(({ id, label }, idx) => {
        const n = idx + 1;
        // Ohne Station (Marker / nicht im Katalog) ist KEINE Stufe aktiv oder
        // passiert — die Leiste steht gedämpft da. Station 1 zu betonen hieße
        // „ganz am Anfang", und das wissen wir gerade nicht.
        const isDone = station !== null && n < station;
        const isActive = station !== null && n === station;
        const isTerminal = isActive && !!terminal;
        // Verbindungs-Linie VOR Station n (idx>0): „erreicht", wenn Station n
        // aktiv oder passiert ist (n <= station). Bei Terminal sitzt die Abbruch-
        // Station bei `station`; Folgelinien (n > station) bleiben ungefüllt.
        const lineReached = station !== null && n <= station;

        return (
          // Schlüssel ist die Id, nicht die Beschriftung: die ist seit v2.409
          // frei und darf sich zwischen zwei Phasen doppeln.
          <Fragment key={id}>
            {idx > 0 ? (
              <span
                className="flex-1 h-px min-w-[10px]"
                style={{ background: lineReached ? 'var(--tf-text-tertiary)' : 'var(--tf-border)' }}
                aria-hidden="true"
              />
            ) : null}
            <div className="flex items-center gap-1.5 shrink-0">
              <StepperDot state={isTerminal ? 'terminal' : isActive ? 'active' : isDone ? 'done' : 'future'} />
              <span
                className={`text-[13px] whitespace-nowrap ${labelClass(isTerminal, isActive, isDone)}`}
                title={isTerminal ? statusLabel(status) : undefined}
              >
                {isTerminal ? statusKurzLabel(status) : label}
              </span>
            </div>
          </Fragment>
        );
      })}
      {collapsible ? toggle('↑ einklappen', () => setOpen(false)) : null}
    </div>
  );
}

function labelClass(isTerminal: boolean, isActive: boolean, isDone: boolean): string {
  if (isTerminal) return 'font-semibold text-[var(--tf-danger-text)]';
  if (isActive) return 'font-semibold text-[var(--tf-text)]';
  if (isDone) return 'text-[var(--tf-text-secondary)]';
  return 'text-[var(--tf-text-tertiary)]';
}

function StepperDot({ state }: { state: 'done' | 'active' | 'future' | 'terminal' }): React.ReactElement {
  const base = 'w-4 h-4 rounded-full flex items-center justify-center shrink-0';
  switch (state) {
    case 'done':
      return (
        <span className={base} style={{ border: '1px solid var(--tf-text-tertiary)' }}>
          <Check size={10} className="text-[var(--tf-text-secondary)]" aria-hidden="true" />
        </span>
      );
    case 'active':
      return <span className={base} style={{ border: '2px solid var(--tf-text)' }} aria-hidden="true" />;
    case 'terminal':
      return (
        <span className={base} style={{ border: '1.5px solid var(--tf-danger-text)' }}>
          <X size={10} className="text-[var(--tf-danger-text)]" aria-hidden="true" />
        </span>
      );
    default:
      return <span className={base} style={{ border: '1px solid var(--tf-border)' }} aria-hidden="true" />;
  }
}
