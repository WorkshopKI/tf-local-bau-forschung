/**
 * Aus Übergängen werden **Segmente** — und am Ende steht immer der importierte
 * Status.
 *
 * Das ist die Stelle, an der Pitfall #44 hängt: die Bahn ist eine Rekonstruktion
 * der Vergangenheit, aber der **geltende** Status kommt aus dem Export und wird
 * nie überschrieben. Kommt die Ableitung zu einem anderen Ergebnis, bleibt der
 * importierte Wert stehen und die Abweichung wird ausgewiesen.
 *
 * **Keine erfundene Präzision.** Gleichtägige Kürzel werden nicht sortiert:
 * setzen sie verschiedene Zielstatus, ist das Segment `mehrdeutig` und führt
 * beide Kandidaten. Ein Segment von einem Tag oder weniger — und jedes mit einer
 * offenen Grenze — ist `dauerUnsicher`.
 *
 * Rein: keine IO, keine Uhr; der Bezugszeitpunkt wird hereingereicht.
 */
import { tageZwischen } from '../waechter';
import { gleicherStatus, statusRefVonText } from './status-ref';
import type { StatusRef, VerlaufsAbweichung, VerlaufsSegment, VerlaufsUebergang } from './typen';

/** Ein Tag oder weniger ist nicht unterscheidbar von „nur durchlaufen". */
const UNSICHER_AB_TAGEN = 1;

export interface SegmentErgebnis {
  segmente: VerlaufsSegment[];
  /** Gesetzt, wenn die Ableitung dem importierten Status widerspricht. */
  abweichung?: VerlaufsAbweichung;
  /** Wie viele Übergänge einen Statuswechsel belegen. 0 ⇒ `nicht_beobachtet`. */
  belegteWechsel: number;
}

/** Alle Übergänge eines Tages, in Fundreihenfolge — bewusst unsortiert. */
interface Tagesgruppe {
  tag: string;
  ziele: StatusRef[];
}

function gruppiereNachTag(uebergaenge: readonly VerlaufsUebergang[]): Tagesgruppe[] {
  const out: Tagesgruppe[] = [];
  for (const u of uebergaenge) {
    if (!u.setztStatus) continue;
    const letzte = out[out.length - 1];
    if (letzte && letzte.tag === u.datum) letzte.ziele.push(u.setztStatus);
    else out.push({ tag: u.datum, ziele: [u.setztStatus] });
  }
  return out;
}

/** Verschiedene Zielwerte einer Tagesgruppe, entdoppelt über den Status. */
function verschiedene(ziele: readonly StatusRef[]): StatusRef[] {
  const out: StatusRef[] = [];
  for (const z of ziele) if (!out.some(a => gleicherStatus(a, z))) out.push(z);
  return out;
}

function baueSegment(
  ziele: readonly StatusRef[], von: string | null, bis: string | null,
): VerlaufsSegment {
  const eindeutig = verschiedene(ziele);
  const dauerTage = von !== null && bis !== null ? tageZwischen(von, bis) : null;
  const basis: VerlaufsSegment = {
    statusRef: eindeutig.length === 1 ? eindeutig[0]! : null,
    vonDatum: von,
    bisDatum: bis,
    dauerTage,
    dauerUnsicher: dauerTage === null || dauerTage <= UNSICHER_AB_TAGEN,
  };
  if (eindeutig.length <= 1) return basis;
  return { ...basis, mehrdeutig: true, kandidaten: eindeutig };
}

/** Trifft eines der Segment-Ziele den importierten Status? */
function deckt(segment: VerlaufsSegment, importiert: StatusRef): boolean {
  if (segment.kandidaten) return segment.kandidaten.some(k => gleicherStatus(k, importiert));
  return gleicherStatus(segment.statusRef, importiert);
}

/**
 * Baut die Bahn.
 *
 * @param statusRoh Der importierte Statuswert dieser Ebene — er gilt.
 * @param bezugsZeitpunkt ISO-Tag, an dem die Achse endet. Bei angehaltener Uhr
 *   das Haltedatum aus Phase 0 (`FristErgebnis.bezugsZeitpunkt`), nicht heute.
 */
export function baueSegmente(
  uebergaenge: readonly VerlaufsUebergang[],
  statusRoh: string,
  bezugsZeitpunkt: string,
  erreichbareCodes: ReadonlySet<number> = new Set(),
): SegmentErgebnis {
  const importiert = statusRefVonText(statusRoh);
  const gruppen = gruppiereNachTag(uebergaenge);

  // Kein einziger belegter Wechsel: der Status steht da, seit wann sagt niemand.
  if (gruppen.length === 0) {
    return {
      segmente: [baueSegment([importiert], null, bezugsZeitpunkt)],
      belegteWechsel: 0,
    };
  }

  const segmente = gruppen.map((g, i) =>
    baueSegment(g.ziele, g.tag, gruppen[i + 1]?.tag ?? bezugsZeitpunkt));

  const letztes = segmente[segmente.length - 1]!;
  if (deckt(letztes, importiert)) return { segmente, belegteWechsel: gruppen.length };

  // Die Ableitung sagt etwas anderes als der Export. Der Export gilt — die
  // abgeleitete Strecke bekommt ein offenes Ende, der importierte Wert ein
  // Segment ohne Anfang. Nichts wird überschrieben (Pitfall #44).
  letztes.bisDatum = null;
  letztes.dauerTage = null;
  letztes.dauerUnsicher = true;
  segmente.push(baueSegment([importiert], null, bezugsZeitpunkt));

  return {
    segmente,
    belegteWechsel: gruppen.length,
    abweichung: {
      // Konnte die Ableitung diesen Status überhaupt erreichen? Setzt ihn keine
      // Regel dieser Projektform, ist sie unvollständig — nicht im Widerspruch.
      art: importiert.code !== null && erreichbareCodes.has(importiert.code)
        ? 'widerspruch' : 'nicht_ableitbar',
      erwartet: letztes.statusRef ?? letztes.kandidaten?.[0] ?? null,
      beobachtet: statusRoh,
      datum: bezugsZeitpunkt,
    },
  };
}
