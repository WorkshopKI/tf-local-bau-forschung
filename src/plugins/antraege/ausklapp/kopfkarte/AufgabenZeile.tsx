/**
 * Die Zeile **„was zu tun ist"** in der Kopfkarte.
 *
 * Sie beantwortet die dritte Frage des Entwurfs mit dem, was die App wirklich
 * weiß: dem To-do aus der Kaskade. Bis v3.40 standen dort nur Knöpfe — die
 * Aufgabe selbst musste man im Vorgangs-Board suchen.
 *
 * **Ein To-do ohne Herleitung ist eine Behauptung.** Deshalb das „warum?" mit
 * der geteilten {@link TodoHerleitung} (Regel, gelesene Felder samt ihrer
 * LEEREN Werte) statt eines Tooltips, in den nichts hineinpasst.
 *
 * **Eine Verbundzeile faltet, und sagt es.** Tragen die Teilvorhaben
 * verschiedene Aufgaben, steht die erste groß und die übrigen darunter mit
 * ihren Aktenzeichen — nie nur die erste.
 */
import { useState } from 'react';
import { ROLLE_LABEL } from '@/core/status/rollen';
import { AbgeleitetMarke, TodoHerleitung } from '@/components/vorgang/TodoAnzeige';
import type { Aufgabe } from '@/core/status/aufgabe';

const LEISE = 'text-[11px] text-[var(--tf-text-tertiary)]';

/** „2 von 4 Teilvorhaben" — nur dort, wo es mehr als eines gibt. */
function umfang(a: Aufgabe): string | null {
  if (a.tvGesamt <= 1 || a.tv.length === 0) return null;
  return `${a.tv.length} von ${a.tvGesamt} Teilvorhaben`;
}

export function AufgabenZeile({ aufgabe }: { aufgabe: Aufgabe }): React.ReactElement {
  const [warum, setWarum] = useState(false);
  const e = aufgabe.ergebnis;
  const zusatz = umfang(aufgabe);
  // Der eigene Satz schweigt, gezeigt wird ein fremder (v4.136). Alles, was die
  // Herkunft erklärt, muss dann auf DIESEN Satz zeigen — sonst erklärt die
  // Herleitung eine Regel aus der Sicht einer Rolle, die sie gar nicht führt.
  const fremd = aufgabe.gelesenAls !== aufgabe.rolle;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className={`uppercase tracking-wider ${LEISE}`}
        // Die Tabellenzeile trägt daneben ein „→ …" — das hängt am STATUS und
        // ist etwas anderes als die Kaskade. Wer beide nebeneinander sieht, soll
        // den Unterschied nachlesen können, statt ihn für einen Widerspruch zu
        // halten.
        title={`Aus der To-do-Kaskade des Regelsatzes ${ROLLE_LABEL[aufgabe.gelesenAls]}`
          + ' — nicht der Status-Hinweis „→ …" der Tabellenzeile, der allein am Status hängt.'
          + (fremd ? ` Ihr Regelsatz (${ROLLE_LABEL[aufgabe.rolle]}) trifft hier nicht zu — die Aufgabe liegt woanders.` : '')}
      >
        Aufgabe · Regelsatz {ROLLE_LABEL[aufgabe.gelesenAls]}
        {/* Der fremde Satz wird benannt, nicht stillschweigend gelesen: sonst
            liest man „Aufgabe · Regelsatz AB" als die eigene. */}
        {fremd ? ` · nicht ${ROLLE_LABEL[aufgabe.rolle]}` : ''}
      </span>
      <span className="flex items-baseline gap-2 flex-wrap">
        {aufgabe.text === null ? (
          // Kein Treffer ist ein Ergebnis, kein Grund zum Schweigen (Pitfall #44).
          <span className="text-[13px] text-[var(--tf-text-secondary)]">{aufgabe.grund}</span>
        ) : (
          <>
            <span className="text-[14px] font-medium text-[var(--tf-text)]">{aufgabe.text}</span>
            {e !== null && <AbgeleitetMarke e={e} rolle={aufgabe.gelesenAls} />}
            {zusatz !== null && <span className={LEISE}>{zusatz}</span>}
            {e !== null && (
              <button
                type="button"
                onClick={() => setWarum(v => !v)}
                aria-expanded={warum}
                title="Welche Regel, welche Felder?"
                className={`${LEISE} hover:text-[var(--tf-text)] cursor-pointer`}
              >
                warum?
              </button>
            )}
          </>
        )}
      </span>

      {aufgabe.weitere.length > 0 && (
        <ul className="flex flex-col gap-0.5 mt-0.5">
          {aufgabe.weitere.map(g => (
            <li key={g.text} className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{g.text}</span>
              <span className={`font-mono ${LEISE}`}>{g.aktenzeichen.join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      {warum && e !== null && (
        <div className="mt-1">
          <TodoHerleitung e={e} rolle={aufgabe.gelesenAls} />
        </div>
      )}
    </div>
  );
}
