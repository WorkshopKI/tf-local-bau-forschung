/**
 * Dieselbe Person unter zwei Wurzeln — der jüngste Stand gewinnt.
 *
 * Seit v4.1 liegen die persönlichen Ordner unter mehreren Wurzeln. Wechselt
 * jemand die Gruppe oder bleibt eine Ordnerleiche zurück, liest ein Einsammeln
 * denselben Anwender zweimal. Bis dahin galt in jedem nachgelagerten Merge
 * still „der letzte gewinnt" — also der Zufall der Wurzel-Reihenfolge, und
 * damit potenziell die ALTE Datei.
 *
 * Die Regel liegt deshalb an genau EINER Stelle und wird von den Aufrufern der
 * drei Array-Sammler angewandt, bevor irgendein `apply…` läuft. **Kein Root hat
 * Vorrang** — das Ergebnis ist von der Reihenfolge unabhängig (das prüft der
 * Test in beiden Richtungen).
 *
 * Der Schlüssel ist die Identität der Nutzlast (Kürzel, Geräte-Id, Eintrags-Id),
 * NICHT der Ordnername: jeder nachgelagerte Merge kollabiert ohnehin auf die
 * Person, und ein Gruppenwechsel geht in aller Regel mit einer Umbenennung des
 * Ordners einher.
 *
 * Die vier `autoCollect*`-Funktionen des Feedbacks nutzen sie NICHT — sie sind
 * keine Sammler, sondern vollständige Read-Modify-Write-Zyklen; ihr Batch
 * existiert am Aufrufort gar nicht. Dort sitzt dieselbe Regel eine Ebene tiefer
 * als Stale-Guard in den Merge-Funktionen.
 */

/**
 * Kollabiert Einträge, die zum selben Schlüssel gehören: je Schlüssel überlebt
 * der jüngste Zeitstempel.
 *
 * - Gleichstand, fehlender oder unparsebarer Zeitstempel → der zuerst gesehene
 *   Eintrag bleibt (deterministisch, und für einen Bestand ohne Dubletten
 *   verhaltensgleich zu vorher).
 * - `schluessel === null` → der Eintrag bleibt unangetastet erhalten. Nichts
 *   wird still verworfen, nur weil es sich nicht zuordnen ließ.
 *
 * Pure: kein Dateisystem, kein Store, keine Uhr.
 */
export function juengsterGewinnt<T>(
  eintraege: readonly T[],
  schluessel: (e: T) => string | null,
  zeitstempel: (e: T) => string | undefined,
): T[] {
  const ausgabe: T[] = [];
  /** Schlüssel → Position in `ausgabe`, damit die Reihenfolge erhalten bleibt. */
  const position = new Map<string, number>();

  for (const eintrag of eintraege) {
    const key = schluessel(eintrag);
    if (key === null) { ausgabe.push(eintrag); continue; }

    const bekannt = position.get(key);
    if (bekannt === undefined) {
      position.set(key, ausgabe.length);
      ausgabe.push(eintrag);
      continue;
    }

    if (istJuenger(zeitstempel(eintrag), zeitstempel(ausgabe[bekannt] as T))) {
      ausgabe[bekannt] = eintrag;
    }
  }

  return ausgabe;
}

/** Strikt jünger. Unparsebar oder gleich zählt NICHT als jünger. */
function istJuenger(neu: string | undefined, alt: string | undefined): boolean {
  const a = neu ? Date.parse(neu) : Number.NaN;
  const b = alt ? Date.parse(alt) : Number.NaN;
  if (Number.isNaN(a)) return false;
  if (Number.isNaN(b)) return true;
  return a > b;
}
