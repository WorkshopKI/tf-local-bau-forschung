/**
 * Baustein-Bestätigung je gewähltem Punkt: begründete Vorschläge aus dem Katalog,
 * die der Mensch an-/abwählt. Kein Treffer ⇒ sichtbare TODO-Markierung (der Skill
 * setzt dann `[TODO Baustein zuordnen]`). Das LLM wählt hier nichts — es bekommt die
 * bestätigten Bausteine und füllt nur Platzhalter.
 */
import { useMemo } from 'react';
import type { TextbausteinRecord } from '@/core/services/skills';
import { vorschlaegeFuerPunkt } from './bausteinAuswahl';
import type { BescheidTyp } from '../nachforderungen/artefakt-typ';
import type { WerkbankPunkt } from './types';

export function BausteinBestaetigung({ punkt, katalog, artefaktTyp, gewaehlteIds, onToggle }: {
  punkt: WerkbankPunkt;
  katalog: readonly TextbausteinRecord[];
  artefaktTyp: BescheidTyp;
  gewaehlteIds: readonly string[];
  onToggle: (bausteinId: string) => void;
}): React.ReactElement {
  const vorschlaege = useMemo(() => vorschlaegeFuerPunkt(katalog, punkt, artefaktTyp), [katalog, punkt, artefaktTyp]);
  const istTodo = gewaehlteIds.length === 0;

  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-3.5 py-3">
      <div className="flex items-start gap-2 mb-2">
        {punkt.aspektId && <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0 mt-0.5">{punkt.aspektId}</span>}
        <span className="text-[12.5px] text-[var(--tf-text)] flex-1">{punkt.text}</span>
        {istTodo && (
          <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] shrink-0" title="Ohne Baustein setzt der Entwurf eine [TODO Baustein zuordnen]-Markierung.">
            TODO
          </span>
        )}
      </div>
      {vorschlaege.length === 0 ? (
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Kein passender Baustein gefunden — der Entwurf trägt eine TODO-Markierung, die von Hand ergänzt wird.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {vorschlaege.map(v => {
            const aktiv = gewaehlteIds.includes(v.baustein.id);
            return (
              <button
                key={v.baustein.id}
                type="button"
                onClick={() => onToggle(v.baustein.id)}
                className={`text-left rounded-[8px] px-3 py-2 border transition-colors ${
                  aktiv ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-light)]' : 'border-[var(--tf-border)] hover:border-[var(--tf-border-hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-[4px] border shrink-0 flex items-center justify-center text-[10px] ${aktiv ? 'bg-[var(--tf-primary)] border-[var(--tf-primary)] text-white' : 'border-[var(--tf-border-hover)]'}`}>
                    {aktiv ? '✓' : ''}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{v.baustein.id}</span>
                  <span className="text-[12px] text-[var(--tf-text)] truncate">{v.baustein.thema}</span>
                </div>
                <div className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5 ml-[22px]">
                  Angeschlagen: {v.treffer.join(', ') || '—'}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
