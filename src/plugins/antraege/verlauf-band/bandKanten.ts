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
 * Die **Namen** über der Bahn stehen seit v4.50 nebenan (`bandTermine.ts`): sie
 * gelten für jeden Termin, nicht nur für die Grenzen. Geteilt bleibt die
 * Gruppierung ({@link tagesGruppen}) — sonst zählte die eine Stelle einen Tag
 * anders als die andere.
 *
 * Rein und node-testbar: keine DOM-Messung, keine Uhr.
 */
import type { Konfidenz, VerlaufsUebergang } from '@/core/status/verlauf';
import type { BandSegment } from './bandGeometrie';
import { tagesGruppen } from './bandTermine';

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
  const out: BandKante[] = [];
  for (const g of tagesGruppen(uebergaenge)) {
    // Ohne Segmentgrenze am selben Tag hat der Übergang keine Stelle auf der
    // Achse — sein Ort ist die Marke über der Bahn, nicht der Strich darin.
    const treffer = segmente.find(s => s.segment.vonDatum === g.tag);
    if (treffer === undefined) continue;
    // `uebergaenge[0]` existiert: eine Gruppe entsteht nur mit ihrem ersten Eintrag.
    const beste = g.uebergaenge[0];
    if (beste === undefined) continue;
    out.push({
      x: treffer.links,
      datum: g.tag,
      konfidenz: beste.konfidenz,
      uebergaenge: g.uebergaenge,
      roh: treffer.segment.statusRef?.roh,
    });
  }
  return out.sort((a, b) => a.x - b.x);
}
