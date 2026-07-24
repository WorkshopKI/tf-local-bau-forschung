/**
 * Datenmodell der Artefakt-Werkbank — die offenen Punkte eines Verbunds.
 *
 * Ein „offener Punkt" ist eine erkannte Lücke/Klärung, die in ein Artefakt
 * (Nachforderung / Rücknahmeempfehlung / Ablehnung) münden soll. Bewusst schlank:
 * `offen`/`erledigt` ist die EINZIGE Zustandsachse — kein Status-Automat.
 */

/** Woher ein Punkt stammt — nur `manuell` ist in Phase 4 aktiv; der Rest ist vorbereitet. */
export type PunktQuelle = 'manuell' | 'map-kriterium' | 'rechencheck' | 'aufbereitung';

export interface WerkbankPunkt {
  /** Stabil aus dem Text (Hash) bzw. dem Origin-Key bei Übernahme. */
  key: string;
  text: string;
  /** Prüfaspekt A–J oder `null` (unzugeordnet). */
  aspektId: string | null;
  /** Sektions-IDs der Fundstellen (FundstelleChip-Mechanik). */
  fundstellen: string[];
  quelle: PunktQuelle;
  /** Ursprungs-Key bei übernommenen Punkten (MAP-Kriterium / Rechencheck). */
  originKey?: string;
  erledigt: boolean;
  erstelltAm: string;
}

/** Persistierter Zustand der Werkbank eines Verbunds. */
export interface WerkbankRecord {
  /** Verbund-Aktenzeichen (Persistenz-Key-Suffix). */
  verbundAz: string;
  punkte: WerkbankPunkt[];
  schemaVersion: 1;
}
