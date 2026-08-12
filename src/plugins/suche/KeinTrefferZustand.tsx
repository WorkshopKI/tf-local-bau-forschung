/**
 * Der Zustand, in dem die Suche nichts gefunden hat.
 *
 * Bisher stand hier eine Zeile: „Keine Ergebnisse für …". Jetzt stehen die
 * Auswege da, die tatsächlich Treffer bringen — jeder mit seiner echten Zahl,
 * gerechnet in [auswege.ts](src/plugins/suche/auswege.ts), bevor er angezeigt
 * wird.
 *
 * Bringt keine Anpassung etwas, sagt der Zustand das offen. Ein leerer
 * Vorschlagsblock wäre schlimmer als ein klarer Satz.
 */
import { ArrowRight } from 'lucide-react';
import { SuchMarkierung } from './SuchMarkierung';
import type { Ausweg } from './auswege';

export function KeinTrefferZustand({
  query,
  woerter,
  auswege,
  hatFilter,
  onAnwenden,
}: {
  query: string;
  woerter: readonly string[];
  auswege: readonly Ausweg[];
  hatFilter: boolean;
  onAnwenden: (a: Ausweg) => void;
}): React.ReactElement {
  return (
    <div className="px-1 py-10">
      <h2 className="max-w-2xl text-[16px] font-medium leading-snug text-[var(--tf-text)]">
        Keine Treffer für <SuchMarkierung text={query} wortlaut={woerter} />
        {hatFilter ? ' mit den gesetzten Filtern' : ''}
      </h2>

      {auswege.length > 0
        ? (
          <>
            <p className="mt-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
              Diese Anpassungen führen zu Treffern:
            </p>
            <ul className="mt-4 flex flex-col gap-1">
              {auswege.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onAnwenden(a)}
                    className="group flex w-full max-w-2xl items-center gap-3 rounded-[8px] px-2 py-2 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
                  >
                    <ArrowRight
                      size={13}
                      className="shrink-0 text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-primary)]"
                      aria-hidden
                    />
                    <span className="flex-1 text-[13px] text-[var(--tf-text)]">{a.text}</span>
                    {/* „Treffer" ist im Deutschen numerus-invariant. */}
                    <span className="shrink-0 text-[12px] text-[var(--tf-text-secondary)]">
                      {a.treffer.toLocaleString('de-DE')} Treffer
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
        : (
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">
            Auch mit gelockerten Einstellungen bringt diese Anfrage nichts. Die
            Wörter kommen im Bestand so nicht vor — ein anderer Begriff führt
            eher weiter als eine andere Einstellung.
          </p>
        )}
    </div>
  );
}
