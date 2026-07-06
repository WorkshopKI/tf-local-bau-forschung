/**
 * Artefakt-Leiste (Journey-Paket 2 Phase 7): Karten-Leiste oberhalb der Daten-
 * Sektionen der Verbund-Detailseite. Zeigt **nur erreichte** Artefakte
 * (Gutachten / Nachforderung) — kein grauer Platzhalter, wenn ein Artefakt noch
 * nicht relevant ist. Daten + Sichtbarkeit kommen aus `useArtefaktLeiste`; die
 * Karten-Hülle ist `ArtefaktKarte`.
 *
 * Aktionen springen in die jeweilige Werkstatt (GA-Abschnitt via `?abschnitt=`,
 * NF-Sektion) — der Aufrufer (`VerbundDetail`) reicht die Sprung-Callbacks.
 */
import type { Antrag } from '@/core/services/csv/types';
import { ArtefaktKarte } from './ArtefaktKarte';
import { useArtefaktLeiste } from './useArtefaktLeiste';
import type { StepStatus } from '../gutachten/types';

interface Props {
  ctxKey: string;
  tvs: Antrag[];
  status: string | null;
  /** Sprung in die GA-Werkstatt (optional an einen Abschnitt). */
  onWeiterGutachten: (stepId?: string) => void;
  /** Sprung in die NF-Werkstatt. */
  onWeiterNachforderung: () => void;
}

const STATUS_WORT: Record<StepStatus, string> = {
  leer: 'offen',
  entwurf: 'im Entwurf',
  freigegeben: 'freigegeben',
};

export function ArtefaktLeiste({ ctxKey, tvs, status, onWeiterGutachten, onWeiterNachforderung }: Props): React.ReactElement | null {
  const { loading, gutachten, nachforderung } = useArtefaktLeiste({ ctxKey, tvs, status });

  if (loading) return null;
  if (!gutachten && !nachforderung) return null;

  return (
    <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {gutachten ? (
        gutachten.kind === 'leer' ? (
          <ArtefaktKarte
            titel="Gutachten"
            zeile="Noch nicht begonnen"
            aktion={{ label: 'Erstellen', onClick: () => onWeiterGutachten() }}
          />
        ) : (
          <ArtefaktKarte
            titel="Gutachten"
            badge={
              <span className="text-[12px] text-[var(--tf-text-tertiary)] tabular-nums whitespace-nowrap">
                {gutachten.freigegeben} / {gutachten.gesamt} freigegeben
              </span>
            }
            progress={{ value: gutachten.freigegeben, max: gutachten.gesamt }}
            zeile={
              <>
                Abschnitt {gutachten.aktiverSchritt}
                {gutachten.aktiverLabel ? ` (${gutachten.aktiverLabel})` : ''} {STATUS_WORT[gutachten.aktiverStatus]}
              </>
            }
            aktion={{ label: `Weiter bei ${gutachten.aktiverSchritt}`, onClick: () => onWeiterGutachten(gutachten.aktiverSchritt) }}
          />
        )
      ) : null}

      {nachforderung ? (
        <ArtefaktKarte
          titel="Nachforderung"
          badge={
            nachforderung.fristKurz ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] whitespace-nowrap">
                Frist {nachforderung.fristKurz}
              </span>
            ) : undefined
          }
          progress={{ value: nachforderung.versendet, max: nachforderung.tvGesamt }}
          zeile={`${nachforderung.versendet} von ${nachforderung.tvGesamt} TVs versendet`}
          aktion={
            nachforderung.naechstesTv
              ? { label: `TV ${nachforderung.naechstesTv.index} vorbereiten`, onClick: onWeiterNachforderung }
              : null
          }
        />
      ) : null}
    </div>
  );
}
