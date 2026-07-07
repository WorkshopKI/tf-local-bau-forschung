/**
 * Kurzbeschreibungs-Karte der Verbund-Detailseite: die Kurzzusammenfassung
 * (VB_INHALT) des Lead-TV als eigene Karte direkt unter dem Kopf — statt inline
 * in die Kopf-Beschreibung gemischt. Lange Texte sind auf 4 Zeilen geklammt mit
 * „Volltext lesen" / „weniger". Auf-/Zu-Zustand kommt vom Aufrufer (geteilt mit
 * dem Detail-State).
 */
interface Props {
  text: string;
  open: boolean;
  onToggle: () => void;
}

/** Ab dieser Länge wird der Text geklammt (4 Zeilen + „Volltext lesen"). */
const CLAMP_THRESHOLD = 240;

export function KurzbeschreibungCard({ text, open, onToggle }: Props): React.ReactElement {
  const clampable = text.length > CLAMP_THRESHOLD;
  return (
    <div className="mb-5">
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
        Kurzbeschreibung
      </div>
      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-4 py-3">
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
    </div>
  );
}
