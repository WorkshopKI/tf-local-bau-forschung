/**
 * **Was über der Bahn steht** — jeder gesetzte Termin als Marke.
 *
 * Bis v4.49 zeigte diese Etage nur die Kürzel, die einen **Statuswechsel**
 * auslösen: gemessen 7,3 % der Termine. Die übrigen 92,7 % standen in
 * `spur.uebergaenge` vollständig da — mit Datum, Klartext und Rollen — und wurden
 * nicht gezeichnet. Die Leitfrage des Bildes („wer hat was wann getan") beantwortete
 * die Bahn damit für ein Vierzehntel ihrer eigenen Daten.
 *
 * Schwester von `bandKanten.ts`, nicht Teil davon: dort geht es um den **Strich an
 * einer Segmentgrenze** (Konfidenz, Farbe des folgenden Abschnitts), hier um die
 * **Marke über der Bahn** (Kürzel, Rolle, Gewicht). Geteilt ist die Gruppierung —
 * {@link tagesGruppen} —, damit beide denselben Tag gleich zählen.
 *
 * **Ein Tag, eine Marke.** Mehrere Kürzel am selben Tag stünden exakt übereinander
 * (gemessen im Bestand 51 Striche auf 26 Tagen); die Marke zeigt deshalb das best
 * belegte und dahinter `+n`, der Titel nennt alle.
 *
 * **Gemessen, und was kollidiert, entfällt.** Ein gekürztes Kürzel wäre ein
 * anderes Kürzel — `AAE` und `AAEB` sind verschiedene Dinge. Eine Reihe
 * überlappender Codes wäre schlechter zu lesen als keiner. Dass im dichten Bestand
 * nur ein Teil erscheint, ist die richtige Auskunft, kein Mangel.
 *
 * Rein und node-testbar: keine DOM-Messung, keine Uhr — Textmaß und Achse kommen
 * als Argumente herein.
 */
import type { Konfidenz, VerlaufsUebergang } from '@/core/status/verlauf';
import { imFenster, xFuerTag, type ZeitAchse } from './bandGeometrie';

/**
 * Rang der Konfidenz — kleiner heißt besser belegt. Die Reihenfolge ist die des
 * Typs selbst (`verlauf/typen.ts`) und **nicht** verhandelbar: sie entscheidet,
 * welches Kürzel an einem Tag sichtbar wird, an dem sich mehrere drängen.
 */
const RANG: Record<Konfidenz, number> = {
  trigger_bestaetigt: 0,
  trigger_bedingt: 1,
  zeitliche_naehe: 2,
  kein_kuerzel: 3,
};

/** Alle Übergänge eines Tages, best belegter zuerst. */
export interface TagesGruppe {
  /** ISO-Tag. */
  tag: string;
  uebergaenge: VerlaufsUebergang[];
}

/**
 * Bündelt Übergänge nach Tag, best belegter zuerst — die gemeinsame Grundlage von
 * Kante und Marke.
 *
 * Die Tagesfolge bleibt die der Eingabe (`baueUebergaenge` liefert aufsteigend);
 * sortiert wird nur **innerhalb** eines Tages, denn der Export führt keine Uhrzeit
 * und eine erfundene Reihenfolge wäre erfundene Präzision.
 */
export function tagesGruppen(uebergaenge: readonly VerlaufsUebergang[]): TagesGruppe[] {
  const proTag = new Map<string, VerlaufsUebergang[]>();
  for (const u of uebergaenge) {
    const g = proTag.get(u.datum);
    if (g) g.push(u); else proTag.set(u.datum, [u]);
  }
  return [...proTag.entries()].map(([tag, gruppe]) => ({
    tag,
    uebergaenge: [...gruppe].sort((a, b) => RANG[a.konfidenz] - RANG[b.konfidenz]),
  }));
}

/** Luft links und rechts einer Marke — Polster (2 × 3 px), Rand (2 × 1 px), Reserve. */
const MARKE_POLSTER = 10;
/** Mindestlücke zwischen zwei Marken. */
const MARKE_ABSTAND = 4;

/** Ein Termin über der Bahn, fertig platziert. */
export interface TerminMarke {
  /** ISO-Tag — zugleich der React-Schlüssel. */
  datum: string;
  /** Linke Kante der Marke: über dem Tag zentriert, in die Bahn geklemmt. */
  links: number;
  breite: number;
  /** Was in der Marke steht — `AAE` oder `AAE +2`. */
  text: string;
  /**
   * Alle Übergänge dieses Tages, best belegter zuerst. Die Anzeige liest daraus
   * Tönung (Rolle des **gezeigten** Kürzels), Gewicht (Meilenstein), Titel und
   * Filterwirkung — hier wird nichts davon vorentschieden, damit diese Datei rein
   * über Platz urteilt.
   */
  uebergaenge: readonly VerlaufsUebergang[];
}

export interface TerminOptionen {
  /** Die x-Skala der Bahn — dieselbe Rechnung, die die Balken setzt. */
  achse: ZeitAchse;
  bahnBreite: number;
  /** Breite eines Textes in px. `null` = keine Messung möglich ⇒ keine Marken. */
  messeText: ((text: string) => number) | null;
}

/**
 * Setzt die Termine über die Bahn.
 *
 * `messeText: null` (verborgene Pane, kein Canvas) ⇒ **keine** Marken: ohne Maß
 * ließe sich die Kollision nicht prüfen, und geraten wäre hier schlimmer als still.
 *
 * Termine **außerhalb** des Achsenfensters bekommen keine Marke. Das kann nur die
 * Zukunft sein — der linke Rand deckt den frühesten Termin (`bandGeometrie.ts`) —,
 * und ein an den Rand geklemmter Termin behauptete ein Datum, das er nicht hat.
 */
export function verteileTermine(
  gruppen: readonly TagesGruppe[], o: TerminOptionen,
): TerminMarke[] {
  const messe = o.messeText;
  if (messe === null) return [];

  const out: TerminMarke[] = [];
  let belegtBis = Number.NEGATIVE_INFINITY;
  // Chronologisch, also links nach rechts: bei Gedränge gewinnt der frühere Termin.
  for (const g of [...gruppen].sort((a, b) => a.tag.localeCompare(b.tag))) {
    const erste = g.uebergaenge[0];
    if (erste === undefined) continue;
    if (!imFenster(o.achse, g.tag)) continue;
    const rest = g.uebergaenge.length - 1;
    const text = rest > 0 ? `${erste.kuerzel} +${rest}` : erste.kuerzel;
    const breite = messe(text) + MARKE_POLSTER;
    if (breite > o.bahnBreite) continue;
    const x = xFuerTag(o.achse, g.tag);
    // Am Rand darf die Marke nach innen rutschen: ein halb abgeschnittenes Kürzel
    // wäre unlesbar, die kleine Verschiebung bleibt zuordenbar.
    const links = Math.min(Math.max(0, x - breite / 2), o.bahnBreite - breite);
    if (links < belegtBis + MARKE_ABSTAND) continue;
    belegtBis = links + breite;
    out.push({ datum: g.tag, links, breite, text, uebergaenge: g.uebergaenge });
  }
  return out;
}
