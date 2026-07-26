/**
 * Beratende LLM-QS-Befunde (rein typografisch, Muster der `CheckList`). BEWUSST
 * getrennt von den deterministischen Checks: andere Quelle (qualitativ, beratend),
 * eigene Glyphen inkl. `'unklar'` (nicht-parsebare Modell-Ausgabe).
 */
import type { QsBefund } from './types';

function glyph(bewertung: QsBefund['bewertung']): { char: string; cls: string } {
  if (bewertung === 'ok') return { char: '✓', cls: 'text-[var(--tf-success-text)]' };
  if (bewertung === 'hinweis') return { char: '!', cls: 'text-[var(--tf-warning-text)]' };
  return { char: '?', cls: 'text-[var(--tf-text-tertiary)]' }; // unklar
}

interface Props {
  befunde: QsBefund[];
  /**
   * Satzzahl des LIVE-Textes. Nur gesetzt, wenn die Liste an einem adressierbaren
   * Text hängt (QS-Strip in der Karte) — begrenzt Referenzen, die eine spätere
   * Bearbeitung ungültig gemacht hat.
   */
  satzAnzahl?: number;
  /** Springt zum Satz und markiert ihn (bestehender Fundstellen-Mechanismus). */
  onZeigeSatz?: (satzIndex: number) => void;
}

export function QsHinweisList({ befunde, satzAnzahl, onZeigeSatz }: Props): React.ReactElement | null {
  if (befunde.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {befunde.map((b, i) => {
        const g = glyph(b.bewertung);
        // Nur anbieten, was im aktuellen Text noch existiert — sonst zeigte der
        // Klick auf einen Satz, den es nicht mehr gibt.
        const saetze = satzAnzahl != null && onZeigeSatz
          ? (b.satzIndizes ?? []).filter(s => s >= 0 && s < satzAnzahl)
          : [];
        return (
          <div key={`${b.dimension}-${i}`}>
            <div className="flex items-baseline gap-2.5 text-[13px] text-[var(--tf-text)]">
              <span className={`w-3.5 shrink-0 text-center ${g.cls}`}>{g.char}</span>
              <span className="font-medium">{b.dimension}</span>
            </div>
            {b.text && (
              <div className="ml-[23px] mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{b.text}</div>
            )}
            {saetze.length > 0 && (
              <div className="ml-[23px] mt-1 flex flex-wrap gap-1.5">
                {saetze.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="g-qs-satzlink"
                    onClick={() => onZeigeSatz!(s)}
                    title={`Satz ${s + 1} im Entwurf markieren`}
                  >
                    Satz {s + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
