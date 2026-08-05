/**
 * Welche Zieltage-Vorschläge lassen sich in einem Zug übernehmen?
 *
 * Der Stillstands-Wächter braucht je Status eine Zielvorgabe; ohne sie lautet
 * sein Urteil **`unbewertet`** — ehrlich, aber für den größten Teil des Bestands
 * nutzlos (gemessen: 1937 von 3881 Vorgängen). Gepflegt waren 7 von 74
 * Statuswerten, weil jeder Wert einzeln zu setzen war.
 *
 * Diese Datei entscheidet, **was** übernommen wird — bewusst getrennt von der
 * Oberfläche, damit die Auswahlregeln prüfbar sind:
 *
 * 1. Nur Statuswerte von Phasen, die als **zieltage-relevant** gepflegt sind
 *    (ausgeliefert: Eingang … Entscheidung). Für Begleitung und Abgeschlossen
 *    ist „liegt zu lange" keine sinnvolle Frage, und Marker laufen ohnehin neben
 *    dem Verfahren. Bis v2.408 stand diese Auswahl als feste Menge hier; seit
 *    die PL den Phasenschnitt zuschneidet, ist sie ein Feld am Phasen-Eintrag
 *    (`zieltageRelevant`) — eine neu angelegte Phase muss selbst sagen können,
 *    ob eine Liegezeit-Vorgabe für sie etwas bedeutet.
 * 2. Nur mit **ausreichender Stichprobe** (`MIN_STICHPROBE`). Ein Median aus
 *    zwei Beobachtungen ist keine Zielvorgabe, sondern eine Zufallszahl — solche
 *    Werte werden NICHT gesetzt, sondern als „zu wenig Daten" ausgewiesen.
 * 3. Ein bereits gepflegter Wert wird **nicht stillschweigend** überschrieben:
 *    er steht mit altem und neuem Wert in der Vorschau, damit die Übernahme eine
 *    Entscheidung bleibt.
 *
 * Rein: keine IO, keine Uhr.
 */
import { zahPhasenVon } from './zah-phasen';
import type { StatusWertEintrag, ZahPhase, ZahPhaseId } from './typen';

/**
 * Ab wie vielen Beobachtungen ein Median als Vorschlag taugt.
 *
 * Fünf ist eine Setzung, keine Statistik — sie trennt „ein paar Vorgänge" von
 * „ein einziger, zufällig langer". Wer sie ändert, ändert nur diese Zahl.
 */
export const MIN_STICHPROBE = 5;

export interface ZieltageUebernahme {
  /** `StatusWertEintrag.id` — der Schlüssel, unter dem gesetzt wird. */
  id: string;
  code: number;
  /**
   * Feld, an dem der Wert hängt (`status` = TV, `verbund_status` = Verbund).
   *
   * Derselbe Code steht im Katalog an beiden Feldern; ohne diese Spalte liest
   * sich die Vorschau wie ein Doppeleintrag, obwohl es zwei echte Zeilen mit
   * eigenem bisherigem Wert sind.
   */
  feldId: string;
  /** Anzeigename des Statuswerts. */
  wert: string;
  phase: ZahPhaseId;
  /** Bisher gepflegter Wert; `null` = keiner. */
  alt: number | null;
  /** Vorgeschlagener neuer Wert (Median der Ist-Liegezeiten). */
  neu: number;
  /** Größe der Stichprobe, aus der der Median stammt. */
  n: number;
}

export interface ZieltageAuswahl {
  /** Was gesetzt würde — in Code-Reihenfolge. */
  uebernehmen: ZieltageUebernahme[];
  /** Statuswerte mit Vorschlag, aber zu kleiner Stichprobe. */
  zuWenigDaten: { code: number; wert: string; n: number }[];
}

/**
 * Baut die Vorschau der Sammel-Übernahme.
 *
 * @param werte       Die Statuswerte der Fassung.
 * @param vorschlaege Code → Median + Stichprobengröße (`medianLiegezeit`).
 * @param phaseVon    Wie die Fassung den Code einer ZAH-Phase zuordnet.
 * @param phasen      Die Phasen der Fassung; ohne Angabe der geltende Schnitt.
 * @param minN        Untergrenze der Stichprobe; Default {@link MIN_STICHPROBE}.
 */
export function waehleZieltageVorschlaege(
  werte: readonly StatusWertEintrag[],
  vorschlaege: ReadonlyMap<number, { median: number; n: number }>,
  phaseVon: (w: StatusWertEintrag) => ZahPhaseId | null,
  phasen?: readonly ZahPhase[],
  minN: number = MIN_STICHPROBE,
): ZieltageAuswahl {
  const uebernehmen: ZieltageUebernahme[] = [];
  const zuWenigDaten: { code: number; wert: string; n: number }[] = [];
  const gesehen = new Set<number>();
  const relevant = new Set(
    zahPhasenVon(phasen).filter(p => p.zieltageRelevant).map(p => p.id),
  );

  for (const w of werte) {
    if (!w.aktiv || w.code === undefined) continue;
    const phase = phaseVon(w);
    if (phase === null || !relevant.has(phase)) continue;
    const v = vorschlaege.get(w.code);
    if (!v) continue;
    // Ein Code kann über mehrere Schreibweisen im Katalog stehen; die Vorschau
    // nennt ihn einmal, gesetzt wird trotzdem an jeder Zeile (eigene `id`).
    if (v.n < minN) {
      if (!gesehen.has(w.code)) {
        gesehen.add(w.code);
        zuWenigDaten.push({ code: w.code, wert: w.wert, n: v.n });
      }
      continue;
    }
    if (w.zieltage === v.median) continue;   // steht schon so da
    uebernehmen.push({
      id: w.id, code: w.code, feldId: w.feldId, wert: w.wert, phase,
      alt: w.zieltage ?? null, neu: v.median, n: v.n,
    });
  }

  uebernehmen.sort((a, b) => a.code - b.code || a.feldId.localeCompare(b.feldId, 'de'));
  zuWenigDaten.sort((a, b) => a.code - b.code);
  return { uebernehmen, zuWenigDaten };
}
