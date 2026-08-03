/**
 * Was steht an diesem Vorhaben an — **je Teilvorhaben und je Rolle**.
 *
 * Dieselbe Auswertung wie im Vorgangs-Board, nur auf einen Verbund eingegrenzt.
 * Wer einen Antrag geöffnet hat, soll die Aufgabe nicht auf einer zweiten Seite
 * suchen müssen; und die Herleitung („welche Regel, welche Felder") steht
 * daneben, damit das To-do eine Ableitung bleibt und keine Behauptung wird.
 *
 * **Die Einheit ist das Teilvorhaben.** `useStatusVerlauf.vorkommen` wirft alle
 * TVs eines Verbunds zusammen — richtig für Chronik und Ordner, falsch für die
 * Regeln: die lesen überwiegend TV-Spalten, und ein fertiges TV bekäme das To-do
 * seines Nachbarn. Deshalb `jeTeilvorhaben`.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  ROLLEN, ROLLE_LABEL, baueTodoKontext, ermittleTodosAlleRollen,
  type FeldVorkommen, type MappingVersion, type Rolle, type TodoErgebnis,
} from '@/core/status';
import { AbgeleitetMarke, TodoHerleitung, WartetAuf } from '@/components/vorgang/TodoAnzeige';
import { JournalVerlauf } from './JournalVerlauf';

interface TvAufgaben {
  aktenzeichen: string;
  titel: string;
  todos: Record<Rolle, TodoErgebnis>;
}

function RollenZeile({ rolle, e }: { rolle: Rolle; e: TodoErgebnis }): React.ReactElement {
  const [offen, setOffen] = useState(false);
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="w-[30px] shrink-0 text-[11px] font-medium text-[var(--tf-text-secondary)]">
          {ROLLE_LABEL[rolle]}
        </span>
        <span className="text-[12.5px] text-[var(--tf-text)]">{e.todo}</span>
        <AbgeleitetMarke e={e} rolle={rolle} />
        <WartetAuf e={e} />
        <button
          type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
          title="Warum dieses To-do?"
          className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          warum?
        </button>
      </div>
      {offen && (
        <div className="pl-[38px]">
          <TodoHerleitung e={e} rolle={rolle} />
        </div>
      )}
    </li>
  );
}

export function OffeneAufgaben({ version, jeTeilvorhaben, stichtag }: {
  version: MappingVersion;
  jeTeilvorhaben: readonly { aktenzeichen: string; titel: string; vorkommen: FeldVorkommen[] }[];
  /** ISO — injiziert, nie eine Uhr in der Anzeige. */
  stichtag: string;
}): React.ReactElement | null {
  const regeln = version.todoRegeln ?? [];
  const [offen, setOffen] = useState(true);

  const aufgaben = useMemo<TvAufgaben[]>(() => jeTeilvorhaben.map(tv => ({
    aktenzeichen: tv.aktenzeichen,
    titel: tv.titel,
    todos: ermittleTodosAlleRollen(regeln, baueTodoKontext(tv.vorkommen), stichtag),
  })), [jeTeilvorhaben, regeln, stichtag]);

  if (regeln.length === 0 || aufgaben.length === 0) return null;
  const mitTodo = aufgaben.filter(a => ROLLEN.some(r => a.todos[r].todo !== null));

  return (
    <section>
      <button
        type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
        className="flex items-center gap-1.5 cursor-pointer mb-2"
      >
        <ChevronRight
          size={14} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Offene Aufgaben</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          {mitTodo.length} von {aufgaben.length} Teilvorhaben
        </span>
      </button>
      {offen && (
        // Auch die Teilvorhaben OHNE To-do stehen da. „Keine Regel trifft" ist
        // ein Ergebnis, kein Grund zum Verschweigen — dieselbe Regel wie im
        // Board, wo sie eine eigene Gruppe bekommen.
        <ul className="flex flex-col gap-2">
          {aufgaben.map(a => {
            const rollen = ROLLEN.filter(r => a.todos[r].todo !== null);
            return (
              <li key={a.aktenzeichen} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">
                    {a.aktenzeichen}
                  </span>
                  <span className="truncate text-[11.5px] text-[var(--tf-text-tertiary)]" title={a.titel}>
                    {a.titel}
                  </span>
                </div>
                {rollen.length === 0 ? (
                  <span className="pl-2 text-[12px] text-[var(--tf-text-tertiary)]">
                    Kein To-do ermittelt
                    {a.todos.ab.gesperrtDurch.length > 0
                      && ` — gesperrt durch ${a.todos.ab.gesperrtDurch.join(', ')}`}
                  </span>
                ) : (
                  <ul className="pl-2 flex flex-col gap-1">
                    {rollen.map(r => <RollenZeile key={r} rolle={r} e={a.todos[r]} />)}
                  </ul>
                )}
                {/* Der belegte Verlauf gehört zum Teilvorhaben, nicht zum
                    Verbund: das Journal führt Aktenzeichen. */}
                <div className="pl-2">
                  <JournalVerlauf aktenzeichen={a.aktenzeichen} stichtag={stichtag} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
