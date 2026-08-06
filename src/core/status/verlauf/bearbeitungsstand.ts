/**
 * Trägt ein Statuswert überhaupt einen **Bearbeitungsstand**?
 *
 * `assoziierter Partner` (93) und `internationaler Partner` (94) sind Rollen im
 * Verbund, keine Bearbeitungsstände; `Irrläufer` (29) und `Sonderstatus` (88)
 * stehen als Kennzeichen neben dem Verfahren. Solche Zeilen haben keinen Verlauf
 * und keine Frist — sie bekommen deshalb keine Statusbahn, verschwinden aber
 * auch nicht stillschweigend.
 *
 * **Keine zweite Handtabelle** (Pitfall #45): die Menge ist genau die
 * Marker-Menge des geltenden Schnitts (`schnittVon(version).markerCodes`), also
 * Auslieferung plus Kuration der PL. Wer einen Code umhängt, ändert beides
 * zugleich.
 *
 * **Gemessen am Bestand (06.08.2026) trifft das auf null Vorgänge zu.**
 * `Sonderstatus` und die beiden Partner-Werte kommen im Antragsbestand nicht
 * vor — die bekannten Zahlen (20 716 / 2 673 / 1 312) stammen aus den Zeilen
 * **ohne Förderkennzeichen** in `9052-prjbsp`, einer Datei mit einer Zeile je
 * Projektbeteiligung. Der Zustand bleibt trotzdem im Modell: der Katalog führt
 * die Codes, und der nächste Export kann sie an einem Antrag tragen.
 *
 * Rein: keine IO, keine Uhr.
 */
import { findeStatusCode } from '../status-codes';

/** Urteil über einen Rohstatus. */
export interface StandUrteil {
  /** Drückt der Wert einen Bearbeitungsstand aus? */
  traegtStand: boolean;
  /** Amtlicher Code; `null` = der Katalog kennt den Text nicht. */
  code: number | null;
  /** Klartext, warum nicht. Nur bei `traegtStand: false` gesetzt. */
  begruendung?: string;
}

/**
 * **Unbekannt heißt nicht „kein Stand".** Ein Statuswert, den der Katalog nicht
 * kennt, bekommt seine Bahn — sonst nähme eine Katalog-Lücke einem Vorgang
 * seinen Verlauf, und niemand sähe warum.
 */
export function beurteileStand(
  statusRoh: string, markerCodes: ReadonlySet<number>,
): StandUrteil {
  const code = findeStatusCode(statusRoh)?.eintrag.code ?? null;
  if (code === null || !markerCodes.has(code)) return { traegtStand: true, code };
  return {
    traegtStand: false,
    code,
    begruendung: `„${statusRoh.trim()}" ist ein Kennzeichen neben dem Verfahren `
      + `(Code ${code}), kein Bearbeitungsstand — dazu gibt es keinen Verlauf.`,
  };
}
