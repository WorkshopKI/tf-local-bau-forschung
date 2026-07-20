/**
 * Skala-Kriterium der Entscheidungshilfe: vier Stufen B0…B3 mit den wörtlichen
 * Ankertexten. Rein darstellend.
 *
 * Die Ankertexte stehen vollständig da statt hinter einem Tooltip — sie sind
 * das eigentliche Bewertungsinstrument, nicht eine Erläuterung dazu.
 */
import type { MapItemZustand } from '../checkliste/bewertung';
import type { MapStufe } from '../checkliste/typen';

export function SkalaKarte({
  zustand, onStufe,
}: {
  zustand: MapItemZustand;
  onStufe: (stufe: MapStufe, bemerkung?: string) => void;
}): React.ReactElement {
  const { item, bewertung } = zustand;
  const gewaehlt = bewertung?.stufe ?? null;
  const anker = item.anker ?? [];

  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-3"
      style={{
        border: '0.5px solid var(--tf-border)',
        borderLeft: `3px solid ${gewaehlt === null ? 'transparent' : gewaehlt === 'B0'
          ? 'var(--tf-danger, #dc2626)' : 'var(--tf-primary)'}`,
      }}
    >
      <p className="text-[13px] font-medium text-[var(--tf-text)] leading-snug">{item.kriterium}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2.5">
        {anker.map(a => {
          const aktiv = gewaehlt === a.stufe;
          return (
            <button
              key={a.stufe}
              type="button"
              onClick={() => onStufe(a.stufe, bewertung?.bemerkung)}
              className="text-left rounded p-2 cursor-pointer transition"
              style={{
                border: `0.5px solid ${aktiv ? 'var(--tf-primary)' : 'var(--tf-border)'}`,
                background: aktiv
                  ? 'color-mix(in srgb, var(--tf-primary) 10%, var(--tf-bg))'
                  : 'transparent',
              }}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: aktiv ? 'var(--tf-primary)' : 'var(--tf-text)' }}
                >
                  {a.stufe} · {a.kurz}
                </span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
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
