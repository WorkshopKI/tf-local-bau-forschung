/**
 * Deterministische Regelprüfung EINES Abschnitts — sitzt links unter dem Entwurf
 * (aufgeklappt über den Meta-Zeilen-Trigger in `SectionReviewCard`), nicht mehr
 * rechts im `KontextPanel`. Die Prüfung gehört an den Text, den sie bewertet.
 *
 * Reiner Anzeige-Block: gruppiert die flachen `checks` über `groupChecksByKategorie`
 * und rendert je Kategorie eine `AmpelGruppe` (grün → zu, gelb/rot → auf). Die
 * Fußzeile trägt „Neu prüfen" (`applyPruefen`-Pfad) — die Aktion sitzt bewusst DORT,
 * wo ihr Ergebnis sichtbar ist.
 */
import type { CheckResult } from '@/core/services/skills';
import { CheckList, type CheckListAktion } from '../kurzfassung/CheckList';
import { AmpelGruppe } from './AmpelGruppe';
import { groupChecksByKategorie } from './checkGruppen';

interface Props {
  checks: CheckResult[];
  /**
   * Prüfpanel-Aktionen (Journey-Paket 3, opt-in): regel-gebundene KI-Korrektur je
   * Fehler-Check + Fundstellen-Sprung. Fehlt → nur-Anzeige.
   */
  aktion?: CheckListAktion;
  /** Regeln erneut rechnen; fehlt im freigegebenen/generierenden Zustand. */
  onPruefen?: () => void;
}

export function PruefBlock({ checks, aktion, onPruefen }: Props): React.ReactElement | null {
  if (checks.length === 0) return null;
  return (
    <div className="g-pruefblock-inner">
      <div className="flex flex-col">
        {groupChecksByKategorie(checks).map(g => (
          <AmpelGruppe
            key={g.kategorie}
            label={g.label}
            level={g.worst}
            summary={g.summary}
            count={g.checks.length}
            defaultOpen={g.worst !== 'ok'}
          >
            <CheckList checks={g.checks} aktion={aktion} />
          </AmpelGruppe>
        ))}
      </div>
      {onPruefen && (
        <div className="g-pruefblock-foot">
          <button
            type="button"
            className="g-btn ghost sm"
            onClick={onPruefen}
            title="Regeln erneut gegen den aktuellen Text rechnen — z.B. nachdem im Skill Regeln geändert wurden."
          >
            Neu prüfen
          </button>
        </div>
      )}
    </div>
  );
}
