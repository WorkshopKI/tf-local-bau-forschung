/**
 * Welches Prüfkriterium passt zu einem Widerspruch?
 *
 * Der Weg läuft über die bestehende Mechanik: Kriterium → Prüfaspekte A–J →
 * VB-Sektionen (`fundstellenFuerItem`). Ein Widerspruch nennt die Sektionen, in
 * denen er steht; das Kriterium mit der grössten Überschneidung gewinnt.
 *
 * Bewusst KEIN zweiter Zuordnungspfad und keine Stichwortsuche: gäbe es hier eine
 * eigene Heuristik, wichen die Fundstellen-Chips am Kriterium und die
 * Widerspruchs-Zuordnung irgendwann auseinander, ohne dass es jemand merkt.
 *
 * Ohne Treffer wird `null` geliefert — die Oberfläche deaktiviert den Knopf dann
 * mit Begründung, statt den Widerspruch an ein beliebiges Kriterium zu hängen.
 *
 * Rein.
 */
import type { AspektMapping } from '@/plugins/antraege/aufbereitung/aspekte';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { MapChecklistenItem } from '../checkliste/typen';
import type { Widerspruch } from '../infografik/substanz';
import { fundstellenFuerItem } from '../vb/fundstellen';

export interface ItemTreffer {
  itemId: string;
  /** Zahl der gemeinsamen Sektionen — Begründung für die Auswahl. */
  gemeinsameSektionen: number;
}

/**
 * Bestes Prüfkriterium zu einem Widerspruch. Rein.
 *
 * `items` sollte bereits auf die anwendbaren Kriterien gefiltert sein — ein
 * entfallener Block darf keine Nachforderung tragen.
 */
export function findePassendesItem(
  widerspruch: Widerspruch,
  items: readonly MapChecklistenItem[],
  mapping: AspektMapping | null,
  gliederung: readonly VbSektion[],
  markdown: string,
): ItemTreffer | null {
  if (widerspruch.sektionIds.length === 0 || mapping === null) return null;
  const gesucht = new Set(widerspruch.sektionIds);

  let bester: ItemTreffer | null = null;
  let besteBreite = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const fundstellen = fundstellenFuerItem(item, mapping, gliederung, markdown);
    const gemeinsam = fundstellen.filter(f => gesucht.has(f.sektionId)).length;
    if (gemeinsam === 0) continue;

    // Bei gleicher Überschneidung gewinnt das speziellere Kriterium (weniger
    // Fundstellen insgesamt) — ein Kriterium, das auf halbe VB zeigt, ist der
    // schlechtere Anker. Danach entscheidet die ID, damit die Wahl stabil bleibt.
    const besser = bester === null
      || gemeinsam > bester.gemeinsameSektionen
      || (gemeinsam === bester.gemeinsameSektionen && fundstellen.length < besteBreite)
      || (gemeinsam === bester.gemeinsameSektionen && fundstellen.length === besteBreite
        && item.id < bester.itemId);

    if (besser) {
      bester = { itemId: item.id, gemeinsameSektionen: gemeinsam };
      besteBreite = fundstellen.length;
    }
  }

  return bester;
}

/** Bemerkungstext, der am Kriterium hinterlegt wird. Rein. */
export function widerspruchAlsBemerkung(w: Widerspruch): string {
  return `Widerspruch zur Einreichung (${w.art}): Einreichung nennt „${w.fakt}",`
    + ` die Vorhabensbeschreibung nennt „${w.aussageImText}".`;
}
