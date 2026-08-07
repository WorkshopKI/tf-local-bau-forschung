/**
 * Was die Kürzel-Zuarbeit behauptet und der Fachsystemexport nicht kennt.
 *
 * Mit v3.23 ist C16 alleinige Regelquelle. Die 41 Regeln der Zuarbeit fallen
 * damit weg — **aber nicht spurlos**. Wo sie über C16 hinausgehen, sind sie
 * unbelegt, und „unbelegt" ist etwas anderes als „falsch": die Regeln stammen
 * von jemandem, der die Vorgänge bearbeitet hat. Sie stillschweigend
 * weiterzuführen wäre so verkehrt wie sie stillschweigend fallen zu lassen.
 *
 * Diese Datei erzeugt die Liste dazu — **reine Daten, keine Oberfläche**. Das
 * Klärungsregister, das sie aufnimmt, ist Phase 2b; hier entsteht nur der
 * Inhalt.
 *
 * **Verglichen wird über alle Programme.** Die Zuarbeit schlägt nach (Kürzel,
 * Projektform), C16 nach (Programm, Kürzel) — die Schlüssel decken sich nicht.
 * Ein Klärfall entsteht deshalb erst, wenn C16 in KEINER Richtlinie eine Zeile
 * führt, die dieses Kürzel auf der behaupteten Ebene bewegt. Die engere Frage
 * („in dieser Richtlinie nicht") wäre eine über die Datenlage des Exports, nicht
 * über die Zuarbeit.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from '../normalisierung';
import type { KuerzelTriggerRegel } from '../kuerzel-trigger.data';
import type { TriggerZeile } from '../typen';
import { zielStatusFuer } from './c16-regeln';
import type { SpurArt } from './typen';

/** Eine Regel der Zuarbeit, für die C16 nichts führt. */
export interface Klaerfall {
  kuerzel: string;
  projektform: string;
  /** Welche Ebenen die Zuarbeit bewegt sieht; leer bei `scope: null`. */
  ebenen: SpurArt[];
  /** Wortlaut des Zielstatus, wie die Zuarbeit ihn führt (inkl. Tippfehler). */
  zielRoh: string;
  /** Amtlicher Code, falls der Wortlaut auflöste. */
  zielCode: number | null;
  /** Der Originalsatz der Bemerkungsspalte. */
  original: string;
  /** Warum es ein Klärfall ist — im Klartext, für das Register. */
  grund: string;
}

const GRUND_OHNE_ZEILE =
  'Von einer Bearbeiterin aus der Praxis abgeleitet, im Fachsystemexport (C16) nicht enthalten.';
const GRUND_OHNE_EBENE =
  'Von einer Bearbeiterin aus der Praxis abgeleitet; die Zuarbeit lässt offen, '
  + 'welche Ebene der Wechsel betrifft, und C16 führt für das Kürzel keinen Statuswechsel.';

/** Welche Ebenen eine Zuarbeit-Regel bewegt sieht. */
function ebenenVon(regel: KuerzelTriggerRegel): SpurArt[] {
  if (regel.scope === 'tv') return ['tv'];
  if (regel.scope === 'verbund') return ['verbund'];
  if (regel.scope === 'tv+verbund') return ['tv', 'verbund'];
  return [];
}

/** Auf welchen Ebenen C16 dieses Kürzel bewegt — über ALLE Richtlinien. */
function c16Ebenen(trigger: readonly TriggerZeile[]): Map<string, Set<SpurArt>> {
  const m = new Map<string, Set<SpurArt>>();
  for (const z of trigger) {
    if (!z.geparst) continue;
    const key = normKey(z.kuerzel);
    if (!key) continue;
    for (const art of ['tv', 'verbund'] as const) {
      if (zielStatusFuer(z, art) === null) continue;
      const menge = m.get(key);
      if (menge) menge.add(art); else m.set(key, new Set([art]));
    }
  }
  return m;
}

/**
 * Die Klärfälle aus dem Vergleich beider Quellen.
 *
 * Betrachtet werden nur Regeln MIT Zielstatus — eine reine Benachrichtigungs-
 * Regel („trigger an AB") behauptet keinen Statuswechsel und kann C16 deshalb
 * auch nicht widersprechen.
 *
 * Ein Klärfall entsteht in zwei Formen:
 *
 * 1. C16 führt für das Kürzel **gar keinen** Statuswechsel.
 * 2. C16 führt einen, aber nicht auf der Ebene, die die Zuarbeit nennt — dann
 *    ist die Zuarbeit dort allein, und genau das gehört geklärt.
 *
 * Eine Regel mit `scope: null` (12 der 41) fällt nur dann heraus, wenn C16
 * IRGENDEINE Ebene führt: die Zuarbeit sagt nicht, welche, also kann sie ihr
 * auch nicht widersprechen.
 */
export function klaerfaelleAusQuellen(
  zuarbeit: readonly KuerzelTriggerRegel[], trigger: readonly TriggerZeile[],
): Klaerfall[] {
  const c16 = c16Ebenen(trigger);
  const out: Klaerfall[] = [];
  for (const r of zuarbeit) {
    if (!r.zielStatus) continue;
    const gefuehrt = c16.get(normKey(r.kuerzel));
    const ebenen = ebenenVon(r);
    if (gefuehrt && (ebenen.length === 0 || ebenen.some(e => gefuehrt.has(e)))) continue;
    out.push({
      kuerzel: r.kuerzel,
      projektform: r.projektform,
      ebenen,
      zielRoh: r.zielStatus.roh,
      zielCode: r.zielStatus.code,
      original: r.original,
      grund: ebenen.length === 0 ? GRUND_OHNE_EBENE : GRUND_OHNE_ZEILE,
    });
  }
  return out;
}
