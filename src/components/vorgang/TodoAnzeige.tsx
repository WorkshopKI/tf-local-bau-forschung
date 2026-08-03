/**
 * Die Anzeige **eines** ermittelten To-dos — Marke, Rollen und Herleitung.
 *
 * Geteilt zwischen Vorgangs-Board und Antrag-Detail, weil beide dieselbe Frage
 * beantworten („was steht an, und warum?") und zwei Fassungen davon beim ersten
 * Sonderfall auseinanderliefen. Domänenfrei in dem Sinn, dass hier nichts
 * gerechnet wird: das {@link TodoErgebnis} kommt fertig herein.
 *
 * **Der Abgeleitet-Marker ist kein Schmuck.** Ein geliehenes To-do ist eine
 * schwächere Aussage als ein ermitteltes — es sagt „die AB-Regel wartet auf
 * dich", nicht „dein Regelsatz beschreibt diesen Fall". Wer das nicht sieht,
 * hält den Platzhalter für eine gepflegte Regel und schreibt sie nie.
 */
import { ROLLE_LABEL, ROLLE_LANG, type Rolle, type TodoErgebnis } from '@/core/status';

/** Kurztext des Markers; `null`, wenn das To-do aus einer eigenen Regel stammt. */
export function abgeleitetTitel(e: TodoErgebnis, rolle: Rolle | 'alle'): string | null {
  if (e.quelle !== 'abgeleitet') return null;
  const wer = rolle === 'alle' ? 'diese Rolle' : ROLLE_LABEL[rolle];
  return `Abgeleitet aus Regel ${e.abgeleitetAus ?? '?'} — für ${wer} gibt es dazu noch keine eigene Regel.`;
}

/** Wer wartet: eine Rolle, der Antragsteller oder niemand Benanntes. */
export function WartetAuf({ e }: { e: TodoErgebnis }): React.ReactElement | null {
  if (e.wartetAuf === null) return null;
  const text = e.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LANG[e.wartetAuf];
  return <span className="text-[11px] text-[var(--tf-text-tertiary)]">wartet auf {text}</span>;
}

/** Der unaufdringliche Marker am geliehenen To-do. */
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
      geliehen
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
  const geliehen = abgeleitetTitel(e, rolle);
  return (
    <div className="flex flex-col gap-0.5">
      {e.beschreibung !== null && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{e.beschreibung}</span>
      )}
      {geliehen !== null && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)] italic">{geliehen}</span>
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
