/**
 * Datenmodell der append-only Status-Historie (Schicht 2).
 *
 * Jede beobachtete Änderung eines Katalog-Statusfeldes erzeugt ein `StatusEvent`.
 * Das Log ist strikt append-only (nie mutieren/löschen, auch kein „Aufräumen"
 * ignorierter Felder) und gerätelokal (Store `status_event`, nie im Snapshot).
 */
export interface StatusEvent {
  id: string;
  verbundId: string;
  /** Gesetzt bei TV-bezogenen Feldern (= aktenzeichen). Fehlt bei Verbund-Feldern. */
  tvId?: string;
  feldId: string;
  /** Neuer Wert (bei `typ: 'datum'` das rohe Datum). */
  wert: string;
  /** Voriger Wert; fehlt beim ersten Auftreten (`quelle: 'initial'`). */
  wertVorher?: string;
  /** Fachliches Datum (ISO), wenn das Feld ein Datum trägt und parsebar ist. */
  datumFachlich?: string;
  /** Importzeitpunkt (ISO), an dem das Event erfasst wurde. */
  erfasstAm: string;
  importId: string;
  /** `initial` = erstes beobachtetes Vorkommen (Backfill des Bestands);
   *  `import` = spätere Änderung. */
  quelle: 'import' | 'initial';
}
