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
 * Aufklappen zeigt die volle Liste.
 *
 * **Drei Zustände, nicht zwei** (v4.124): `Y` · `N` · `—` für „nicht erfasst".
 * Ein Kennzeichen ohne jeden Wert als „N" zu drucken ist eine fachliche
 * Verneinung, die die Daten nicht hergeben (siehe `FlagDescriptor.erfasst`).
 * Der Nenner der Zusammenfassung zählt nur die erfassten.
 *
 * **Die Suche filtert auch hier** (v4.124): vorher schrumpften die normalen
 * Gruppen auf ihre Treffer, während der Cluster alle Chips zeigte — und das
 * Abzeichen daneben nannte trotzdem die gefilterte Zahl.
 */
export function FlagCluster({ subgroups, query }: Props): React.ReactElement {
  const [openName, setOpenName] = useState<string | null>(null);
  const ql = query.trim().toLowerCase();

  // Bei aktiver Suche nur die passenden Kennzeichen — Zeile für Zeile, wie in den
  // normalen Feldgruppen. Unterbereiche ohne Treffer fallen ganz weg.
  const sichtbar = ql.length === 0
    ? subgroups
    : subgroups
      .map(sg => ({ ...sg, descriptors: sg.descriptors.filter(d => d.label.toLowerCase().includes(ql)) }))
      .filter(sg => sg.descriptors.length > 0);

  if (sichtbar.length === 0) {
    return <div className="af-grp-body"><span className="af-empty">Kein Kennzeichen passt zur Suche.</span></div>;
  }

  return (
    <div className="af-grp-body">
      {sichtbar.map(sg => {
        const isOpen = openName === sg.name || ql.length > 0;
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
                <span className="res">
                  {sg.total > 0 ? `keine zutreffend · 0 / ${sg.total}` : 'nichts erfasst'}
                  {sg.nichtErfasst > 0 && sg.total > 0 ? ` · ${sg.nichtErfasst} nicht erfasst` : ''}
                </span>
              )}
            </button>
            {isOpen ? (
              <div className="af-flaglist">
                {sg.descriptors.map((d, i) => (
                  <span key={`${d.label}-${i}`} className="af-flagitem">
                    <span className="lbl">{d.label}</span>
                    <span
                      className={'val' + (d.isYes ? ' y' : '')}
                      title={d.erfasst ? undefined : 'Für dieses Kennzeichen ist nichts erfasst.'}
                    >
                      {d.isYes ? 'Y' : d.erfasst ? 'N' : '—'}
                    </span>
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
