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
