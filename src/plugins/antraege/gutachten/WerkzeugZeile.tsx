/**
 * Die EINZIGE Aktionszeile der Abschnitts-Karte: links die Werkzeuge am Text
 * (Neu · Kürzer · Länger | Bearbeiten · QS prüfen), rechts der primäre CTA
 * „Freigeben und weiter" mit QS-Badge.
 *
 * Ersetzt die früheren drei getrennten Orte (Anpassen-Zeile über dem Text,
 * Prüf-Block-Fußzeile, Entscheidungs-Zeile unten). Seltener Gebrauchtes liegt im
 * ⋯-Menü der Kopfzeile, das Feedback in der Fußzeile.
 */
import { ArrowRight, Pencil, ShieldCheck, Undo2 } from 'lucide-react';
import type { SkillModifierKey } from '@/core/services/skills';
import type { QsBadgeInfo } from './abschnittAnzeige';

interface Props {
  /** Freigegebener Abschnitt → nur „Erneut öffnen" + QS. */
  freigegeben: boolean;
  /** Generieren/Ändern gesperrt (busy oder KI offline). */
  genDisabled: boolean;
  /** Leerer Text → Bearbeiten/QS sinnlos. */
  textVorhanden: boolean;
  qs: QsBadgeInfo;
  onModify: (modifier: SkillModifierKey) => void;
  onBearbeiten: () => void;
  onQs?: () => void;
  onFreigeben: () => void;
  onErneutOeffnen: () => void;
}

export function WerkzeugZeile({
  freigegeben, genDisabled, textVorhanden, qs,
  onModify, onBearbeiten, onQs, onFreigeben, onErneutOeffnen,
}: Props): React.ReactElement {
  if (freigegeben) {
    return (
      <div className="g-werkzeuge">
        <button type="button" className="g-btn sm" onClick={onErneutOeffnen}>
          <Undo2 size={14} /> Erneut öffnen
        </button>
        {onQs && (
          <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={onQs}>
            <ShieldCheck size={13} /> QS prüfen
          </button>
        )}
        <span className="g-ab-spacer" />
        <span className={`g-qs-badge ${qs.ton}`}>{qs.text}</span>
      </div>
    );
  }

  return (
    <div className="g-werkzeuge">
      <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('neu')}>Neu</button>
      <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('kuerzer')}>Kürzer</button>
      <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('laenger')}>Länger</button>
      <span className="g-werkzeuge-sep" aria-hidden="true" />
      <button type="button" className="g-btn ghost sm" onClick={onBearbeiten}>
        <Pencil size={13} /> Bearbeiten
      </button>
      {onQs && (
        <button
          type="button"
          className="g-btn ghost sm"
          disabled={genDisabled || !textVorhanden}
          onClick={onQs}
        >
          <ShieldCheck size={13} /> QS prüfen
        </button>
      )}
      <span className="g-ab-spacer" />
      <button type="button" className="g-btn primary" onClick={onFreigeben}>
        Freigeben und weiter
        <span className={`g-qs-badge auf-cta ${qs.ton}`}>{qs.text}</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
