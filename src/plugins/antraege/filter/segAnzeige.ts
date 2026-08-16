/**
 * Was ein Segment-Knopf mit Untermenü anzeigt.
 *
 * Reines Modul neben `CollapsibleSeg.tsx`: das Projekt hat keine
 * Komponenten-Test-Umgebung (kein jsdom/RTL), die Entscheidung ist aber
 * fehleranfällig genug für ein Gatter.
 *
 * Der Knopf trägt drei Aussagen gleichzeitig:
 * - **aktiv?** — auch wenn nicht er selbst, sondern einer seiner Unterpunkte
 *   filtert; sonst sähe „Einzelprojekt" unbeteiligt aus, während genau darunter
 *   gefiltert wird.
 * - **welche Zahl?** — die des Unterpunkts, wenn einer gilt. Der Knopf soll
 *   sagen, was er filtert, nicht was er einmal filterte.
 * - **welcher Zusatz?** — „· mit NW Bezug" hinter dem Namen.
 *
 * Die Falle steckt im Oberpunkt: er steht im Menü NOCH EINMAL (als „alle
 * Einzelprojekte"), trägt dort aber dasselbe `label`. Ein naives
 * `unterpunkte.find(u => u.label === value)` findet dann sich selbst und der
 * Knopf liest sich „Einzelprojekt · Einzelprojekt".
 */
import type { CollapsibleSegItem } from './CollapsibleSeg';


export interface SegAnzeige {
  /** Unterpunkt, der gerade filtert — `null`, wenn der Oberpunkt selbst gilt. */
  aktiverUnterpunkt: CollapsibleSegItem | null;
  /** Item, dessen Zahl und Tooltip der Knopf zeigt. */
  gezeigt: CollapsibleSegItem;
  /** Farbig markiert (eigener Wert ODER ein Unterpunkt davon). */
  active: boolean;
}

export function segAnzeige(item: CollapsibleSegItem, value: string): SegAnzeige {
  const aktiverUnterpunkt =
    (item.unterpunkte ?? []).find(u => u.label === value && u.label !== item.label) ?? null;
  return {
    aktiverUnterpunkt,
    gezeigt: aktiverUnterpunkt ?? item,
    active: value === item.label || aktiverUnterpunkt !== null,
  };
}

/** Trägt das Segment (oder einer seiner Unterpunkte) den gewählten Wert? */
function istGewaehlt(item: CollapsibleSegItem, value: string): boolean {
  return item.label === value || (item.unterpunkte ?? []).some(u => u.label === value);
}

/**
 * Die Segmente, die in DIESER Sicht überhaupt etwas liefern.
 *
 * Ein Segment mit Zähler 0 ist ein Klick in eine garantiert leere Liste. In der
 * Antragsphase sind das dauerhaft drei von fünf Status-Segmenten — „Bewilligt",
 * „Begleitung" und „Beendet" können dort nicht vorkommen, weil der Reiter selbst
 * schon nach Status schneidet. Sie standen trotzdem da und lasen sich wie ein
 * Widerspruch zum Reiter darüber.
 *
 * Drei Ausnahmen, jede aus demselben Grund — es muss einen Rückweg geben:
 * - **Das erste Segment bleibt immer.** Es ist der „Alle"-Anker; ohne ihn käme
 *   man aus einer Auswahl nicht mehr heraus.
 * - **Das gewählte Segment bleibt**, auch wenn es gerade 0 liefert. Sonst
 *   verschwände die eigene Auswahl aus der Leiste, während sie weiter filtert.
 * - **Segmente ohne Zähler bleiben** — sie machen keine Mengenaussage
 *   (z.B. „Mehrere" in der Schnellzugriff-Leiste), also kann 0 sie nicht meinen.
 *
 * Die Zählbasis ist die Sicht (`countBase`, ohne die Leisten-Filter), damit ein
 * Segment nicht bei jedem eigenen Klick verschwindet und wiederkommt.
 */
export function sichtbareSegmente(
  items: readonly CollapsibleSegItem[], value: string,
): CollapsibleSegItem[] {
  return items
    .filter((it, i) => i === 0 || it.count === undefined || it.count > 0 || istGewaehlt(it, value))
    .map(it => {
      if (!it.unterpunkte) return it;
      // Unterpunkte nach derselben Regel, aber ohne Anker: der Oberpunkt steht
      // im Menü selbst noch einmal und ist der Rückweg.
      const unter = it.unterpunkte.filter(
        u => u.count === undefined || u.count > 0 || u.label === value || u.label === it.label,
      );
      // Bleibt nur der Oberpunkt übrig, ist das Menü eine leere Geste.
      if (unter.length <= 1) {
        const { unterpunkte: _weg, ...ohne } = it;
        return ohne;
      }
      return { ...it, unterpunkte: unter };
    });
}
