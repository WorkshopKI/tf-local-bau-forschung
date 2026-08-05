/**
 * Die linke Spalte des Regeln-Tabs — die Kaskade in ihren zwei Gestalten.
 *
 * Solange keine Regel geöffnet ist, steht hier die volle Breite zur Verfügung:
 * breite Karten, darüber die Erklärung, der Nachzieh-Hinweis und die
 * FB-Tagesordnung. Sobald rechts eine Regel steht, bleibt nur die Auswahl —
 * schlanke Zeilen, sonst nichts.
 *
 * **Karten erscheinen nie in der schmalen Spalte.** Bei 320 px bräche eine Karte
 * mit drei Badges, Haken, Id und „Bearbeiten" auf fünf Zeilen um und wäre höher
 * als vor dem Umbau — der Zweck der Sache schlüge ins Gegenteil um.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { REGELSATZ_DEFAULT, type MappingVersion, type Rolle, type TodoRegel } from '@/core/status';
import { feldStil } from './labels';
import { TodoRegelKarte } from './TodoRegelKarte';
import { TodoRegelZeile } from './TodoRegelZeile';
import { TodoPlatzhalterListe } from './TodoPlatzhalterListe';
import type { TodoRegelnApi } from './todoRegelnAnsicht';
import type { PlatzhalterLauf } from './usePlatzhalterErhebung';

export function TodoRegelListe({
  regeln, eigeneRegeln, version, satz, api, platzhalter, onExportieren,
  gewaehlt, onWaehlen, unbekannteJeRegel,
}: {
  regeln: readonly TodoRegel[];
  /** Die Regeln OHNE Sperren — nur sie zählen als „gepflegt" in diesem Satz. */
  eigeneRegeln: readonly TodoRegel[];
  version: MappingVersion;
  satz: Rolle;
  api: TodoRegelnApi;
  platzhalter: PlatzhalterLauf;
  onExportieren: (rolle: Rolle) => void;
  /** Id der geöffneten Regel — `null` schaltet auf die Karten-Ansicht. */
  gewaehlt: string | null;
  onWaehlen: (id: string) => void;
  unbekannteJeRegel: ReadonlyMap<string, readonly string[]>;
}): React.ReactElement {
  const navigate = useNavigate();
  const { neu, geaendert, entfallen } = api.todoDrift;
  const driftGesamt = neu.length + geaendert.length + entfallen.length;
  const driftSatz = [
    neu.length > 0 ? `${neu.length} neue Regeln (${neu.join(', ')})` : null,
    geaendert.length > 0 ? `${geaendert.length} geändert (${geaendert.join(', ')})` : null,
    entfallen.length > 0 ? `${entfallen.length} entfallen (${entfallen.join(', ')})` : null,
  ].filter(Boolean).join(' · ');

  return (
    // Kein eigenes `overflow-y-auto`: das Listen-Pane des Shells scrollt schon.
    <div className="flex flex-col gap-2 pr-1">
      {gewaehlt === null && (
        <>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            Geordnete Kaskade: die <strong>erste zutreffende</strong> Regel bestimmt das To-do — die
            Reihenfolge ist also Teil des Ergebnisses, keine Sortierung der Anzeige. Sperren stehen
            vorn und erzeugen kein To-do, sondern legen ganze Stränge stumm. Trifft nichts, steht der
            Antrag im Board unter „Kein To-do ermittelt".{' '}
            {/* Der Weg muss in beide Richtungen offen sein: wer hier eine Regel
                ändert, will sehen, was sie am Bestand tut — und das steht im
                Board, nicht in dieser Liste. */}
            <button
              type="button"
              onClick={() => navigate('/vorgangs-board')}
              className="underline underline-offset-2 cursor-pointer text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
            >
              Wirkung im Vorgangs-Board ansehen
            </button>
          </p>

          {/* Der Regelsatz wächst — ohne diese Zeile bliebe eine gepflegte Fassung
              stumm auf dem Stand ihres ersten Seeds stehen. Die Bilanz steht dran,
              weil das Nachziehen die GELIEFERTEN Regeln ersetzt. */}
          {driftGesamt > 0 && (
            <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <span className="text-[12.5px] text-[var(--tf-text)]">
                Die Auslieferung sagt {driftSatz}. Nachziehen legt neue Regeln an,{' '}
                <strong>ersetzt</strong> die gelieferten und legt entfallene still — eigene Regeln
                bleiben unangetastet.
              </span>
              <Button variant="secondary" size="sm" onClick={api.todoRegelnNachziehen}>Nachziehen</Button>
            </div>
          )}

          {/* Zwei verschiedene Leerzustände, zwei verschiedene Antworten: dem
              AB-Satz fehlt die AUSLIEFERUNG (ein Klick), dem FB-Satz fehlen die
              REGELN (ein Termin). Ein gemeinsamer Text würde beides verwischen. */}
          {eigeneRegeln.length === 0 && satz === REGELSATZ_DEFAULT && (
            <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <span className="text-[12.5px] text-[var(--tf-text)]">
                Diese Fassung führt keine To-do-Regeln. Die Auslieferung bringt den AB-Regelsatz mit
                (26 Regeln + 4 Sperren, transkribiert aus der Mappe „AB Anträge").
              </span>
              <Button variant="secondary" size="sm" onClick={api.todoRegelnNachziehen}>Nachziehen</Button>
            </div>
          )}

          {satz !== REGELSATZ_DEFAULT && (
            <TodoPlatzhalterListe
              satz={satz} anzahlRegeln={eigeneRegeln.length} lauf={platzhalter}
              onRegelErzeugen={api.todoRegelAusPlatzhalter} onExportieren={onExportieren}
            />
          )}
        </>
      )}

      <div className="flex flex-col gap-1">
        {regeln.map((r, i) => (gewaehlt === null ? (
          <TodoRegelKarte
            key={r.id} r={r} version={version} index={i} anzahl={regeln.length} satz={satz}
            api={api} unbekannte={unbekannteJeRegel.get(r.id) ?? []} onWaehlen={() => onWaehlen(r.id)}
          />
        ) : (
          <TodoRegelZeile
            key={r.id} r={r} index={i} satz={satz} aktiv={r.id === gewaehlt}
            unbekannte={unbekannteJeRegel.get(r.id) ?? []} onWaehlen={() => onWaehlen(r.id)}
          />
        )))}
      </div>
    </div>
  );
}
