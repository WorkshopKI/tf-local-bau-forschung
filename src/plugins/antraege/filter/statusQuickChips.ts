/**
 * Die Bucket-Definition der Status-Pille: welche Status-Kategorien unter
 * welcher Beschriftung zusammengefasst werden. Einzelquelle für den Zähler
 * UND den Filterwert der Pille (`phaseQuickfilter.ts`) — genau diese
 * Deckungsgleichheit macht die Zahl an der Pille zur Zeilenzahl, die ihr Klick
 * liefert.
 *
 * 5 Buckets fassen die 8 sinnvollen Status-Kategorien zusammen:
 *
 * | Chip            | Kategorien                                |
 * |-----------------|-------------------------------------------|
 * | Offen           | offen, in_pruefung, entscheidung          |
 * | Nachforderung   | nachforderung                             |
 * | Bewilligt       | bewilligt                                 |
 * | Begleitung      | begleitung                                |
 * | Abgeschlossen   | abgeschlossen, abgelehnt                  |
 *
 * Die `sonstige`-Kategorie (Irrläufer/unvollständig) ist KEINEM Chip
 * zugeordnet: sie ist über „Alle" und über die Sidebar erreichbar, hängt sich
 * aber an keinen Bucket an. Früher tat sie das — und war damit im
 * Filterwert, ohne im Zähler zu sein.
 *
 * Die Toggle-Helfer des Multi-Toggle-Vorgängers (`deriveChipState`,
 * `computeFilterValue`, `soloChipState`) sind entfallen: die Pille
 * ist seit dem Akkordeon-Umbau Single-Select, und `computeFilterValue` trug
 * denselben `sonstige`-Anhang wie der behobene Fehler.
 */
import {
  getStatusValuesByCategory,
  type StatusCategory,
} from '@/core/utils/status-canonical';

export const STATUS_QUICK_CHIPS = [
  { id: 'offen', label: 'Offen', categories: ['offen', 'in_pruefung', 'entscheidung'] as StatusCategory[] },
  { id: 'nachforderung', label: 'Nachforderung', categories: ['nachforderung'] as StatusCategory[] },
  { id: 'bewilligt', label: 'Bewilligt', categories: ['bewilligt'] as StatusCategory[] },
  { id: 'begleitung', label: 'Begleitung', categories: ['begleitung'] as StatusCategory[] },
  { id: 'abgeschlossen', label: 'Abgeschlossen', categories: ['abgeschlossen', 'abgelehnt'] as StatusCategory[] },
] as const;

export type StatusQuickChipId = (typeof STATUS_QUICK_CHIPS)[number]['id'];

/**
 * Die Status-Werte eines Chips — abgeleitet bei jedem Aufruf, nicht gecacht.
 *
 * Die Menge hing bis v2.403 an einer Modul-Konstante, die beim Import lief —
 * also BEVOR `setStatusKatalogSnapshot` den kuratierten Katalog setzt. Die
 * Pille rechnete deshalb dauerhaft mit dem eingebauten Code-Seed, der Rest der
 * App mit dem Katalog; im echten Bestand gingen die beiden um 15 Anträge
 * auseinander. Wer das Ergebnis in einer Schleife braucht, hebt es heraus
 * (siehe `getPhaseItems`).
 */
export function chipStatusValues(chipId: StatusQuickChipId): ReadonlySet<string> {
  const werte = new Set<string>();
  const chip = STATUS_QUICK_CHIPS.find(c => c.id === chipId);
  if (!chip) return werte;
  for (const cat of chip.categories) {
    for (const v of getStatusValuesByCategory(cat)) werte.add(v);
  }
  return werte;
}
