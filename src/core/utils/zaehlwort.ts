/**
 * „1 Wert" / „5 Werte" — die eine Stelle für Zählwörter.
 *
 * Bis v2.410 stand die Fallunterscheidung rund siebzigmal handgeschrieben in der
 * Codebase (`n === 1 ? 'Wert' : 'Werte'`), teils richtig, teils gar nicht. Ein
 * einzelnes „1 Statuswerte" fällt beim Lesen des Codes nicht auf und in einer
 * Sitzung sofort.
 *
 * **Die Hilfe dekliniert NICHT.** Sie kennt weder Kasus noch Genus — der
 * Aufrufer übergibt beide Formen in dem Fall, den sein Satz braucht:
 * `zaehlwort(n, 'Programm', 'Programmen')` ergibt „von 1 Programm" bzw. „von 3
 * Programmen". Wer stattdessen überall den Nominativ einsetzt, erzeugt an einer
 * Genitiv- oder Dativstelle denselben Fehler in anderer Position („von 1
 * Programmen"). Das ist die bewusste Grenze: eine deklinierende Hilfe bräuchte
 * Genus und Kasus als Parameter und wäre an der Aufrufstelle unleserlich.
 *
 * Die Zahl wird deutsch gruppiert (`1.234`), damit Aufrufstellen nicht daneben
 * noch ein eigenes `toLocaleString` führen müssen — genau daraus entstanden
 * bisher Seiten, auf denen dieselbe Größe einmal mit und einmal ohne Punkt stand.
 */
export function zaehlwort(n: number, ein: string, viele: string): string {
  return `${n.toLocaleString('de-DE')} ${n === 1 ? ein : viele}`;
}
