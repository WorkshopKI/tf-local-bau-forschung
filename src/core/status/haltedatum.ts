/**
 * Seit wann steht die Bearbeitungsuhr still?
 *
 * Wenn die Frist in der aktuellen Phase nicht mehr läuft, ist der interessante
 * Zeitpunkt nicht mehr „heute", sondern der Tag, an dem der Vorgang in diese
 * Phase kam. Nur dann kann die Anzeige „34 T bis Entscheidung" sagen statt
 * „seit 2 760 T" — dieselbe Zahl, die vorher falsch war, wird hier richtig.
 *
 * **Drei Quellen, in dieser Reihenfolge, und eine vierte Antwort.**
 *
 * 1. **Belegt** — das Import-Diff-Journal führt `TV_STATUS`/`VB_STATUS` mit
 *    und weiß, wann der Wert gewechselt hat. Das ist Beobachtung, keine
 *    Rekonstruktion. Gilt aber erst ab dem Journal-Nullpunkt.
 * 2. **Genähert** — ein Datumsfeld, das der Katalog derselben ZAH-Phase
 *    zuordnet wie den aktuellen Status. Exakt die Regel, mit der die
 *    Status-Erklärung ihr „seit" bestimmt (`bestimmeSeit` in `herleitung.ts`) —
 *    bewusst dieselbe und nicht eine zweite.
 * 3. **Rekonstruiert** — die Verlaufsableitung (v3.30). Sie kennt den Übergang
 *    in den heutigen Status samt Datum, und für einen angehaltenen Vorgang ist
 *    genau das sein Haltedatum. Zuletzt, weil sie eine Rekonstruktion ist —
 *    im Bestand aber die einzige, die überhaupt antwortet: Stufe 1 reicht nicht
 *    weit genug zurück, und an der Phase eines Endstatus hängt kein Datumsfeld
 *    (§14.9). Die Konfidenz der datierenden Kante wandert in die Herkunft mit.
 * 4. **Gar nicht** — Altbestand ohne Historie, ohne passendes Datumsfeld und
 *    ohne erklärenden Verlauf. Dann bleibt es bei „angehalten, Haltedatum
 *    unbekannt". Auf keinen Fall ersatzweise weiterlaufen lassen: eine
 *    erfundene Zahl ist schlimmer als eine fehlende, weil man ihr nicht
 *    ansieht, dass sie erfunden ist.
 *
 * Rein und deterministisch: Journal-Einträge UND Verlaufs-Kante werden
 * hereingereicht, nicht gelesen. Wer sie nicht hat (Liste, Board), ruft die
 * Funktion ohne sie und bekommt die nächste Stufe.
 */
import { baueChronik } from './chronik';
import type { FeldVorkommen } from './feld-aufloesung';
import type { JournalEintrag } from './journal/typen';
import type { MappingVersion, ZahPhaseId } from './typen';

/**
 * Woher das Haltedatum kam — gehört an die Anzeige, nicht nur ins Ergebnis.
 *
 * Belastbar sind `journal` und `verlauf_bestaetigt` (beobachtet bzw. eine Regel,
 * deren Vorbedingungen aufgingen); hergeleitet sind `datumsfeld` (nur die Phase
 * passt, nicht der Status) und `verlauf_bedingt` (die Regel griff, ihre
 * Vorbedingungen ließen sich aber nicht prüfen). Die Anzeige muss beides
 * unterscheiden.
 */
export type HaltedatumHerkunft =
  | 'journal' | 'datumsfeld' | 'verlauf_bestaetigt' | 'verlauf_bedingt';

/** Was `FristErgebnis` mitführt — inklusive der vierten Antwort „gar nicht". */
export type HaltedatumQuelle = HaltedatumHerkunft | 'unbekannt';

export interface Haltedatum {
  /** ISO-Tag. */
  tag: string;
  herkunft: HaltedatumHerkunft;
}

/**
 * Ein Statuswechsel, den die Verlaufsableitung belegt.
 *
 * **Wird hereingereicht, nie hier gerechnet.** Die Übergänge brauchen die
 * C16-Tabelle und den Kürzel-Katalog; diese Datei ist ein Blatt und bleibt es.
 * Gebaut wird der Wert in `verlauf/haltedatum-aus-verlauf.ts`, das seinerseits
 * nur diesen Typ importiert — eine Typ-Kante, keine Laufzeit-Kante.
 */
export interface VerlaufHalt {
  /** ISO-Tag. */
  tag: string;
  konfidenz: 'trigger_bestaetigt' | 'trigger_bedingt';
  /** Das Kürzel, das den Wechsel belegt — gehört an jede Anzeige. */
  kuerzel: string;
  /** Der Statuscode, in den gewechselt wurde. */
  code: number;
}

export interface HaltedatumEingabe {
  version: MappingVersion;
  /** ZAH-Phase des aktuellen Status; `null` = Marker/unbekannt ⇒ kein Datum. */
  zahPhase: ZahPhaseId | null;
  /** Gesetzte Statuseinträge (`sammleVorkommen`) — Grundlage von Stufe 2. */
  vorkommen?: readonly FeldVorkommen[];
  /**
   * Journal-Einträge dieses Antrags zu `TV_STATUS`/`VB_STATUS`, chronologisch
   * beliebig. Grundlage von Stufe 1; fehlt, wo kein IDB-Zugriff möglich ist.
   */
  statusJournal?: readonly JournalEintrag[];
  /**
   * Der Statuswechsel aus der Verlaufsableitung — Stufe 3. Fehlt, wo die
   * C16-Regeln nicht vorliegen; dann verhält sich die Kaskade wie vor v3.30.
   */
  verlauf?: VerlaufHalt | null;
}

/** Die beiden Spalten, die einen Statuswechsel belegen. Gross geschrieben wie
 *  im Journal (`istJournalSpalte` normalisiert dorthin). */
const STATUS_FELDER = new Set(['STATUS_TV', 'STATUS_VB']);

/**
 * Der jüngste belegte Statuswechsel aus dem Journal.
 *
 * Bei einem **unscharfen** Eintrag (mehr als ein Tag zwischen zwei Exporten)
 * nimmt die Funktion das SPÄTERE Ende der Spanne. Der Wechsel ist irgendwann
 * dazwischen passiert; das spätere Ende macht die Stillstandszeit kleiner und
 * damit die Aussage vorsichtiger — eine zu lange gemeldete Liegezeit wäre eine
 * Behauptung, eine zu kurze nur eine Untergrenze.
 */
function ausJournal(eintraege: readonly JournalEintrag[]): string | null {
  let jüngster: string | null = null;
  for (const e of eintraege) {
    if (e.feld === undefined || !STATUS_FELDER.has(e.feld.toUpperCase())) continue;
    // `geleert` ist kein Wechsel IN einen Status, sondern aus allen heraus.
    if (e.art !== 'gesetzt' && e.art !== 'geaendert') continue;
    const tag = (e.unscharf && e.bisDatum ? e.bisDatum : e.datum).slice(0, 10);
    if (tag === '') continue;
    if (jüngster === null || tag > jüngster) jüngster = tag;
  }
  return jüngster;
}

/**
 * Das jüngste Datumsfeld, das der Katalog derselben Phase zuordnet.
 *
 * Nachgeschlagen wird in der FASSUNG, nicht am Feld-Objekt im Vorkommen: das
 * kann aus einer älteren Auflösung stammen und trüge dann eine veraltete
 * Zuordnung (dieselbe Regel wie in `bestimmeSeit`).
 */
function ausDatumsfeld(
  version: MappingVersion, vorkommen: readonly FeldVorkommen[], zahPhase: ZahPhaseId,
): string | null {
  const chronik = baueChronik(vorkommen, { zeigeNebensaechlich: false });
  const passend = chronik.filter(e => {
    const feld = version.felder.find(f => f.feldId === e.feld.feldId);
    return feld?.zahPhaseId === zahPhase;
  });
  return passend[passend.length - 1]?.tag ?? null;
}

/**
 * Ermittelt das Haltedatum nach der Kaskade oben. `null` = Stufe 3, also
 * „unbekannt" — der Aufrufer sagt das dann auch so.
 */
export function ermittleHaltedatum(e: HaltedatumEingabe): Haltedatum | null {
  if (e.zahPhase === null) return null;

  const belegt = e.statusJournal ? ausJournal(e.statusJournal) : null;
  if (belegt !== null) return { tag: belegt, herkunft: 'journal' };

  const genaehert = e.vorkommen ? ausDatumsfeld(e.version, e.vorkommen, e.zahPhase) : null;
  if (genaehert !== null) return { tag: genaehert, herkunft: 'datumsfeld' };

  // Stufe 3: der abgeleitete Verlauf. Zuletzt, weil er eine Rekonstruktion ist —
  // aber im Bestand ist er der einzige, der überhaupt antwortet: das Journal
  // reicht nur bis zu seinem Nullpunkt zurück, und an der Phase eines
  // Endstatus hängt kein Datumsfeld (§14.9).
  if (e.verlauf) {
    return {
      tag: e.verlauf.tag,
      herkunft: e.verlauf.konfidenz === 'trigger_bestaetigt' ? 'verlauf_bestaetigt' : 'verlauf_bedingt',
    };
  }

  return null;
}
