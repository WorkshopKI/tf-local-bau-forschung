import { History, ChevronRight } from 'lucide-react';
import { formatGermanDate } from '@/core/services/csv';
import type { AbgelehnterVorgaenger } from './vorgaengerAntraege';

interface Props {
  vorgaenger: AbgelehnterVorgaenger[];
  /** Navigiert in den abgelehnten Verbund (über eines seiner Aktenzeichen). */
  onOpenAntrag: (aktenzeichen: string) => void;
}

/**
 * Warn-Hinweis im Verbund-Detail: unter demselben Kurznamen (VB_KURZNAM) wurde
 * bereits mindestens eine Einreichung abgelehnt/zurückgezogen. Jede Zeile ist
 * anklickbar und öffnet den abgelehnten Vorgänger-Verbund.
 *
 * Visuell an `Alert variant="warning"` (warning-Tokens) + das
 * `PresetSuggestionBanner`-Muster angelehnt.
 */
export function AbgelehnteVorgaengerBanner({ vorgaenger, onOpenAntrag }: Props): React.ReactElement {
  const n = vorgaenger.length;
  return (
    <div
      className="mb-6 rounded-[var(--tf-radius)] p-3"
      style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
    >
      <div className="flex items-start gap-2">
        <History size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium leading-snug">
            Früher abgelehnt / zurückgezogen
          </div>
          <div className="text-[11.5px] leading-snug opacity-90">
            Unter demselben Kurznamen wurde bereits{' '}
            {n === 1 ? 'eine Einreichung' : `${n} Einreichungen`} abgelehnt oder zurückgezogen.
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {vorgaenger.map(v => {
              const parts = [
                `${v.tvCount} ${v.tvCount === 1 ? 'Teilvorhaben' : 'Teilvorhaben'}`,
                v.erstentscheidung ? `Erstentscheidung ${formatGermanDate(v.erstentscheidung)}` : null,
                v.antragsteller,
              ].filter(Boolean) as string[];
              return (
                <button
                  key={v.verbundId}
                  type="button"
                  onClick={() => onOpenAntrag(v.aktenzeichen[0] ?? v.fkzExample)}
                  className="group flex items-center gap-2 text-left rounded px-2 py-1.5 transition-colors hover:bg-[var(--tf-warning-text)]/10 cursor-pointer"
                  title={`Abgelehnten Vorgänger ${v.akronymRaw} öffnen`}
                >
                  <span className="flex-1 min-w-0 text-[11.5px] leading-snug">
                    <span className="font-medium">{v.akronymRaw}</span>
                    {parts.length > 0 ? (
                      <span className="opacity-90"> · {parts.join(' · ')}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={13} className="shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
