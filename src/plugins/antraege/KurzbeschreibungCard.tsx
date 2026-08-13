/**
 * Kurzbeschreibungs-Karte der Verbund-Detailseite: die Kurzzusammenfassung
 * (VB_INHALT) des Lead-TV als eigene Karte direkt unter dem Kopf — statt inline
 * in die Kopf-Beschreibung gemischt.
 *
 * ZWEI Ebenen, bewusst getrennt:
 *  - die SEKTION ist klappbar (Chevron an der Überschrift, persistiert kartenintern
 *    via `useCollapsedSection`; Vorgabe in `detailSektionen`: offen nur, wenn es
 *    Text gibt) — wer den Antrag schon kennt, bekommt die Karte aus dem Weg;
 *  - der TEXT ist innerhalb der offenen Karte auf 4 Zeilen geklammt mit
 *    „Volltext lesen" / „weniger"; dieser Zustand kommt vom Aufrufer (geteilt mit
 *    dem Detail-State).
 *
 * Fehlt die Kurzbeschreibung (`text` leer/`null` — VB_INHALT wird oft erst nach
 * Abschluss des Gutachtens erstellt), schrumpft die Karte auf EINE Zeile mit
 * dezentem „noch nicht erstellt"-Hinweis: ohne Karte, ohne Schalter. Ein Schalter,
 * der eine leere Karte auf- und zuklappt, wäre ein Bedienelement ohne Aussage.
 */
import { ChevronRight } from 'lucide-react';
import { sektionOffenDefault, sektionsKey } from './detailSektionen';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';

interface Props {
  /** Kurzbeschreibung (VB_INHALT); leer/`null` → dezenter „noch nicht erstellt"-Hinweis. */
  text: string | null;
  open: boolean;
  onToggle: () => void;
}

/** Ab dieser Länge wird der Text geklammt (4 Zeilen + „Volltext lesen"). */
const CLAMP_THRESHOLD = 240;

export function KurzbeschreibungCard({ text, open, onToggle }: Props): React.ReactElement {
  const vorhanden = !!text && text.trim().length > 0;
  // Klappzustand des GEFÜLLTEN Falls — der Schlüssel gilt antragsübergreifend,
  // also darf der leere Fall ihn nicht mitschreiben: sonst entschiede der erste
  // besuchte Antrag über alle folgenden. Deshalb hängt „offen" hier zusätzlich an
  // `vorhanden`, statt den Default zu variieren.
  const [gemerktOffen, toggleSektion] = useCollapsedSection(
    sektionsKey('kurzbeschreibung'),
    { defaultOpen: sektionOffenDefault('kurzbeschreibung', true) },
  );
  const sektionOffen = vorhanden && gemerktOffen;
  const clampable = vorhanden && (text?.length ?? 0) > CLAMP_THRESHOLD;

  // Ohne Text kein Schalter: aufklappen brächte eine Karte, in der nur steht,
  // dass nichts da ist. Die Aussage passt in die Überschriftenzeile.
  if (!vorhanden) {
    return (
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
          Kurzbeschreibung
        </span>
        <span className="text-[12px] text-[var(--tf-text-tertiary)] italic">
          — wird nach Abschluss des Gutachtens erstellt
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={toggleSektion}
        aria-expanded={sektionOffen}
        className="mb-1.5 flex items-center gap-1 cursor-pointer"
      >
        <ChevronRight
          size={13}
          className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: sektionOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
          Kurzbeschreibung
        </span>
      </button>
      {sektionOffen ? (
        <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-4 py-2.5">
          <p
            className={`m-0 text-[13px] leading-[1.6] text-[var(--tf-text-secondary)] whitespace-pre-wrap${
              clampable && !open ? ' line-clamp-4' : ''
            }`}
          >
            {text}
          </p>
          {clampable ? (
            <button
              type="button"
              onClick={onToggle}
              className="mt-1.5 text-[12px] text-[var(--tf-primary)] hover:opacity-80"
            >
              {open ? '↑ weniger' : '↓ Volltext lesen'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
