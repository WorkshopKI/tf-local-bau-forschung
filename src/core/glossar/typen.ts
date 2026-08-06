/**
 * Der einzige eigene Datenbestand des Glossars: Abkürzungen und Begriffe.
 *
 * Alles andere, was das Glossar zeigt — Statuswerte, Kürzel, Regeln, ihre
 * Wirkung — wird zur Laufzeit aus der Katalog-Fassung und der Trigger-Tabelle
 * gelesen. Eine Kopie davon stimmte nach zwei Wochen nicht mehr.
 *
 * Was hier steht, steht hier, weil es NIRGENDS sonst steht: was „NF" heißt,
 * führt weder Fassung noch Trigger-Tabelle. Deshalb ist dieser Seed die einzige
 * Ausnahme von „kein eigener Bestand".
 */

export interface GlossarBegriff {
  /** Stabil und sprechend (`nf`, `zieltage`, `vb-vorhabensbeschreibung`) — Ziel von Querverweisen. */
  id: string;
  /** Wie der Eintrag in der Liste steht: die Abkürzung bzw. das Wort selbst. */
  begriff: string;
  /**
   * Ausgeschrieben — nur bei Abkürzungen. Fehlt bei Begriffen, die keine
   * Kurzform sind (Fassung, Zieltage, Betrachtungsbereich); dort wäre eine
   * „Langform" eine Erfindung.
   */
  lang?: string;
  /** Ein bis zwei Sätze in der Sprache des Lesers, nicht in Bezeichnern. */
  erklaerung: string;
  /**
   * Verwandte Einträge, als `id`. Einseitig gepflegt — die Gegenrichtung
   * ergänzt das Glossar beim Anzeigen, damit ein Verweis nicht an einer Seite
   * hängen bleibt.
   */
  verwandt?: string[];
}
