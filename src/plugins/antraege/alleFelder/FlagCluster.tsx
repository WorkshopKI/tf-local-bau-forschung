import { useState } from 'react';
import type { FlagSubgroup } from './flags';

/** Caret-Icon (rotiert via `.af-caret.open`-Klasse — kein Inline-Style). */
function Caret({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg className={'af-caret' + (open ? ' open' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface Props {
  subgroups: FlagSubgroup[];
  /** Aktive Suche — Unterbereiche mit Treffer klappen automatisch auf. */
  query: string;
}

/**
 * Konsolidierte Technologie-Kennzeichen (Hebel 3): pro Unterbereich eine
 * Zusammenfassungszeile — grüne Chips für „Y", sonst „keine zutreffend · 0/N".
 * Aufklappen zeigt die volle N/Y-Liste (Y grün hervorgehoben).
 */
export function FlagCluster({ subgroups, query }: Props): React.ReactElement {
  const [openName, setOpenName] = useState<string | null>(null);
  const ql = query.trim().toLowerCase();

  return (
    <div className="af-grp-body">
      {subgroups.map(sg => {
        const matchOpen = ql.length > 0 && sg.descriptors.some(d => d.label.toLowerCase().includes(ql));
        const isOpen = openName === sg.name || matchOpen;
        const yes = sg.descriptors.filter(d => d.isYes);
        return (
          <div key={sg.name}>
            <button
              type="button"
              className="af-flagsum"
              onClick={() => setOpenName(isOpen ? null : sg.name)}
              aria-expanded={isOpen}
            >
              <Caret open={isOpen} />
              <span className="lbl">{sg.name}</span>
              {yes.length > 0 ? (
                <span>{yes.map((d, i) => <span key={`${d.label}-${i}`} className="af-chip">{d.label}</span>)}</span>
              ) : (
                <span className="res">keine zutreffend · 0 / {sg.total}</span>
              )}
            </button>
            {isOpen ? (
              <div className="af-flaglist">
                {sg.descriptors.map((d, i) => (
                  <span key={`${d.label}-${i}`} className="af-flagitem">
                    <span className="lbl">{d.label}</span>
                    <span className={'val' + (d.isYes ? ' y' : '')}>{d.isYes ? 'Y' : 'N'}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
