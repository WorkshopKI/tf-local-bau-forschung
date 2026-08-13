/**
 * Die Rechnung hinter dem Pfeilpaar der `LaneListe` — ein Platz hoch, ein Platz
 * runter.
 *
 * Sie steht hier und nicht bei den Aufrufern, weil `onVerschiebe` eine Zusage der
 * Liste ist: die Zeilenfolge IST die Bahnfolge. Zwei Domänen lösen dieselbe
 * Zusage ein (Feedback-Board seit v3.41, das Kanban-Fenster seit v4.26), und
 * zwei Kopien derselben Index-Arithmetik wären genau die Doppelung, an der die
 * Board-Geometrie schon einmal auseinandergelaufen ist.
 */

/**
 * Ein Element um einen Platz verschieben (−1 = nach vorn, +1 = nach hinten).
 *
 * Getauscht wird mit der NACHBARZEILE, auch wenn die ausgeblendet ist: die Liste
 * zeigt alle Bahnen in dieser Reihenfolge, und ein Klick, der dort nichts bewegt,
 * sähe kaputt aus.
 *
 * Am Rand (und bei unbekanntem Index) kommt die EINGABE zurück — referenzgleich,
 * damit der Aufrufer den Schreibvorgang sparen kann.
 */
export function verschiebeUmEinen<T>(liste: T[], index: number, richtung: -1 | 1): T[] {
  const ziel = index + richtung;
  if (index < 0 || index >= liste.length || ziel < 0 || ziel >= liste.length) return liste;
  const next = [...liste];
  const [bewegt] = next.splice(index, 1);
  if (bewegt === undefined) return liste;
  next.splice(ziel, 0, bewegt);
  return next;
}
