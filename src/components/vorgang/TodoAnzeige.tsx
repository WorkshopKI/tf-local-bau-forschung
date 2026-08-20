/**
 * Die Anzeige **eines** ermittelten To-dos — Marke, Rollen und Herleitung.
 *
 * Geteilt zwischen Vorgangs-Board und Antrag-Detail, weil beide dieselbe Frage
 * beantworten („was steht an, und warum?") und zwei Fassungen davon beim ersten
 * Sonderfall auseinanderliefen. Domänenfrei in dem Sinn, dass hier nichts
 * gerechnet wird: das {@link TodoErgebnis} kommt fertig herein.
 *
 * **Der Abgeleitet-Marker ist kein Schmuck.** Ein abgeleitetes To-do ist eine
 * schwächere Aussage als ein ermitteltes — es sagt „die AB-Regel wartet auf
 * dich", nicht „dein Regelsatz beschreibt diesen Fall". Wer das nicht sieht,
 * hält den Platzhalter für eine gepflegte Regel und schreibt sie nie.
 *
 * Das Wort dafür heißt überall **„abgeleitet"** — so wie `quelle`, der Tooltip
 * und die Rollen-Bilanz des Boards. Bis v4.46.1 stand am Eintrag „geliehen",
 * daneben zählte dieselbe Seite „davon N abgeleitet": zwei Wörter für eine
 * Sache.
 */
import { ROLLE_LABEL, ROLLE_LANG, type Rolle, type TodoErgebnis } from '@/core/status';

/**
 * Kurztext des Markers; `null`, wenn das To-do aus einer eigenen Regel stammt.
 *
 * **Ein Wort, zwei Wege.** Geliehen wird auf zwei Arten: die fremde Regel wartet
 * auf diese Rolle, oder sie nennt sie ausdrücklich als zuständig (`abgeleitetArt`,
 * v4.132). Beides heißt „abgeleitet" — der Unterschied steht hier im Satz, nicht
 * in einem zweiten Wort an der Marke: die Rollen-Bilanz zählt „davon N
 * abgeleitet", und zwei Wörter für eine Sache liefen schon einmal auseinander.
 */
export function abgeleitetTitel(e: TodoErgebnis, rolle: Rolle | 'alle'): string | null {
  if (e.quelle !== 'abgeleitet') return null;
  const wer = rolle === 'alle' ? 'diese Rolle' : ROLLE_LABEL[rolle];
  const woher = e.abgeleitetArt === 'zustaendig'
    ? `Regel ${e.abgeleitetAus ?? '?'} nennt ${wer} ausdrücklich als mitzuständig`
    : `Regel ${e.abgeleitetAus ?? '?'} wartet auf ${wer}`;
  return `Abgeleitet: ${woher} — einen eigenen Regelsatz gibt es dazu noch nicht.`;
}

/** Wer wartet: eine Rolle, der Antragsteller oder niemand Benanntes. */
export function WartetAuf({ e }: { e: TodoErgebnis }): React.ReactElement | null {
  if (e.wartetAuf === null) return null;
  const text = e.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LANG[e.wartetAuf];
  return <span className="text-[11px] text-[var(--tf-text-tertiary)]">wartet auf {text}</span>;
}

/** Der unaufdringliche Marker am abgeleiteten To-do. */
export function AbgeleitetMarke({ e, rolle }: {
  e: TodoErgebnis;
  rolle: Rolle | 'alle';
}): React.ReactElement | null {
  const titel = abgeleitetTitel(e, rolle);
  if (titel === null) return null;
  return (
    <span
      className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)] italic whitespace-nowrap"
      title={titel}
    >
      abgeleitet
    </span>
  );
}

/**
 * Die Herleitung: welche Regel, welche Felder — und beim Wächter zusätzlich,
 * warum er urteilt, wie er urteilt.
 *
 * Ohne sie ist ein To-do eine Behauptung; mit ihr eine nachvollziehbare
 * Ableitung. Die leeren Felder stehen ausdrücklich mit da — genau sie erklären
 * den Fall meistens.
 */
export function TodoHerleitung({ e, rolle, waechterGrund }: {
  e: TodoErgebnis;
  rolle: Rolle | 'alle';
  waechterGrund?: string;
}): React.ReactElement {
  const abgeleitet = abgeleitetTitel(e, rolle);
  return (
    <div className="flex flex-col gap-0.5">
      {e.beschreibung !== null && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{e.beschreibung}</span>
      )}
      {abgeleitet !== null && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)] italic">{abgeleitet}</span>
      )}
      {waechterGrund !== undefined && (
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">Wächter: {waechterGrund}</span>
      )}
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
        {e.belege.map(b => (
          <li key={b.feldId} className="text-[11px] text-[var(--tf-text-tertiary)]">
            <span className="font-mono">{b.feldId}</span>
            {' = '}
            {b.werte.length > 0 ? b.werte.join(', ') : <em>leer</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}
