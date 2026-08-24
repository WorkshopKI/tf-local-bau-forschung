/**
 * Serialisiert Operationen pro Zielpfad.
 *
 * Die File System Access API serialisiert Writes pro Handle; Node `fs` tut das
 * nicht. `atomicWrite` besteht aus mehreren Round-Trips (.tmp schreiben, dann
 * rotieren und umbenennen) und ist als Ganzes nicht atomar.
 * Laufen zwei davon verschränkt auf denselben Pfad — realistisch: der
 * Startup-Datenlauf gegen ein manuelles `__tf.datenAktualisieren()` — verliert
 * das Ziel Daten oder bleibt als `.tmp` liegen.
 *
 * Deshalb: eine Promise-Kette je Pfad. Kein echtes Locking (ein Prozess, ein
 * Event-Loop), nur Reihenfolge-Garantie.
 */

/** Laufende Kette je Pfad-Schlüssel. Einträge werden nach Leerlauf entfernt. */
const ketten = new Map<string, Promise<unknown>>();

/**
 * Führt `aktion` aus, sobald alle vorherigen Aktionen für `schluessel` fertig sind.
 *
 * Fehler der Vorgänger brechen die Kette NICHT ab — sonst risse ein einzelnes
 * `NotFoundError` (im Normalbetrieb erwartet, z.B. `exists()`-Probes) alle
 * folgenden Operationen auf demselben Pfad mit.
 */
export function inReihe<T>(schluessel: string, aktion: () => Promise<T>): Promise<T> {
  const vorgaenger = ketten.get(schluessel) ?? Promise.resolve();
  const naechste = vorgaenger.then(aktion, aktion);

  // Aufräumen, sobald diese Aktion die letzte in der Kette war — sonst wächst
  // die Map über die Laufzeit mit jedem je berührten Pfad.
  const eintrag = naechste.then(
    () => { if (ketten.get(schluessel) === eintrag) ketten.delete(schluessel); },
    () => { if (ketten.get(schluessel) === eintrag) ketten.delete(schluessel); },
  );
  ketten.set(schluessel, eintrag);

  return naechste;
}

/** Nur für Diagnose/Tests: wie viele Pfade haben gerade eine laufende Kette? */
export function offeneKetten(): number {
  return ketten.size;
}
