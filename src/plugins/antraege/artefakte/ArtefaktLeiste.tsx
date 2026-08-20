/**
 * Artefakt-Leiste (Journey-Paket 2 Phase 7): Karten-Leiste oberhalb der Daten-
 * Sektionen der Verbund-Detailseite. Zeigt **nur erreichte** Artefakte — kein
 * grauer Platzhalter, wenn ein Artefakt noch nicht relevant ist. Daten +
 * Sichtbarkeit kommen aus `useArtefaktLeiste`; die Karten-Hülle ist `ArtefaktKarte`.
 *
 * Seit dem Gutachten-Merge trägt die Leiste **nur noch die Nachforderung** — das
 * Gutachten ist als vollständige Werkstatt-Sektion nach oben gewandert
 * (Fortschritt + „Weiter bei X" leben dort im Sektionskopf). Die Aktion springt
 * in die NF-Werkstatt; der Aufrufer (`VerbundDetail`) reicht den Sprung-Callback.
 */
import type { Antrag } from '@/core/services/csv/types';
import { ArtefaktKarte } from './ArtefaktKarte';
import { useArtefaktLeiste } from './useArtefaktLeiste';

interface Props {
  ctxKey: string;
  tvs: Antrag[];
  status: string | null;
  /**
   * Sprung in die NF-Werkstatt — `null`, wenn das Ziel gerade nicht im Dokument
   * steht (die Beta-/Experten-Achse verbirgt die Werkbank- bzw.
   * Nachforderungs-Sektion). Dann entfällt die Aktion, statt einen Knopf
   * anzubieten, dessen Klick wortlos nichts tut (Pitfall #54: der Wirt spricht
   * nicht von dem, was die Achse verbirgt).
   */
  onWeiterNachforderung: (() => void) | null;
}

export function ArtefaktLeiste({ ctxKey, tvs, status, onWeiterNachforderung }: Props): React.ReactElement | null {
  const { loading, nachforderung } = useArtefaktLeiste({ ctxKey, tvs, status });

  if (loading) return null;
  if (!nachforderung) return null;

  return (
    <div className="mb-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
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
          nachforderung.naechstesTv && onWeiterNachforderung
            ? { label: `TV ${nachforderung.naechstesTv.index} vorbereiten`, onClick: onWeiterNachforderung }
            : null
        }
      />
    </div>
  );
}
