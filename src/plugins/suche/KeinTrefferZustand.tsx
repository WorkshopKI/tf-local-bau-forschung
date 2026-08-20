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
 *
 * **Ein Ausweg steht über der Liste, nicht in ihr** (v4.127.1): die
 * Richtlinien-Auswahl. Sie ist der einzige Grund für null Treffer, bei dem die
 * gesuchten Anträge nachweislich EXISTIEREN — gefunden, dann von einer
 * Einstellung weggeblendet, die die Anfrage überlebt und deshalb vergessen
 * wird. Am Bestand gemessen: `nafatech` findet 29 Anträge, alle in den
 * Richtlinien-Generationen 2012 und 2015; wer auf „Richtlinie 2025" steht,
 * bekommt die Seite „Keine Treffer" zu sehen, obwohl das Netzwerk da ist. Als
 * eine Zeile unter dreien wurde dieser Ausweg überlesen — als Kasten mit
 * Knopf nicht mehr.
 *
 * Alle anderen Auswege bleiben in der Liste: sie ändern die ANFRAGE oder die
 * Regler dieser einen Suche, und was sie ändern, steht direkt darüber sichtbar
 * auf der Seite. Nur die Richtlinien-Auswahl wirkt still weiter.
 *
 * Die Zahl im Kasten ist dieselbe wie zuvor an der Zeile: der Probelauf ohne
 * Richtlinien-Einschränkung, mit allen übrigen Reglern (siehe `probelauf` in
 * [useKorpusZahlen.ts](src/plugins/suche/useKorpusZahlen.ts)).
 */
import { ArrowRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SuchMarkierung } from './SuchMarkierung';
import { teileAuswege, type Ausweg } from './auswege';

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
  // Welcher Ausweg herausgehoben wird, entscheidet `teileAuswege` — die Regel
  // steht bei den Auswegen, wo sie ohne React prüfbar ist.
  const { versteckt, rest } = teileAuswege(auswege);

  return (
    <div className="px-1 py-10">
      <h2 className="max-w-2xl text-[16px] font-medium leading-snug text-[var(--tf-text)]">
        Keine Treffer für <SuchMarkierung text={query} wortlaut={woerter} />
        {hatFilter ? ' mit den gesetzten Filtern' : ''}
      </h2>

      {versteckt !== null && (
        <div
          className="mt-3 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] px-3 py-2.5"
          style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
        >
          {/* Dasselbe Zeichen wie am Chip, der diesen Zustand erzeugt hat
              (`BereichAuswahlChip`) — Ursache und Ausweg tragen eine Marke. */}
          <Layers size={15} className="shrink-0 text-[var(--tf-text-secondary)]" aria-hidden />
          <p className="flex-1 text-[13px] leading-snug text-[var(--tf-text)]">
            {/* „Treffer" ist im Deutschen numerus-invariant. */}
            <span className="font-medium">
              {versteckt.treffer.toLocaleString('de-DE')} Treffer
            </span>
            {' liegen außerhalb der gewählten Richtlinien.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => onAnwenden(versteckt)}>
            Alle Richtlinien einbeziehen
          </Button>
        </div>
      )}

      {rest.length > 0 && (
        <>
          <p className="mt-4 text-[12.5px] text-[var(--tf-text-secondary)]">
            {versteckt === null
              ? 'Diese Anpassungen führen zu Treffern:'
              : 'Diese Anpassungen führen ebenfalls zu Treffern:'}
          </p>
          <ul className="mt-4 flex flex-col gap-1">
            {rest.map(a => (
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
      )}

      {/* Nur wenn WIRKLICH nichts hilft — steht ein Kasten da, ist der Weg
          gezeigt, und dieser Satz wäre eine Widerrede gegen ihn. */}
      {rest.length === 0 && versteckt === null && (
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">
          Auch mit gelockerten Einstellungen bringt diese Anfrage nichts. Die
          Wörter kommen im Bestand so nicht vor — ein anderer Begriff führt
          eher weiter als eine andere Einstellung.
        </p>
      )}
    </div>
  );
}
