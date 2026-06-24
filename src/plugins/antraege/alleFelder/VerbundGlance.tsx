import './felder.css';
import type { Antrag } from '@/core/services/csv/types';
import { buildGlanceFacts } from './glanceFacts';

interface Props {
  tvs: Antrag[];
  verbundId: string;
  /** Aufgelöstes Unterprogramm-Label (Component-Caller liefert es via Hook). */
  unterprogramm: string | null;
}

/**
 * „Auf einen Blick" (Hebel 1) — kuratiertes 8-Fakten-Raster oberhalb der
 * Felder-Liste. Ersetzt den bisherigen Stammdaten-Block der VerbundDetail.
 */
export function VerbundGlance({ tvs, verbundId, unterprogramm }: Props): React.ReactElement {
  const facts = buildGlanceFacts({ tvs, verbundId, unterprogramm });
  return (
    <div className="af-glance">
      <div className="af-glance-grid">
        {facts.map(f => (
          <div key={f.label}>
            <div className="af-fact-l">{f.label}</div>
            <div className={'af-fact-v' + (f.mono ? ' mono' : '')}>{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
