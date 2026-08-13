/**
 * Die Zeile „Gesucht wird" unter den Suchoptionen.
 *
 * Zerlegung und Wirkung stehen in der reinen
 * [deutung.ts](src/plugins/suche/deutung.ts); hier wird gerendert und geklickt.
 *
 * Farbcode wie in der Trefferliste: gelb = so getippt, türkis = über den
 * Wortstamm dazugekommen. Zwei Orte, eine Bedeutung — sonst müsste man die
 * Legende zweimal lernen.
 */
import { X } from 'lucide-react';
import { VERKNUEPFUNG_OPERATOR, type SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { baueWortChips } from './deutung';

/**
 * Wie viele Varianten-Chips die Zeile zeigt.
 *
 * Gesucht wird mit ALLEN eingesammelten Varianten (siehe `VARIANTEN_MAX` in der
 * Suchstufe) — angezeigt nur die ersten paar, weil eine Zeile mit vierzig Chips
 * niemand liest. Die nicht gezeigten bleiben aktiv; sie verschwinden aus der
 * Sicht, nicht aus der Suche.
 */
const VARIANTEN_SICHTBAR = 8;

export function DeutungsZeile({
  query,
  verknuepfung,
  abgewaehlteWoerter,
  onToggleWort,
  varianten,
  abgewaehlteVarianten,
  onToggleVariante,
  stammSuche,
  onStammSucheAn,
}: {
  query: string;
  verknuepfung: SuchVerknuepfung;
  abgewaehlteWoerter: readonly string[];
  onToggleWort: (wort: string) => void;
  varianten: readonly string[];
  abgewaehlteVarianten: readonly string[];
  onToggleVariante: (v: string) => void;
  stammSuche: boolean;
  onStammSucheAn: () => void;
}): React.ReactElement | null {
  const chips = baueWortChips(query, verknuepfung, abgewaehlteWoerter);
  if (chips.length === 0) return null;
  const operator = VERKNUEPFUNG_OPERATOR[verknuepfung];
  const ausVarianten = new Set(abgewaehlteVarianten.map(v => v.toLowerCase()));

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[10px] px-3 py-2"
      style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Gesucht wird</span>

      {chips.map((chip, i) => (
        <span key={chip.wort} className="inline-flex items-center gap-x-2">
          {i > 0 && (
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
              {operator}
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleWort(chip.wort)}
            title={chip.aktiv ? `„${chip.wort}" nicht mitsuchen` : `„${chip.wort}" wieder mitsuchen`}
            aria-pressed={chip.aktiv}
            className={`inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] cursor-pointer transition-opacity ${chip.aktiv ? '' : 'opacity-45 line-through'}`}
            style={{ background: chip.aktiv ? 'var(--tf-highlight)' : 'transparent',
              border: chip.aktiv ? '0.5px solid transparent' : '0.5px solid var(--tf-border)' }}
          >
            <span className="text-[var(--tf-text)]">{chip.wort}</span>
            <X size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
          </button>
        </span>
      ))}

      {/* Die Stamm-Varianten. Sie stehen nur da, wenn der Bestand sie
          tatsächlich hergegeben hat — eine leere Liste bleibt leer statt eine
          Überschrift ohne Inhalt zu zeigen. */}
      {stammSuche && varianten.length > 0 && (
        <>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">auch als</span>
          {varianten.slice(0, VARIANTEN_SICHTBAR).map(v => {
            const aktiv = !ausVarianten.has(v.toLowerCase());
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggleVariante(v)}
                title={aktiv ? `„${v}" nicht mitsuchen` : `„${v}" wieder mitsuchen`}
                aria-pressed={aktiv}
                className={`inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] cursor-pointer transition-opacity ${aktiv ? '' : 'opacity-45 line-through'}`}
                style={{ background: aktiv ? 'var(--tf-highlight-aehnlich)' : 'transparent',
                  border: aktiv ? '0.5px solid transparent' : '0.5px solid var(--tf-border)' }}
              >
                <span className="text-[var(--tf-text)]">{v}</span>
                <X size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
              </button>
            );
          })}
        </>
      )}

      {/* Einladung statt Leerstelle: wer die Stammsuche nicht kennt, sieht hier,
          dass es sie gibt — an der Stelle, wo ihre Wirkung erscheinen würde. */}
      {!stammSuche && (
        <button
          type="button"
          onClick={onStammSucheAn}
          title="Wortstamm-Varianten mitsuchen — „Normen“ findet dann auch „Normung“"
          className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          style={{ border: '0.5px dashed var(--tf-border)' }}
        >
          + Wortformen
        </button>
      )}
    </div>
  );
}
