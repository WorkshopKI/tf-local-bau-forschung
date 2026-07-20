/**
 * Verlauf und Migration des Prüfstands. Reine Funktionen — der Hook ruft sie
 * auf und schreibt das Ergebnis, entscheidet aber selbst nichts.
 *
 * Der Verlauf ist nicht nur Protokoll: er trägt die Information, ob ein Item
 * über eine erledigte Nachforderung erfüllt wurde (`nf-notwendig → nf-erfuellt`)
 * oder durch eine Neubewertung. Daraus ergibt sich die NF-Dauer.
 */
import type {
  MapChecklistenDefinition, MapItemBewertung, MapItemStatus, MapPruefung,
  MapStufe, MapVerlaufEintrag,
} from './typen';

export interface BewertungsAenderung {
  itemId: string;
  status: MapItemStatus;
  stufe?: MapStufe;
  bemerkung?: string;
}

/** Leerer Prüfstand für eine Einreichung. Stempelt die Checklisten-Version. Rein. */
export function neuePruefung(
  einreichungId: string, checklisteVersion: number, zeitpunkt: string,
): MapPruefung {
  return {
    version: 1,
    einreichungId,
    checklisteVersion,
    bedingungen: {},
    bewertungen: {},
    verwaisteBewertungen: [],
    verlauf: [],
    begonnenAm: zeitpunkt,
    aktualisiertAm: zeitpunkt,
  };
}

/** Hat sich an einer Bewertung inhaltlich etwas geändert? Rein. */
function istAenderung(vorher: MapItemBewertung | undefined, nachher: BewertungsAenderung): boolean {
  if (!vorher) return true;
  return vorher.status !== nachher.status || vorher.stufe !== nachher.stufe;
}

/**
 * Wendet eine Bewertung an und schreibt bei inhaltlicher Änderung einen
 * Verlaufseintrag. Eine reine Bemerkungs-Korrektur erzeugt bewusst KEINEN
 * Eintrag — sonst verrauscht der Verlauf und die NF-Zeitpunkte gehen darin unter.
 * Rein: liefert eine neue Prüfung, mutiert nichts.
 */
export function wendeBewertungAn(
  pruefung: MapPruefung,
  aenderung: BewertungsAenderung,
  autor: string | null,
  zeitpunkt: string,
): MapPruefung {
  const vorher = pruefung.bewertungen[aenderung.itemId];

  const neueBewertung: MapItemBewertung = {
    itemId: aenderung.itemId,
    status: aenderung.status,
    ...(aenderung.stufe !== undefined ? { stufe: aenderung.stufe } : {}),
    ...(aenderung.bemerkung !== undefined ? { bemerkung: aenderung.bemerkung } : {}),
    autor,
    geaendertAm: zeitpunkt,
  };

  const verlauf = istAenderung(vorher, aenderung)
    ? [
        ...pruefung.verlauf,
        {
          zeitstempel: zeitpunkt,
          autor,
          itemId: aenderung.itemId,
          von: vorher
            ? { status: vorher.status, ...(vorher.stufe !== undefined ? { stufe: vorher.stufe } : {}) }
            : null,
          nach: {
            status: aenderung.status,
            ...(aenderung.stufe !== undefined ? { stufe: aenderung.stufe } : {}),
          },
        } satisfies MapVerlaufEintrag,
      ]
    : pruefung.verlauf;

  return {
    ...pruefung,
    bewertungen: { ...pruefung.bewertungen, [aenderung.itemId]: neueBewertung },
    verlauf,
    aktualisiertAm: zeitpunkt,
  };
}

/** Setzt die Antwort auf eine manuelle Bedingung. Rein. */
export function setzeBedingung(
  pruefung: MapPruefung, itemId: string, wert: boolean, zeitpunkt: string,
): MapPruefung {
  return {
    ...pruefung,
    bedingungen: { ...pruefung.bedingungen, [itemId]: wert },
    aktualisiertAm: zeitpunkt,
  };
}

/**
 * Zieht einen Prüfstand auf eine neue Checklisten-Version.
 *
 * Bewertungen zu Items, die es nicht mehr gibt, wandern nach
 * `verwaisteBewertungen` statt verworfen zu werden — sonst verschwindet
 * Prüfarbeit unbemerkt, sobald jemand die Checkliste ändert. Taucht ein Item
 * später wieder auf, wird seine alte Bewertung zurückgeholt. Rein.
 */
export function migrierePruefung(
  pruefung: MapPruefung, definition: MapChecklistenDefinition,
): MapPruefung {
  const bekannt = new Set(definition.items.map(i => i.id));

  const behalten: Record<string, MapItemBewertung> = {};
  const verwaist: MapItemBewertung[] = [];

  for (const [itemId, bewertung] of Object.entries(pruefung.bewertungen)) {
    if (bekannt.has(itemId)) behalten[itemId] = bewertung;
    else verwaist.push(bewertung);
  }

  // Zurückgekehrte Items: alte Bewertung wieder aktivieren.
  const weiterVerwaist: MapItemBewertung[] = [];
  for (const bewertung of pruefung.verwaisteBewertungen) {
    if (bekannt.has(bewertung.itemId) && behalten[bewertung.itemId] === undefined) {
      behalten[bewertung.itemId] = bewertung;
    } else if (!bekannt.has(bewertung.itemId)) {
      weiterVerwaist.push(bewertung);
    }
  }

  return {
    ...pruefung,
    checklisteVersion: definition.version,
    bewertungen: behalten,
    verwaisteBewertungen: [...weiterVerwaist, ...verwaist],
  };
}
