/**
 * Verbund-Kopf (Journey-Paket 2 Phase 6): Identität + Stepper als Wirbelsäule.
 *
 * Aufbau: Titelzeile = Akronym + ZKN + Eckdaten-Meta (Programm/Typ · TV-Anzahl ·
 * Antragsdatum · Beantragt) inline hinter dem FKZ; darunter der Projekt-Titel
 * (Untertitel); dann der amtliche Stepper (ersetzt das frühere Status-Badge).
 * Die Kurzzusammenfassung (VB_INHALT) lebt bewusst NICHT hier, sondern als
 * eigene `KurzbeschreibungCard` direkt unter dem Kopf.
 */
import { Fragment } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import { XswSuffix } from './XswSuffix';
import { WorkflowStepper } from './WorkflowStepper';
import { buildKopfEckdaten } from './kopfEckdaten';

interface Props {
  akronym: string;
  /** ZKN / Aktenzeichen (mono, tertiär). */
  headerId: string;
  /** Projekt-Titel (Untertitel-Zeile). */
  untertitel: string | null;
  /** T_XSW-Suffix des Lead-TV (an den Untertitel angehängt). */
  xsw: string | null;
  /** Amtlicher Status für den Stepper (Verbund-Aggregat). */
  stepperStatus: string | null;
  /** TVs + Unterprogramm-Label für die Eckdaten-Meta. */
  tvs: Antrag[];
  unterprogramm: string | null;
}

export function VerbundKopf({
  akronym,
  headerId,
  untertitel,
  xsw,
  stepperStatus,
  tvs,
  unterprogramm,
}: Props): React.ReactElement {
  const eckdaten = buildKopfEckdaten({ tvs, unterprogramm });

  return (
    <div className="mb-4">
      {/* Titelzeile: Akronym + ZKN + Eckdaten-Meta (hinter dem FKZ). */}
      <div className="flex items-baseline gap-x-2.5 gap-y-1 flex-wrap">
        <h1 className="text-[20px] font-medium text-[var(--tf-text)] leading-tight tracking-[-0.01em]">
          {akronym}
        </h1>
        <span className="text-[12px] text-[var(--tf-text-tertiary)] font-mono">{headerId}</span>
        {eckdaten.length > 0 ? (
          <span className="inline-flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[12px] text-[var(--tf-text-secondary)]">
            <span aria-hidden="true" className="text-[var(--tf-text-tertiary)]">·</span>
            {eckdaten.map((seg, i) => (
              <Fragment key={i}>
                {i > 0 ? <span aria-hidden="true" className="text-[var(--tf-text-tertiary)]">·</span> : null}
                <span className="whitespace-nowrap">{seg}</span>
              </Fragment>
            ))}
          </span>
        ) : null}
      </div>

      {/* Untertitel: Projekt-Titel (+ optionaler XSW-Suffix). */}
      {untertitel ? (
        <p className="mt-2 m-0 text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] whitespace-pre-wrap">
          {untertitel}
          <XswSuffix value={xsw} />
        </p>
      ) : xsw ? (
        <div className="mt-2 text-[12.5px]">
          <XswSuffix value={xsw} />
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
