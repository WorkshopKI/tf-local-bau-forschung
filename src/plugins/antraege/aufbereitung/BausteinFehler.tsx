/**
 * Fehlerzustand eines KI-Bausteins — EINE Implementierung für alle Tabs.
 *
 * Vorher trug jeder Tab seine eigene Kopie mit dem fest verdrahteten Satz „Der interne
 * KI-Dienst ist derzeit nicht erreichbar" — eine Behauptung, die oft falsch war: der
 * Lauf scheitert genauso an der DSGVO-Transport-Policy (externer Provider), an einer
 * nicht auswertbaren Antwort oder an einem gesperrten Abschnitt. Seit `laufEinen` den
 * Grund in `begruendung` mitführt, wird er angezeigt; der alte Satz bleibt nur als
 * Rückfall, wenn kein Grund vorliegt.
 */
import { Button } from '@/components/ui/button';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';

export function BausteinFehler({ begruendung, bausteine }: {
  /** Grund aus dem Baustein-Status (`BausteinUiState.begruendung`). */
  begruendung?: string;
  bausteine: UseAsyncActionResult<[]>;
}): React.ReactElement {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-center">
      <div className="text-[14px] text-[var(--tf-text)]">KI-Aufbereitung nicht möglich</div>
      <div className="max-w-[460px] text-[12.5px] text-[var(--tf-text-tertiary)] leading-snug">
        {begruendung ?? 'Der interne KI-Dienst war nicht erreichbar.'}
      </div>
      <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
