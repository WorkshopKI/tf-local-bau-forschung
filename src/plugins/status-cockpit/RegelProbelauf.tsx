/**
 * „Und was passiert bei **diesem** Vorgang?" — die Probe am echten Fall, direkt
 * im Regel-Editor.
 *
 * Aktenzeichen eingeben, Knopf drücken: welche Regel gewinnt, welche Sperren
 * griffen, mit welchen Feldwerten. Angezeigt wird, was die Engine ohnehin
 * liefert — über **dieselben** Bausteine wie am Antrag
 * ([TodoAnzeige.tsx](@/components/vorgang/TodoAnzeige)). Eine zweite Darstellung
 * derselben Sache liefe beim ersten Sonderfall auseinander, und dann stritten
 * zwei Ansichten über denselben Vorgang.
 *
 * Reine Anzeige: gerechnet wird in `useRegelProbelauf`, formuliert in
 * `TodoAnzeige`.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AbgeleitetMarke, TodoHerleitung, WartetAuf } from '@/components/vorgang/TodoAnzeige';
import { ROLLE_LABEL, type Rolle } from '@/core/status';
import { feldKlasseSchmal, feldStil } from './labels';
import type { ProbeLauf } from './useRegelProbelauf';

export function RegelProbelauf({ satz, lauf }: {
  satz: Rolle;
  lauf: ProbeLauf;
}): React.ReactElement {
  const [eingabe, setEingabe] = useState('');
  const kannLaufen = eingabe.trim() !== '' && !lauf.aktion.busy;

  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)] shrink-0">
          Probe am Fall — ausgewertet wird der Regelsatz <strong>{ROLLE_LABEL[satz]}</strong>:
        </span>
        <input
          value={eingabe}
          placeholder="Aktenzeichen"
          // `feldKlasseSchmal` statt `feldKlasse`: dessen `w-full` steht im
          // erzeugten Stylesheet HINTER `w-[180px]` und gewänne — das Feld wäre
          // 100 % breit und quetschte den Knopf daneben weg.
          className={`${feldKlasseSchmal} w-[180px] shrink-0`} style={feldStil}
          onChange={e => setEingabe(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && kannLaufen) void lauf.aktion.run(eingabe); }}
        />
        <Button
          variant="secondary" size="sm" disabled={!kannLaufen}
          onClick={() => lauf.aktion.run(eingabe)}
        >
          {lauf.aktion.busy ? 'Prüft …' : 'Probelauf'}
        </Button>
      </div>

      {lauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {lauf.aktion.error}</p>
      )}

      {/* Zwei Leer-Fälle, zwei Antworten: „kennen wir nicht" und „liegt außerhalb
          des Betrachtungsbereichs" sind verschiedene Sachen, und die zweite ist
          keine Fehleingabe. */}
      {lauf.leer === 'unbekannt' && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Kein Vorgang mit diesem Aktenzeichen im Bestand.
        </p>
      )}
      {lauf.leer === 'ausserhalb' && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Der Vorgang existiert, liegt aber außerhalb des Betrachtungsbereichs — deshalb
          wertet ihn auch das Board nicht aus. Bereich im Seitenkopf umstellen, um ihn zu sehen.
        </p>
      )}

      {lauf.treffer !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] font-mono text-[var(--tf-text-tertiary)]">
              {lauf.treffer.aktenzeichen}
            </span>
            {lauf.treffer.ergebnis.todo === null ? (
              <Badge variant="default">Kein To-do ermittelt</Badge>
            ) : (
              <span className="text-[12.5px] font-medium text-[var(--tf-text)]">
                „{lauf.treffer.ergebnis.todo}"
              </span>
            )}
            <WartetAuf e={lauf.treffer.ergebnis} />
            <AbgeleitetMarke e={lauf.treffer.ergebnis} rolle={lauf.treffer.rolle} />
          </div>

          {/* Warum ein Strang schweigt, ist bei der Probe die halbe Antwort —
              gerade dann, wenn gar kein To-do herauskommt. */}
          {lauf.treffer.ergebnis.gesperrtDurch.length > 0 && (
            <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
              Greifende Sperren:{' '}
              <span className="font-mono">{lauf.treffer.ergebnis.gesperrtDurch.join(', ')}</span>
            </p>
          )}

          <TodoHerleitung e={lauf.treffer.ergebnis} rolle={lauf.treffer.rolle} />

          {lauf.treffer.ergebnis.weitereTreffer.length > 0 && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              Träfe ebenfalls zu, verliert aber die Kaskade:{' '}
              {lauf.treffer.ergebnis.weitereTreffer.map(t => `${t.regelId} („${t.todo}")`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
