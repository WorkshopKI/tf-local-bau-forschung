/**
 * Skala-Kriterium der Entscheidungshilfe: vier Stufen B0…B3 mit den wörtlichen
 * Ankertexten. Rein darstellend.
 *
 * Die Ankertexte stehen vollständig da statt hinter einem Tooltip — sie sind
 * das eigentliche Bewertungsinstrument, nicht eine Erläuterung dazu.
 *
 * Eine schwache Bewertung muss in einer langen Liste auffallen: B0 und B1
 * färben Akzentkante, Stufenbadge und Kartenfläche. Die Fläche bleibt dabei
 * das sehr helle `-bg`-Token — semantische Farbe trägt hier Kante und Badge,
 * nicht ein satter Hintergrund (DESIGN_GUIDE).
 */
import { istAlarm, signalFuerStufe, type Signalstufe } from '../ansicht/bewertungs-signal';
import type { MapItemZustand } from '../checkliste/bewertung';
import type { MapStufe } from '../checkliste/typen';

/** Signalstufe → Tokens. Die Einstufung selbst liegt in `bewertungs-signal`. */
const TON: Record<Signalstufe, string> = {
  kritisch: 'var(--tf-danger-text)',
  warnung: 'var(--tf-warning-text)',
  neutral: 'var(--tf-primary)',
  gut: 'var(--tf-success-text)',
};

const FLAECHE: Record<Signalstufe, string> = {
  kritisch: 'var(--tf-danger-bg)',
  warnung: 'var(--tf-warning-bg)',
  neutral: 'var(--tf-primary-light)',
  gut: 'var(--tf-success-bg)',
};

const tonFuer = (stufe: MapStufe): string => TON[signalFuerStufe(stufe)];

export function SkalaKarte({
  zustand, onStufe,
}: {
  zustand: MapItemZustand;
  onStufe: (stufe: MapStufe, bemerkung?: string) => void;
}): React.ReactElement {
  const { item, bewertung } = zustand;
  const gewaehlt = bewertung?.stufe ?? null;
  const anker = item.anker ?? [];
  const signal = gewaehlt === null ? null : signalFuerStufe(gewaehlt);

  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-3"
      style={{
        border: '0.5px solid var(--tf-border)',
        borderLeft: `3px solid ${signal === null ? 'transparent' : TON[signal]}`,
        // Nur ein Befund färbt die Fläche — ein Haken bleibt ruhig.
        background: signal !== null && istAlarm(signal) ? FLAECHE[signal] : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 min-w-0 text-[13px] font-medium text-[var(--tf-text)] leading-snug">
          {item.kriterium}
        </p>
        {gewaehlt !== null && signal !== null && (
          <span
            className="shrink-0 text-[11px] font-medium rounded-full px-2.5 py-0.5 tabular-nums"
            style={{ background: FLAECHE[signal], color: TON[signal] }}
          >
            {gewaehlt} · {anker.find(a => a.stufe === gewaehlt)?.punkte ?? 0}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2.5">
        {anker.map(a => {
          const aktiv = gewaehlt === a.stufe;
          const ton = tonFuer(a.stufe);
          return (
            <button
              key={a.stufe}
              type="button"
              onClick={() => onStufe(a.stufe, bewertung?.bemerkung)}
              aria-pressed={aktiv}
              className="text-left rounded p-2 cursor-pointer transition"
              style={{
                border: `0.5px solid ${aktiv ? ton : 'var(--tf-border)'}`,
                background: aktiv
                  ? `color-mix(in srgb, ${ton} 12%, var(--tf-bg))`
                  : 'var(--tf-bg)',
              }}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: aktiv ? ton : 'var(--tf-text)' }}
                >
                  {a.stufe} · {a.kurz}
                </span>
                <span
                  className="text-[11px] tabular-nums"
                  style={{ color: aktiv ? ton : 'var(--tf-text-tertiary)' }}
                >
                  {a.punkte}
                </span>
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {a.merkmale.map(m => (
                  <li key={m} className="text-[11px] text-[var(--tf-text-secondary)] leading-snug">
                    {m}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <textarea
        value={bewertung?.bemerkung ?? ''}
        onChange={e => gewaehlt !== null && onStufe(gewaehlt, e.target.value)}
        disabled={gewaehlt === null}
        placeholder={gewaehlt === null
          ? 'Erst eine Stufe wählen'
          : 'Bemerkung — Pflicht, wenn die vergebene Punktzahl um 1 von der Entscheidungshilfe abweicht'}
        rows={2}
        className="w-full mt-2 text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)] disabled:opacity-50"
        style={{ border: '0.5px solid var(--tf-border)' }}
      />
    </div>
  );
}
