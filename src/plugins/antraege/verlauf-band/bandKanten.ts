/**
 * **Eine Kante je Tag** — welcher Strich an einer Segmentgrenze steht.
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
 * Rein und node-testbar: keine DOM-Messung, keine Uhr.
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
  const proTag = new Map<string, { x: number; gruppe: VerlaufsUebergang[] }>();
  for (const u of uebergaenge) {
    const vorhanden = proTag.get(u.datum);
    if (vorhanden !== undefined) {
      vorhanden.gruppe.push(u);
      continue;
    }
    const treffer = segmente.find(s => s.segment.vonDatum === u.datum);
    if (treffer === undefined) continue;
    proTag.set(u.datum, { x: treffer.links, gruppe: [u] });
  }

  const out: BandKante[] = [];
  for (const [datum, { x, gruppe }] of proTag) {
    const sortiert = [...gruppe].sort((a, b) => RANG[a.konfidenz] - RANG[b.konfidenz]);
    // `sortiert[0]` existiert: eine Gruppe entsteht nur mit ihrem ersten Eintrag.
    const beste = sortiert[0];
    if (beste === undefined) continue;
    out.push({ x, datum, konfidenz: beste.konfidenz, uebergaenge: sortiert });
  }
  return out.sort((a, b) => a.x - b.x);
}
