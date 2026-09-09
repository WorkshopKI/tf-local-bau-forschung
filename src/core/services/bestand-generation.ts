/**
 * Ein Zähler, der sagt: **der Antrags-/Verbund-Bestand in IDB ist nicht mehr
 * derselbe.**
 *
 * Wozu: Seiten, die über den ganzen Bestand rechnen (Vorgangs-Board,
 * Vorgangs-Regeln) halten ihr Ergebnis über den Seitenwechsel hinweg. Ein
 * solcher Cache braucht ein Signal, wann er falsch wird — und „falsch" heißt
 * hier genau eines: der Bestand wurde ersetzt (CSV-Import, Snapshot-Sync,
 * Spalten-Nachzug). Ein Zeitstempel allein wäre zu grob (er merkt den Import
 * nicht) und ein Inhalts-Hash zu teuer (er läse den Bestand, den wir gerade
 * nicht lesen wollen).
 *
 * **Diese Datei importiert absichtlich nichts.** Sie wird sowohl aus
 * `core/status/journal/` als auch aus `plugins/antraege/` benutzt; jede
 * Abhängigkeit hier würde diese beiden Richtungen zu einem Zyklus schließen
 * können, und die Zyklen-Allowlist des Projekts ist leer.
 *
 * **Ein einziger Schreiber**: `plugins/antraege/snapshot-refresh.ts`. Das ist
 * die Stelle, durch die jeder Bestandswechsel ohnehin läuft (Snapshot-Watcher,
 * beide Phasen der Datenaktualisierung, die Kurations-Dialoge). Der
 * Convention-Guard `bestand-generation-am-choke-point` hält das fest.
 *
 * **Ehrliche Grenze**: ein Import, der `refreshAntraegeStoreAfterSync` umgeht,
 * bumpt den Zähler nicht. Dagegen steht die TTL der Cache-Nutzer als Obergrenze
 * für die Schalheit — nicht der Anspruch, dass dieser Zähler lückenlos ist.
 */

let generation = 0;

const hoerer = new Set<() => void>();

/** Der aktuelle Stand. Teil des Cache-Schlüssels der Bestands-Seiten. */
export function bestandGeneration(): number {
  return generation;
}

/**
 * Sagt Bescheid, wenn der Zähler weiterspringt.
 *
 * Wozu: Ein Leser, der den Stand nur beim Rendern abliest, friert ihn ein — sein
 * Cache-Schlüssel trüge nach einem Import weiter die alte Generation, während der
 * Lauf sein Ergebnis längst unter der neuen ablegt. Die beiden fänden sich nie
 * wieder. Über `useSyncExternalStore` folgt der Schlüssel dem Zähler, ohne dass
 * diese Datei React kennen muss (sie importiert bewusst nichts).
 */
export function subscribeBestandGeneration(hoere: () => void): () => void {
  hoerer.add(hoere);
  return () => { hoerer.delete(hoere); };
}

/** Meldet: der Bestand wurde ersetzt. Einziger Aufrufer: `snapshot-refresh.ts`. */
export function markiereBestandGeaendert(): void {
  generation += 1;
  for (const hoere of hoerer) hoere();
}
