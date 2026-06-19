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

export function QsHinweisList({ befunde }: { befunde: QsBefund[] }): React.ReactElement | null {
  if (befunde.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {befunde.map((b, i) => {
        const g = glyph(b.bewertung);
        return (
          <div key={`${b.dimension}-${i}`}>
            <div className="flex items-baseline gap-2.5 text-[13px] text-[var(--tf-text)]">
              <span className={`w-3.5 shrink-0 text-center ${g.cls}`}>{g.char}</span>
              <span className="font-medium">{b.dimension}</span>
            </div>
            {b.text && (
              <div className="ml-[23px] mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{b.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
