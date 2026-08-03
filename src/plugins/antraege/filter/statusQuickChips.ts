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

/** Status-Werte (lowercase) die zu einem Chip gehören. Statisch — cached über
 *  die Modul-Lebenszeit. */
const CHIP_VALUES: Record<StatusQuickChipId, ReadonlySet<string>> = (() => {
  const out: Partial<Record<StatusQuickChipId, ReadonlySet<string>>> = {};
  for (const chip of STATUS_QUICK_CHIPS) {
    const values = new Set<string>();
    for (const cat of chip.categories) {
      for (const v of getStatusValuesByCategory(cat)) values.add(v);
    }
    out[chip.id] = values;
  }
  return out as Record<StatusQuickChipId, ReadonlySet<string>>;
})();

/** Liefert die normalisierten Status-Werte für einen Chip. */
export function chipStatusValues(chipId: StatusQuickChipId): ReadonlySet<string> {
  return CHIP_VALUES[chipId];
}
