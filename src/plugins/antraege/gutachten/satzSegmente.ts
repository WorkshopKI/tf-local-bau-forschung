/**
 * Satzweise Adressierung des Entwurfs (Journey-Paket 3) — für den „Anzeigen"-Sprung
 * zur Fundstelle. Nutzt DIESELBE Segmentierung wie die Check-Engine (`splitSentences`,
 * eine Quelle) → die `satzIndex`-Werte der `CheckResult.fundstellen` zeigen exakt auf
 * die hier erzeugten Segmente. Rein, testbar.
 */
import { splitSentences } from '@/core/services/skills';

export interface SatzSegment {
  /** Der (getrimmte) Satz — identisch zu `splitSentences`. */
  satz: string;
  /** Original-Trennung NACH dem Satz (Leerzeichen/Absatzumbruch), damit das
   *  gerenderte Layout dem Ausgangstext entspricht. */
  sep: string;
}

/**
 * Zerlegt `text` in Satz-Segmente inkl. der originalen Trenn-Zeichen, aligned zur
 * Engine-Segmentierung. Die Array-Position entspricht dem `satzIndex` der Engine.
 */
export function satzSegmente(text: string): SatzSegment[] {
  const saetze = splitSentences(text);
  const segs: SatzSegment[] = [];
  let pos = 0;
  for (let i = 0; i < saetze.length; i++) {
    const s = saetze[i]!;
    const idx = text.indexOf(s, pos);
    const start = idx >= 0 ? idx : pos;
    const end = start + s.length;
    let sep: string;
    if (i < saetze.length - 1) {
      const next = saetze[i + 1]!;
      const nidx = text.indexOf(next, end);
      sep = nidx > end ? text.slice(end, nidx) : ' ';
    } else {
      sep = text.slice(end);
    }
    segs.push({ satz: s, sep });
    pos = end;
  }
  return segs;
}

/**
 * Prüft, ob die per-Block-Segmentierung (z.B. je `teil`) zur kanonischen
 * Gesamt-Segmentierung passt — nur dann sind die laufenden Indizes über mehrere
 * Blöcke identisch zu `splitSentences(gesamttext)`. Bei Abweichung fällt das UI auf
 * eine nicht-adressierbare Darstellung zurück (graceful).
 */
export function segmentierungAligned(gesamttext: string, bloecke: string[]): boolean {
  const gesamt = splitSentences(gesamttext).length;
  const summe = bloecke.reduce((n, b) => n + splitSentences(b).length, 0);
  return gesamt === summe;
}

/** Zyklischer Index für wiederholtes „Anzeigen" (0-basiert, wrap-around, robust). */
export function zyklischerIndex(cursor: number, laenge: number): number {
  if (laenge <= 0) return 0;
  return ((cursor % laenge) + laenge) % laenge;
}
