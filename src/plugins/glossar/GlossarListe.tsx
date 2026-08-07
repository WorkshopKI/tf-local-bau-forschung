/**
 * Die linke Spalte: eine Liste über alle Arten, nach Art gruppiert, je Gruppe mit
 * Zähler. Bewusst KEINE Tabelle — die Spalte ist im Detail-Modus schmal, und die
 * Einträge tragen zu verschiedene Felder, als dass eine gemeinsame Spaltenachse
 * ehrlich wäre.
 */
import { useEffect, useRef } from 'react';
import type { GlossarGruppe, Suchbegriff } from './glossarSuche';
import { Markiert } from './Markiert';

export function GlossarListe({ gruppen, gewaehlt, begriff, onWaehlen, leerText }: {
  gruppen: readonly GlossarGruppe[];
  gewaehlt: string | null;
  /** Nur zum Auszeichnen der Fundstelle — gefiltert ist schon. */
  begriff: Suchbegriff;
  onWaehlen: (id: string) => void;
  /** Was statt der Liste steht, wenn nichts passt — nie eine leere Fläche. */
  leerText: string;
}): React.ReactElement {
  const aktivRef = useRef<HTMLButtonElement | null>(null);

  // Wer mit den Pfeiltasten wandert, muss sehen, wo er ist. `nearest` scrollt
  // nur, wenn der Eintrag wirklich außerhalb liegt — ein Mausklick auf eine
  // sichtbare Zeile ruckelt also nicht.
  useEffect(() => {
    aktivRef.current?.scrollIntoView({ block: 'nearest' });
  }, [gewaehlt]);

  if (gruppen.length === 0) {
    return (
      <p className="px-3 py-4 text-[12.5px] text-[var(--tf-text-tertiary)]">{leerText}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {gruppen.map(g => (
        <section key={g.art} className="flex flex-col">
          <h2 className="sticky top-0 z-10 flex items-baseline gap-1.5 bg-[var(--tf-bg)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
            {g.label}
            <span className="tabular-nums font-normal">{g.eintraege.length}</span>
          </h2>
          <ul className="flex flex-col">
            {g.eintraege.map(e => {
              const aktiv = e.id === gewaehlt;
              return (
                <li key={e.id}>
                  <button
                    ref={aktiv ? aktivRef : undefined}
                    type="button"
                    onClick={() => onWaehlen(e.id)}
                    aria-current={aktiv ? 'true' : undefined}
                    className={`w-full cursor-pointer border-l-2 px-3 py-1.5 text-left transition ${
                      aktiv
                        ? 'border-[var(--tf-primary)] bg-[var(--tf-hover)]'
                        : 'border-transparent hover:bg-[var(--tf-hover)]'
                    }`}
                  >
                    <span className="block truncate text-[13px] font-medium text-[var(--tf-text)]">
                      <Markiert text={e.titel} begriff={begriff} />
                    </span>
                    <span className="block truncate text-[11.5px] text-[var(--tf-text-secondary)]">
                      <Markiert text={e.unter} begriff={begriff} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
