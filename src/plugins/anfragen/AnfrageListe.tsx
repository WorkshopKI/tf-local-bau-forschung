/** Master-Liste der Anfragen (Betreff + Absender + aktueller Status). */
import type { Anfrage } from './types';
import { STATUS_LABEL } from './status';

interface Props {
  anfragen: Anfrage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AnfrageListe({ anfragen, selectedId, onSelect }: Props): React.ReactElement {
  return (
    <ul className="flex flex-col gap-1">
      {anfragen.map(a => {
        const active = a.id === selectedId;
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={`w-full text-left px-3 py-2 rounded-[var(--tf-radius)] transition-colors cursor-pointer ${
                active ? 'bg-[var(--tf-bg-secondary)]' : 'hover:bg-[var(--tf-hover)]'
              }`}
            >
              <div className="truncate text-[13px] text-[var(--tf-text)]">
                {a.betreff || '(ohne Betreff)'}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="truncate text-[11.5px] text-[var(--tf-text-tertiary)]">
                  {a.absenderEmail || '—'}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--tf-text-secondary)]">
                  {STATUS_LABEL[a.status]}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
