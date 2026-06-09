/**
 * NichtVorgeschlagenListe (v2.48) — macht die bisher stillen Matcher-Ausschlüsse
 * sichtbar. Beantwortet „warum wird MA X nicht vorgeschlagen?": kategorie-
 * relevante MAs (Haupt- oder Nebenkompetenz in der Primärkategorie), die der
 * Matcher gefiltert hat, mit kurzer Begründung. Standardmäßig eingeklappt.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AusgeschlossenerMa, AusschlussGrund } from '../types';
import { AnonymIdBadge } from './AnonymIdBadge';

interface Props {
  ausgeschlossen: AusgeschlossenerMa[];
  resolveName: (anonId: string) => string | null;
}

const GRUND_TEXT: Record<AusschlussGrund, string> = {
  'antragstyp': 'bearbeitet diesen Antragstyp nicht',
  'keine-stunden': 'keine Stunden gepflegt',
  'kein-onboarding': 'Onboarding/Historie fehlt',
  'abgemeldet': 'im Quartal abgemeldet',
  'inaktiv': 'als inaktiv markiert',
  'rang': 'niedrigere Passung',
};

/** Sortier-Priorität: knappe Rang-Verlierer zuerst (die sind am ehesten
 *  „eigentlich geeignet"), dann die harten Filtergründe. */
const GRUND_ORDER: Record<AusschlussGrund, number> = {
  'rang': 0,
  'antragstyp': 1,
  'kein-onboarding': 2,
  'keine-stunden': 3,
  'abgemeldet': 4,
  'inaktiv': 5,
};

function grundLabel(item: AusgeschlossenerMa): string {
  if (item.grund === 'rang' && item.kompetenzScore != null) {
    return `niedrigere Passung (${Math.round(item.kompetenzScore * 100)}%)`;
  }
  return GRUND_TEXT[item.grund];
}

export function NichtVorgeschlagenListe({ ausgeschlossen, resolveName }: Props): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (ausgeschlossen.length === 0) return null;

  const sortiert = [...ausgeschlossen].sort((a, b) => {
    const go = GRUND_ORDER[a.grund] - GRUND_ORDER[b.grund];
    if (go !== 0) return go;
    return (b.kompetenzScore ?? 0) - (a.kompetenzScore ?? 0);
  });

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
      >
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        Nicht vorgeschlagen ({ausgeschlossen.length})
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-col gap-1 rounded-[8px] p-2" style={{ background: 'var(--tf-bg-secondary)' }}>
          {sortiert.map(item => (
            <li key={`${item.anonId}-${item.grund}`} className="flex items-center justify-between gap-2">
              <AnonymIdBadge anonId={item.anonId} size="sm" realName={resolveName(item.anonId)} />
              <span className="text-[11px] text-[var(--tf-text-tertiary)] text-right">
                {grundLabel(item)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
