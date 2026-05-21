/**
 * Banner-Komponente die das Validation-Ergebnis der KI-Analyse anzeigt.
 *  - vollstaendig+hoch → gruener Akzent
 *  - sonst → amber Akzent
 *
 * Bewusst kein `bg-emerald-*`-Pattern — wir bleiben monochrom-akzentiert
 * gemaess DESIGN_GUIDE und mischen nur die Hex-Akzente fuer den Status-Dot.
 */
import type { ValidationResult } from './analyse/stages/validation';

export interface ValidationBannerProps {
  validation: ValidationResult;
}

export function ValidationBanner({ validation }: ValidationBannerProps): React.ReactElement {
  const ok = validation.vollstaendig && validation.konfidenz === 'hoch';
  const color = ok ? '#10b981' : '#f59e0b';
  return (
    <div
      className="mb-3 px-3 py-2 text-[12px] rounded"
      style={{ border: `0.5px solid ${color}55`, backgroundColor: `${color}11` }}
    >
      <p style={{ color }}>
        {ok ? 'Analyse abgeschlossen' : `Pruefe Ergebnisse (Konfidenz: ${validation.konfidenz})`} · {validation.zusammenfassung}
      </p>
      {validation.warnungen.length > 0 && (
        <ul className="mt-1 text-[var(--tf-text-secondary)] list-disc list-inside">
          {validation.warnungen.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
