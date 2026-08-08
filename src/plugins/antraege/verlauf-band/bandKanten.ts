/**
 * **Eine Kante je Tag** — welcher Strich an einer Segmentgrenze steht, und wie
 * er heißt.
 *
 * Bis v3.36 zeichnete die Bahn je *Übergang* eine Kante. Weil mehrere Kürzel
 * auf denselben Tag fallen, lagen sie exakt übereinander: gemessen im Bestand
 * **51 Striche auf 26 Tagen**, an einer Grenze bis zu drei. Sichtbar war der
 * zuletzt gezeichnete — und wenn das ein Symbol war, verdeckte es den Strich
 * darunter und las sich als eigene, unerklärliche Marke („was ist das für ein
 * mini Pfeil?").
 *
 * Deshalb: **ein Tag, eine Kante.** Ihr Stil kommt vom **best belegten**
 * Übergang des Tages — belegt ein Kürzel den Wechsel, ist die Grenze erklärt,
 * auch wenn daneben ein unerklärtes Kürzel steht. Verschwiegen wird dabei
 * nichts: die Kante führt alle Übergänge des Tages mit, der Tooltip zählt sie
 * einzeln auf, und die Klartext-Liste unter der Bahn ohnehin.
 *
 * Seit v3.38 trägt die Kante auch ihren **Namen**: {@link verteileKuerzel} setzt
 * das Kürzel über die Bahn, wo gemessen Platz ist. Position, Stil und Name einer
 * Grenze gehören in dieselbe Datei — sonst rechnete die eine Stelle Kanten aus,
 * die die andere anders zählt.
 *
 * Rein und node-testbar: keine DOM-Messung, keine Uhr — das Textmaß kommt als
 * Funktion herein.
 */
import type { Konfidenz, VerlaufsUebergang } from '@/core/status/verlauf';
import type { BandSegment } from './bandGeometrie';

/**
 * Rang der Konfidenz — kleiner heißt besser belegt. Die Reihenfolge ist die des
 * Typs selbst (`typen.ts`) und **nicht** verhandelbar: sie entscheidet, welcher
 * Strich an einer Grenze steht, an der sich mehrere Kürzel drängen.
 */
const RANG: Record<Konfidenz, number> = {
  trigger_bestaetigt: 0,
  trigger_bedingt: 1,
  zeitliche_naehe: 2,
  kein_kuerzel: 3,
};

export interface BandKante {
  /** px ab linkem Bahnrand — die linke Kante des Segments, das hier beginnt. */
  x: number;
  datum: string;
  /** Die BESTE Konfidenz des Tages; sie trägt den Strich. */
  konfidenz: Konfidenz;
  /** Alle Übergänge dieses Tages, best belegter zuerst. */
  uebergaenge: VerlaufsUebergang[];
  /**
   * Rohstatus des Abschnitts, der hier **beginnt** — der Streifen trägt seine
   * Farbe. Seit v3.38 ist die Kante nicht mehr nur Konfidenzträgerin, sondern
   * zugleich die sichtbare Segmentgrenze: die Flächen sind getönt, ihr
   * Farbunterschied allein trennt zu schwach. Der Join gehört hierher und nicht
   * in die zeichnende Datei — er ist dieselbe Zuordnung, die `x` liefert.
   */
  roh: string | undefined;
}

/**
 * Bündelt die Übergänge einer Spur zu Kanten. Übergänge ohne Segmentgrenze am
 * selben Tag fallen heraus — sie haben keine Stelle auf der Achse; ihr Ort ist
 * die Klartext-Liste.
 */
export function baueKanten(
  segmente: readonly BandSegment[],
  uebergaenge: readonly VerlaufsUebergang[],
): BandKante[] {
  const proTag = new Map<
    string, { x: number; roh: string | undefined; gruppe: VerlaufsUebergang[] }
  >();
  for (const u of uebergaenge) {
    const vorhanden = proTag.get(u.datum);
    if (vorhanden !== undefined) {
      vorhanden.gruppe.push(u);
      continue;
    }
    const treffer = segmente.find(s => s.segment.vonDatum === u.datum);
    if (treffer === undefined) continue;
    proTag.set(u.datum, {
      x: treffer.links, roh: treffer.segment.statusRef?.roh, gruppe: [u],
    });
  }

  const out: BandKante[] = [];
  for (const [datum, { x, roh, gruppe }] of proTag) {
    const sortiert = [...gruppe].sort((a, b) => RANG[a.konfidenz] - RANG[b.konfidenz]);
    // `sortiert[0]` existiert: eine Gruppe entsteht nur mit ihrem ersten Eintrag.
    const beste = sortiert[0];
    if (beste === undefined) continue;
    out.push({ x, datum, konfidenz: beste.konfidenz, uebergaenge: sortiert, roh });
  }
  return out.sort((a, b) => a.x - b.x);
}

// --- Die Kürzel über der Bahn ---------------------------------------------

/** Luft links und rechts einer Kürzel-Marke. */
const MARKE_POLSTER = 4;
/** Mindestlücke zwischen zwei Marken. */
const MARKE_ABSTAND = 4;

/** Ein Kürzel über einer Kante, fertig platziert. */
export interface KuerzelMarke {
  datum: string;
  /** Linke Kante der Beschriftung — über der Kante zentriert und in die Bahn geklemmt. */
  links: number;
  breite: number;
  text: string;
}

/**
 * Setzt die Kürzel über die Kanten — **gemessen, und was kollidiert, entfällt**.
 *
 * Ein gekürztes Kürzel wäre ein anderes Kürzel; abschneiden verbietet sich hier
 * also nicht aus Geschmack, sondern weil `AAE` und `AAEB` verschiedene Dinge
 * sind. Und eine Reihe überlappender Codes wäre schlechter zu lesen als keiner.
 * Im Bestand mit sechsundzwanzig Grenzen zeigt sich deshalb nur ein Teil — das
 * ist die richtige Auskunft, nicht ein Mangel.
 *
 * Fällt ein Tag mit mehreren Kürzeln zusammen, steht das **best belegte** da und
 * dahinter `+n`; alle nennt der Tooltip der Kante (`uebergaenge`).
 *
 * `messeText: null` (keine Messung möglich) ⇒ **keine** Marken: ohne Maß ließe
 * sich die Kollision nicht prüfen, und geraten wäre hier schlimmer als still.
 */
export function verteileKuerzel(
  kanten: readonly BandKante[],
  o: { bahnBreite: number; messeText: ((text: string) => number) | null },
): KuerzelMarke[] {
  const messe = o.messeText;
  if (messe === null) return [];

  const out: KuerzelMarke[] = [];
  let belegtBis = Number.NEGATIVE_INFINITY;
  // `kanten` kommt aus `baueKanten` bereits nach x sortiert — links nach rechts,
  // also chronologisch: bei Gedränge gewinnt der frühere Übergang.
  for (const k of kanten) {
    const erste = k.uebergaenge[0];
    if (erste === undefined) continue;
    const rest = k.uebergaenge.length - 1;
    const text = rest > 0 ? `${erste.kuerzel} +${rest}` : erste.kuerzel;
    const breite = messe(text) + MARKE_POLSTER;
    if (breite > o.bahnBreite) continue;
    // Am Rand darf die Marke nach innen rutschen: ein halb abgeschnittenes
    // Kürzel wäre unlesbar, die kleine Verschiebung bleibt zuordenbar.
    const links = Math.min(Math.max(0, k.x - breite / 2), o.bahnBreite - breite);
    if (links < belegtBis + MARKE_ABSTAND) continue;
    belegtBis = links + breite;
    out.push({ datum: k.datum, links, breite, text });
  }
  return out;
}
