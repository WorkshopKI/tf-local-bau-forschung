/**
 * Stepper als View-Umschalter (Layout A): zeigt den echten Pipeline-Status
 * (done/active/future aus `statusIndex`) UND schaltet beim Klick die Detail-View
 * (Steps 1–3 → „anon", 4–5 → „answer"). Der active-Ring bleibt am echten
 * Status-Schritt; die Schritte der gezeigten View tragen zusätzlich `viewing`.
 */
import { Fragment } from 'react';
import { STATUS_LABEL, STATUS_REIHENFOLGE, statusIndex } from './status';
import type { AnfrageStatus } from './types';

export type DetailView = 'anon' | 'answer';

/** Welche View ein Schritt umschaltet (Index 0–2 → anon, 3–4 → answer). */
const VIEW_OF_STEP: readonly DetailView[] = ['anon', 'anon', 'anon', 'answer', 'answer'];

export function viewForStatus(status: AnfrageStatus): DetailView {
  const i = statusIndex(status);
  return VIEW_OF_STEP[i] ?? 'anon';
}

interface Props {
  status: AnfrageStatus;
  view: DetailView;
  onPick: (view: DetailView) => void;
}

export function AnfrageStepper({ status, view, onPick }: Props): React.ReactElement {
  const aktuell = statusIndex(status);
  return (
    <div className="awd-stepper">
      {STATUS_REIHENFOLGE.map((s, i) => {
        const done = i < aktuell;
        const active = i === aktuell;
        const viewing = VIEW_OF_STEP[i] === view;
        const cls = `awd-step${done ? ' done' : ''}${active ? ' active' : ''}${viewing ? ' viewing' : ''}`;
        return (
          <Fragment key={s}>
            <button
              type="button"
              className={cls}
              aria-current={active ? 'step' : undefined}
              title={`Ansicht: ${VIEW_OF_STEP[i] === 'anon' ? 'Anonymisierung' : 'Antwort einsetzen'}`}
              onClick={() => onPick(VIEW_OF_STEP[i]!)}
            >
              <span className="awd-n">{done ? '✓' : i + 1}</span>
              {STATUS_LABEL[s]}
            </button>
            {i < STATUS_REIHENFOLGE.length - 1 && <span className="awd-sep">›</span>}
          </Fragment>
        );
      })}
    </div>
  );
}
