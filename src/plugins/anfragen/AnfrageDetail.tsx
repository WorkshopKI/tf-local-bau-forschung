/**
 * Detail einer Anfrage — „Layout A": Vorher/Nachher-Zwei-Spalten mit dem Stepper
 * als View-Umschalter (Steps 1–3 → Anonymisierung, 4–5 → Antwort einsetzen).
 * Orchestriert nur Rahmen + geteilten UI-State (View, Hervorheben); die Domänen-
 * Logik lebt in den beiden Views. Referenz: _design/handoff/Anfragen.
 */
import './anonymisierung-detail.css';
import { useState } from 'react';
import { X } from 'lucide-react';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { Button } from '@/components/ui/button';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { AnfrageStepper, viewForStatus, type DetailView } from './AnfrageStepper';
import { AnonymisierungView } from './AnonymisierungView';
import { AntwortView } from './AntwortView';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
  onClose: () => void;
}

const HL_KEY = 'anfragen-detail-highlight';
function loadHighlight(): boolean {
  try { return localStorage.getItem(HL_KEY) !== '0'; } catch { return true; }
}

export function AnfrageDetail({ anfrage, onClose }: Props): React.ReactElement {
  const [view, setView] = useState<DetailView>(() => viewForStatus(anfrage.status));
  const [highlight, setHighlight] = useState(loadHighlight);

  const toggleHighlight = (): void => setHighlight(v => {
    const next = !v;
    try { localStorage.setItem(HL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const n = anfrage.hatAnhaenge;

  return (
    <div className="awd flex flex-col h-full overflow-hidden">
      <div className="awd-topbar">
        <div className="awd-ttl">{anfrage.betreff || '(ohne Betreff)'}</div>
        <AnfrageDeleteControl anfrage={anfrage} onDeleted={onClose} />
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="Schließen" aria-label="Schließen">
          <X />
        </Button>
      </div>

      <div className="awd-meta">
        <span>{anfrage.absenderEmail || '—'}</span>
        {n > 0 && (
          <>
            <span className="awd-dot">·</span>
            <span>{n} {n === 1 ? 'Anhang' : 'Anhänge'} — {n === 1 ? 'wird' : 'werden'} nicht verarbeitet</span>
          </>
        )}
        {isDevFixturesEnabled() && (
          <>
            <span className="awd-dot">·</span>
            <span>Recall-Eval (dev · fiktive Fixtures)</span>
          </>
        )}
      </div>

      <AnfrageStepper status={anfrage.status} onPick={setView} />

      {view === 'anon' ? (
        <AnonymisierungView anfrage={anfrage} highlight={highlight} onToggleHighlight={toggleHighlight} />
      ) : (
        <AntwortView anfrage={anfrage} highlight={highlight} onToggleHighlight={toggleHighlight} />
      )}
    </div>
  );
}
