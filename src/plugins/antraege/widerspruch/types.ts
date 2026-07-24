/**
 * Datenmodell der Widerspruchs-/Stellungnahme-Ansicht (Phase 6).
 *
 * Nach einem RNE/ABL-Bescheid antwortet der Antragsteller (Stellungnahme zur
 * Rücknahmeempfehlung / Widerspruch zur Ablehnung). Diese Ansicht stellt die
 * **tragenden Gründe** des Bescheids Punkt für Punkt der Stellungnahme gegenüber; die
 * Bewertung „ausgeräumt?" trifft **immer der Mensch**.
 */

/** Ob ein tragender Grund durch die Stellungnahme entkräftet wurde. */
export type WiderspruchZustand = 'offen' | 'ausgeraeumt' | 'teilweise' | 'nicht_ausgeraeumt';

/** Der Abgleich-Stand eines einzelnen tragenden Grundes. */
export interface WiderspruchPunkt {
  /** Punkt-Key aus dem gestempelten Run (`WorkflowRun.werkbankPunkte`). */
  punktKey: string;
  zustand: WiderspruchZustand;
  notiz: string;
}

/** Persistierter Abgleich-Stand eines Verbunds (`kv`-Key `widerspruch:<az>`). */
export interface WiderspruchRecord {
  verbundAz: string;
  /** Zugeordnetes Stellungnahme-Dokument (Doc-ID), sofern abgelegt. */
  stellungnahmeDocId?: string;
  punkte: WiderspruchPunkt[];
  schemaVersion: 1;
}
