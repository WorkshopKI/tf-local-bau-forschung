/**
 * Die EINZIGE Aktionszeile der Abschnitts-Karte: links die Werkzeuge am Text
 * (Neu · Kürzer · Länger · Persönlicher Stil | Bearbeiten · Kopieren · QS prüfen),
 * rechts der primäre CTA „Freigeben und weiter" mit QS-Badge.
 *
 * Ersetzt die früheren drei getrennten Orte (Anpassen-Zeile über dem Text,
 * Prüf-Block-Fußzeile, Entscheidungs-Zeile unten). Seltener Gebrauchtes liegt im
 * ⋯-Menü der Kopfzeile, das Feedback in der Fußzeile.
 *
 * Kopieren und „Persönlicher Stil" saßen bis v2.366 in jenem ⋯-Menü — beides ist
 * aber Alltag (Text in Mail/Word ziehen, eigenen Stil setzen), nicht Ausnahme.
 * Der Kopier-Zustand kommt aus `useKopierAktion`; geteilt wird der Zustand, nicht
 * das Aussehen — das Markup bleibt hier `g-btn`, damit die Zeile eine Optik hat.
 */
import { AlertTriangle, ArrowRight, Check, Copy, Pencil, ShieldCheck, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import type { SkillModifierKey } from '@/core/services/skills';
import type { QsBadgeInfo } from './abschnittAnzeige';

interface Props {
  /** Freigegebener Abschnitt → nur „Erneut öffnen" + QS. */
  freigegeben: boolean;
  /** Generieren/Ändern gesperrt (busy oder KI offline). */
  genDisabled: boolean;
  /** Der Abschnittstext — Kopier-Quelle; leer → Bearbeiten/QS/Kopieren sinnlos. */
  text: string;
  qs: QsBadgeInfo;
  /** Persönlicher Stil wirkt auf diesen Abschnitt → Knopf mit Kontur statt ghost. */
  stilAktiv?: boolean;
  onModify: (modifier: SkillModifierKey) => void;
  onBearbeiten: () => void;
  onOpenStil: () => void;
  onQs?: () => void;
  onFreigeben: () => void;
  onErneutOeffnen: () => void;
}

export function WerkzeugZeile({
  freigegeben, genDisabled, text, qs, stilAktiv,
  onModify, onBearbeiten, onOpenStil, onQs, onFreigeben, onErneutOeffnen,
}: Props): React.ReactElement {
  const textVorhanden = !!text.trim();
  const kopieren = useKopierAktion(text, 'Text in Zwischenablage kopieren');

  // Fehler schlägt Erfolg (v2.301.3): wer den Fehlschlag nicht sieht, fügt den
  // ALTEN Inhalt der Zwischenablage ein. Der Grund steht im `title`.
  const kopierKnopf = (
    <button
      type="button"
      className="g-btn ghost sm icon"
      disabled={!textVorhanden}
      title={kopieren.titel}
      aria-label="Text kopieren"
      onClick={() => { void kopieren.run(); }}
    >
      {kopieren.fehler
        ? <AlertTriangle size={14} className="text-[var(--tf-danger-text)]" />
        : kopieren.kopiert ? <Check size={14} className="text-[var(--tf-primary)]" /> : <Copy size={14} />}
    </button>
  );

  const stilKnopf = (
    <button
      type="button"
      className={`g-btn sm${stilAktiv ? '' : ' ghost'}`}
      title={stilAktiv
        ? 'Persönlicher Stil wirkt auf diesen Abschnitt'
        : 'Eigene Vorgaben für Ton und Form dieses Abschnitts'}
      onClick={onOpenStil}
    >
      <SlidersHorizontal size={13} /> Persönlicher Stil
    </button>
  );

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
        {kopierKnopf}
        {stilKnopf}
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
      {stilKnopf}
      <span className="g-werkzeuge-sep" aria-hidden="true" />
      <button type="button" className="g-btn ghost sm" onClick={onBearbeiten}>
        <Pencil size={13} /> Bearbeiten
      </button>
      {kopierKnopf}
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
