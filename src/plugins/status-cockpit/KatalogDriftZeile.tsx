/**
 * Die Bilanz gegenüber der Auslieferung: eine Zeile, ausklappbar.
 *
 * **Kein Knopf, keine Farbe, kein Icon-Signal.** Anders als der Drift-Block der
 * To-do-Kaskade bietet diese Zeile nichts zum Nachziehen an: hier ist die
 * gepflegte Fassung der spätere Stand, nicht der abweichende. Sie stellt fest —
 * die Entscheidung, was davon in den Code wandert, fällt ein Mensch beim
 * nächsten Release.
 *
 * Rein darstellend; Zahlen und Grammatik kommen aus `katalogDriftAnsicht.ts`.
 */
import { ChevronDown } from 'lucide-react';
import { hatDrift } from '@/core/status';
import type { KatalogDrift, ZahPhase } from '@/core/status';
import { DRIFT_ZWECK, driftGruppen, driftSatz } from './katalogDriftAnsicht';
import { feldStil } from './labels';

export function KatalogDriftZeile({ drift, fassungPhasen, seedPhasen }: {
  drift: KatalogDrift;
  /** Phasen der Fassung — für die Beschriftung der rechten Seite einer Zuordnung. */
  fassungPhasen: readonly ZahPhase[] | undefined;
  /** Phasen der Auslieferung — für die linke Seite. */
  seedPhasen: readonly ZahPhase[] | undefined;
}): React.ReactElement | null {
  // Keine Drift ⇒ keine Zeile. Ein „alles unverändert" wäre eine Meldung über
  // den Normalfall und stünde dauerhaft im Weg.
  if (!hatDrift(drift)) return null;

  const gruppen = driftGruppen(drift, fassungPhasen, seedPhasen);

  return (
    <details className="group shrink-0 rounded px-2.5 py-2" style={feldStil}>
      <summary className="cursor-pointer list-none flex items-start gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ChevronDown size={13} className="mt-0.5 shrink-0 transition-transform group-open:rotate-180" />
        <span>Gegenüber der Auslieferung: {driftSatz(drift)}</span>
      </summary>

      <div className="mt-2 flex flex-col gap-2.5 pl-[19px]">
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">{DRIFT_ZWECK}</p>
        {gruppen.map(g => (
          <div key={g.titel} className="flex flex-col gap-0.5">
            <h4 className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
              {g.titel}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {g.zeilen.map(z => (
                <li key={z.id} className="text-[12px] text-[var(--tf-text-secondary)]">{z.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
