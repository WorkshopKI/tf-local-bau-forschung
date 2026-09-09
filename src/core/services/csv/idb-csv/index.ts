/**
 * IDB-Zugriff auf die CSV-Stores.
 *
 * Bis v6.42 war das EINE Datei mit 633 Zeilen und 54 Wert-Exporten — formal eine
 * Verantwortung ("IDB-Zugriff"), faktisch ein DAO fuer zehn getrennte Entitaeten,
 * die sich keinen Zustand teilen. Jede neue Entitaet passte "auch noch dazu".
 *
 * Der Import-Spezifizierer bleibt buchstabengleich `.../csv/idb-csv` — alle 94
 * bisherigen Aufrufstellen sind unveraendert. Was der Schnitt bringt: am
 * Dateinamen ist ablesbar, WELCHE Ablage angefasst wird — insbesondere
 * Voll-Store (antrag.ts) gegen Slim-Projektion (antrag-list-view.ts), die
 * Pitfall #32 auseinanderhaelt.
 *
 * Submodule importieren einander DIREKT, nie ueber dieses Barrel: ein Submodul,
 * das './index' liest, erzeugt einen Zyklus, und die Allowlist in
 * scripts/check-cycles.mjs ist leer.
 */
export * from './programm';
export * from './unterprogramm';
export * from './schema';
export * from './row-hash';
export * from './antrag';
export * from './antrag-list-view';
export * from './historie';
export * from './verbund';
export * from './bestand';
export * from './akronym-index';
