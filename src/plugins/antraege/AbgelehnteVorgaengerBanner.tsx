import { useState } from 'react';
import { History, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { formatGermanDate } from '@/core/services/csv';
import type { AbgelehnterVorgaenger } from './vorgaengerAntraege';

interface Props {
  vorgaenger: AbgelehnterVorgaenger[];
  /** Navigiert in den abgelehnten Verbund (über eines seiner Aktenzeichen). */
  onOpenAntrag: (aktenzeichen: string) => void;
}

/**
 * Warn-Hinweis im Verbund-Detail: unter demselben Kurznamen (VB_KURZNAM) wurde
 * bereits mindestens eine Einreichung abgelehnt/zurückgezogen.
 *
 * Kompakt-Layout (v2.110): standardmäßig **eingeklappt** als 1-zeilige Leiste
 * (spart vertikale Höhe); Klick öffnet die volle Ansicht mit den anklickbaren
 * Vorgänger-Zeilen (öffnen den abgelehnten Verbund). Visuell an warning-Tokens
 * angelehnt.
 */
export function AbgelehnteVorgaengerBanner({ vorgaenger, onOpenAntrag }: Props): React.ReactElement {
  const n = vorgaenger.length;
  const [open, setOpen] = useState(false);

  if (!open) {
    const first = vorgaenger[0];
    const summary = n === 1 && first
      ? [
          first.fkzExample,
          first.erstentscheidung ? `Erstentscheidung ${formatGermanDate(first.erstentscheidung)}` : null,
          first.antragsteller,
        ].filter(Boolean).join(' · ')
      : `${n} Einreichungen`;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="mb-4 w-full flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-left cursor-pointer"
        style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
        title="Details zu früheren Einreichungen anzeigen"
      >
        <AlertTriangle size={13} className="shrink-0" aria-hidden="true" />
        <span className="text-[12px] font-medium shrink-0">Früher abgelehnt</span>
        <span className="opacity-50 shrink-0">·</span>
        <span className="text-[11.5px] font-mono truncate opacity-90">{summary}</span>
        <ChevronRight size={13} className="shrink-0 ml-auto opacity-70" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="mb-4 rounded-[var(--tf-radius)] p-3"
      style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
    >
      <div className="flex items-start gap-2">
        <History size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded
            className="flex items-start gap-1.5 text-left w-full cursor-pointer"
            title="Einklappen"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] font-medium leading-snug">
                Früher abgelehnt / zurückgezogen
              </span>
              <span className="block text-[11.5px] leading-snug opacity-90">
                Unter demselben Kurznamen wurde bereits{' '}
                {n === 1 ? 'eine Einreichung' : `${n} Einreichungen`} abgelehnt oder zurückgezogen.
              </span>
            </span>
            <ChevronDown size={13} className="shrink-0 mt-0.5 opacity-70" aria-hidden="true" />
          </button>
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
