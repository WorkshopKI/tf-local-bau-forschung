/**
 * Kartenansicht der Anfragen: responsives Tile-Grid (Status-Badge · Betreff ·
 * Absender · Datum), Klick öffnet das Detail. Löschen als Hover-Aktion oben rechts.
 */
import type { Anfrage } from './types';
import { AnfrageStatusBadge } from './AnfrageStatusBadge';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { formatAnfrageDatum } from './format';

interface Props {
  anfragen: Anfrage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AnfrageKarten({ anfragen, selectedId, onSelect }: Props): React.ReactElement {
  if (anfragen.length === 0) {
    return <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-6 text-center">Keine Anfragen.</p>;
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {anfragen.map(a => {
        const active = a.id === selectedId;
        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(a.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a.id); } }}
            className={`group flex flex-col gap-2 p-4 rounded-[12px] cursor-pointer transition-colors ${
              active ? 'bg-[var(--tf-bg-secondary)]' : 'hover:bg-[var(--tf-bg-secondary)]'
            }`}
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AnfrageStatusBadge status={a.status} />
              <AnfrageDeleteControl anfrage={a} revealOnHover />
            </div>
            <div
              className="text-[13.5px] font-medium text-[var(--tf-text)] line-clamp-2 leading-snug"
              title={a.betreff || '(ohne Betreff)'}
            >
              {a.betreff || '(ohne Betreff)'}
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span className="truncate" title={a.absenderEmail || undefined}>{a.absenderEmail || '—'}</span>
              <span className="shrink-0">{formatAnfrageDatum(a.erstelltAm)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
