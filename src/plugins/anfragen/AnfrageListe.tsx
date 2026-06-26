/** Listenansicht der Anfragen (Betreff + Absender + farbiger Status + Datum). */
import type { Anfrage } from './types';
import { AnfrageStatusBadge } from './AnfrageStatusBadge';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { formatAnfrageDatum } from './format';

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
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(a.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a.id); } }}
              className={`group w-full text-left px-3 py-2 rounded-[var(--tf-radius)] transition-colors cursor-pointer ${
                active ? 'bg-[var(--tf-bg-secondary)]' : 'hover:bg-[var(--tf-hover)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-[13px] text-[var(--tf-text)]" title={a.betreff || '(ohne Betreff)'}>
                  {a.betreff || '(ohne Betreff)'}
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <AnfrageStatusBadge status={a.status} />
                  <AnfrageDeleteControl anfrage={a} revealOnHover />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="truncate text-[11.5px] text-[var(--tf-text-tertiary)]" title={a.absenderEmail || undefined}>
                  {a.absenderEmail || '—'}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
                  {formatAnfrageDatum(a.erstelltAm)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
