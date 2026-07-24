/**
 * Aspekt-Chips A–J (Mehrfachauswahl) — geteilt von Baustein-Editor und Import-Assistent.
 * Konstante Breite über `min-w`, Häkchen via Farbe/Rahmen statt Layout-Sprung
 * (DESIGN_GUIDE Kap. 5). Die Aspekt-Namen stehen im Tooltip.
 */
import { PRUEF_ASPEKTE } from '@/plugins/antraege/aufbereitung';

export function AspektChips({
  gewaehlt, onToggle, disabled,
}: {
  gewaehlt: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRUEF_ASPEKTE.map(a => {
        const aktiv = gewaehlt.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            title={`${a.id}: ${a.name} — ${a.fokus}`}
            aria-pressed={aktiv}
            onClick={() => onToggle(a.id)}
            className={`min-w-[30px] text-[12px] px-2 py-1 rounded-[7px] border transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60 ${
              aktiv
                ? 'border-[var(--tf-primary)] bg-[var(--tf-primary)] text-white'
                : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]'
            }`}
          >
            {a.id}
          </button>
        );
      })}
    </div>
  );
}
