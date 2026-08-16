/**
 * Reiter „Fragen" — die zweite Art zu suchen.
 *
 * Steht in einer EIGENEN Liste neben den Sucharten, nicht darin: die Muster
 * dort zeigen eine Syntax, diese hier zeigen, dass man keine braucht. In eine
 * Liste gemischt wäre beides eine Aufzählung von Beispielen, und der
 * Unterschied — der einzige Grund für den Umschalter — verschwände.
 *
 * Bewusst drei Formen: ein reines Thema mit vielen Schreibweisen, ein Thema mit
 * Bereichsbezug, ein Thema mit Ortsbezug (der Fall, der eine Einschränkung
 * erzeugt).
 */
import { Sparkles } from 'lucide-react';
import { FussSatz, GruppenTitel, MehrZeile } from './StartBausteine';

export const FRAGEN: readonly { frage: string; erklaerung: string }[] = [
  {
    frage: 'Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?',
    erklaerung: 'findet auch „Normen", „Normierung", „Standardisierung"',
  },
  {
    frage: 'Zeig mir Projekte zu künstlicher Intelligenz in der Medizintechnik',
    erklaerung: 'zwei Themen — wer beide trägt, steht oben',
  },
  {
    frage: 'Was läuft in Bayern zum Thema Leichtbau?',
    erklaerung: 'der Ort schränkt ein, das Thema sucht',
  },
];

export function StartFragen({ onFrage, max, onMehr }: {
  /** Setzt Text UND Modus — eine Frage, die als Stichwortsuche liefe, fände
   *  nichts und lehrte damit das Gegenteil. */
  onFrage: (frage: string) => void;
  max?: number;
  onMehr?: () => void;
}): React.ReactElement {
  const sicht = max === undefined ? FRAGEN : FRAGEN.slice(0, max);
  return (
    <div className="flex flex-col">
      {/* Im Reiter „Alle" stehen mehrere Rubriken untereinander — ohne
          Überschrift läse sich diese als Fortsetzung der vorigen. Im eigenen
          Reiter sagt die Reiterbeschriftung dasselbe schon. */}
      {max !== undefined && <GruppenTitel>Oder stell eine Frage</GruppenTitel>}
      <div className="flex flex-col">
        {sicht.map(f => (
          <button
            key={f.frage}
            type="button"
            onClick={() => onFrage(f.frage)}
            title={`„${f.frage}" stellen`}
            className="flex min-w-0 items-center gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
          >
            <Sparkles size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
            <span className="min-w-0 truncate text-[12px] text-[var(--tf-text)]">{f.frage}</span>
            <span className="shrink-0 text-[12px] text-[var(--tf-text-secondary)]">{f.erklaerung}</span>
          </button>
        ))}
      </div>
      {max !== undefined && onMehr && FRAGEN.length > sicht.length && (
        <MehrZeile text={`alle ${FRAGEN.length} ansehen`} onClick={onMehr} />
      )}
      {max === undefined && (
        <FussSatz>
          Die interne KI übersetzt die Frage in Suchbegriffe und benennt dabei
          Schreibweisen, die im Bestand stehen, aber nicht in der Frage. Was
          daraus wurde, steht danach über dem Ergebnis und lässt sich einzeln
          abwählen — das dauert einen Moment länger als eine Stichwortsuche.
        </FussSatz>
      )}
    </div>
  );
}
