/**
 * Verbund-Kopf (Journey-Paket 2 Phase 6): Identität + Stepper als Wirbelsäule.
 *
 * Ersetzt den bisherigen Kopf-Block (Akronym + Status-Badge + Titel) und die
 * separate „Kurzbeschreibung"-Sektion. Das Status-Badge ENTFÄLLT — der Stepper
 * (`WorkflowStepper`, gespeist aus `statusZuStepperPosition`) IST die Status-
 * anzeige. Aufbau: Akronym + ZKN, 3-Zeilen-geklammte Beschreibung mit
 * „mehr/weniger", Eckdaten-Zeile, Stepper.
 */
import type { Antrag } from '@/core/services/csv/types';
import { XswSuffix } from './XswSuffix';
import { WorkflowStepper } from './WorkflowStepper';
import { buildKopfEckdaten } from './kopfEckdaten';

interface Props {
  akronym: string;
  /** ZKN / Aktenzeichen (mono, tertiär). */
  headerId: string;
  /** Beschreibungstext (Titel + Kurzzusammenfassung), 3-Zeilen-Clamp. */
  beschreibung: string | null;
  /** T_XSW-Suffix des Lead-TV (an die Beschreibung angehängt). */
  xsw: string | null;
  /** Beschreibung auf-/zugeklappt (geteilter `kbOpen`-State). */
  beschreibungOffen: boolean;
  onToggleBeschreibung: () => void;
  /** Amtlicher Status für den Stepper (Verbund-Aggregat). */
  stepperStatus: string | null;
  /** TVs + Unterprogramm-Label für die Eckdaten-Zeile. */
  tvs: Antrag[];
  unterprogramm: string | null;
}

/** Ab dieser Länge wird die Beschreibung geklammt (3 Zeilen + „mehr"). */
const CLAMP_THRESHOLD = 220;

export function VerbundKopf({
  akronym,
  headerId,
  beschreibung,
  xsw,
  beschreibungOffen,
  onToggleBeschreibung,
  stepperStatus,
  tvs,
  unterprogramm,
}: Props): React.ReactElement {
  const eckdaten = buildKopfEckdaten({ tvs, unterprogramm });
  const clampable = !!beschreibung && beschreibung.length > CLAMP_THRESHOLD;

  return (
    <div className="mb-4">
      {/* Identität: Akronym + ZKN (kein Status-Badge — der Stepper ist der Status). */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-[20px] font-medium text-[var(--tf-text)] leading-tight tracking-[-0.01em]">
          {akronym}
        </h1>
        <span className="text-[12px] text-[var(--tf-text-tertiary)] font-mono">{headerId}</span>
      </div>

      {/* Beschreibung: Titel + Kurzzusammenfassung, 3-Zeilen-Clamp + mehr/weniger. */}
      {beschreibung ? (
        <div className="mt-2">
          <p
            className={`m-0 text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] whitespace-pre-wrap${
              clampable && !beschreibungOffen ? ' line-clamp-3' : ''
            }`}
          >
            {beschreibung}
            <XswSuffix value={xsw} />
          </p>
          {clampable ? (
            <button
              type="button"
              onClick={onToggleBeschreibung}
              className="mt-1 text-[12px] text-[var(--tf-primary)] hover:opacity-80"
            >
              {beschreibungOffen ? '↑ weniger' : '… mehr'}
            </button>
          ) : null}
        </div>
      ) : xsw ? (
        <div className="mt-2 text-[12.5px]">
          <XswSuffix value={xsw} />
        </div>
      ) : null}

      {/* Eckdaten: Programm/Typ · TV-Anzahl · Antragsdatum · Beantragt (T€). */}
      {eckdaten.length > 0 ? (
        <div className="mt-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-[var(--tf-text-secondary)]">
          {eckdaten.map((seg, i) => (
            <span key={i} className="whitespace-nowrap">
              {seg}
            </span>
          ))}
        </div>
      ) : null}

      {/* Stepper: amtliche 5-Stationen-Wirbelsäule (ersetzt das Status-Badge). */}
      {stepperStatus ? (
        <div className="mt-3.5">
          <WorkflowStepper status={stepperStatus} />
        </div>
      ) : null}
    </div>
  );
}
