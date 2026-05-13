/**
 * Status-Quickfilter-Chips: kompakte Toggle-Pillen in der Antrags-Toolbar,
 * gekoppelt an den `system-status`-Filter aus der Filter-Sidebar.
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
 * zugeordnet — ihre Status-Werte bleiben immer im aktiven Filter-Set,
 * sodass sie nicht versehentlich ausgeblendet werden.
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
export type ChipState = 'on' | 'off' | 'mixed';

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

/** Status-Werte der `sonstige`-Kategorie (Irrläufer/unvollständig). Werden in
 *  jedem ON-Filter-Wert immer mit eingeschlossen, damit sie nicht ausgeblendet
 *  werden. */
const SONSTIGE_VALUES: ReadonlySet<string> = new Set(getStatusValuesByCategory('sonstige'));

/** Liefert die normalisierten Status-Werte für einen Chip. */
export function chipStatusValues(chipId: StatusQuickChipId): ReadonlySet<string> {
  return CHIP_VALUES[chipId];
}

/**
 * Leitet aus dem aktuellen Status-Filter (Liste der inkludierten Status-Werte)
 * den Chip-Status ab. `activeValues` = null/undefined/leeres Array bedeutet:
 * kein Filter gesetzt → alle Chips `on`.
 *
 * Pro Chip:
 * - `on`  — alle bekannten Werte der Chip-Kategorien sind im Filter
 * - `off` — KEINER der Werte ist im Filter
 * - `mixed` — nur ein Teil der Werte ist im Filter (User hat in Sidebar manuell
 *   Status-Werte gemischt selektiert)
 */
export function deriveChipState(
  activeValues: string[] | null | undefined,
): Record<StatusQuickChipId, ChipState> {
  const out: Partial<Record<StatusQuickChipId, ChipState>> = {};
  // Kein Filter aktiv → alles sichtbar → alle Chips ON.
  if (!activeValues || activeValues.length === 0) {
    for (const chip of STATUS_QUICK_CHIPS) out[chip.id] = 'on';
    return out as Record<StatusQuickChipId, ChipState>;
  }
  const active = new Set(activeValues.map(v => v.toLowerCase().trim()));
  for (const chip of STATUS_QUICK_CHIPS) {
    const values = CHIP_VALUES[chip.id];
    let included = 0;
    for (const v of values) if (active.has(v)) included++;
    if (included === 0) out[chip.id] = 'off';
    else if (included === values.size) out[chip.id] = 'on';
    else out[chip.id] = 'mixed';
  }
  return out as Record<StatusQuickChipId, ChipState>;
}

/**
 * Berechnet den neuen Filter-Wert für `system-status` basierend auf dem
 * gewünschten Chip-Zustand (on/off pro Chip). `mixed` wird wie `on` behandelt
 * (Chip soll aktiv sein → Chip-Werte einschließen).
 *
 * Wenn alle Chips on → `null` (= Filter löschen, alle sichtbar inkl. sonstige).
 * Sonst → Array der enthaltenen Status-Werte + alle `sonstige`-Werte (damit
 * Irrläufer immer mitkommen).
 */
export function computeFilterValue(
  state: Record<StatusQuickChipId, ChipState>,
): string[] | null {
  const onChips = STATUS_QUICK_CHIPS.filter(c => state[c.id] !== 'off');
  if (onChips.length === STATUS_QUICK_CHIPS.length) return null;
  const out = new Set<string>();
  for (const chip of onChips) {
    for (const v of CHIP_VALUES[chip.id]) out.add(v);
  }
  for (const v of SONSTIGE_VALUES) out.add(v);
  return [...out].sort();
}

/**
 * "Solo"-Mode: setzt nur den angegebenen Chip auf `on`, alle anderen `off`.
 * Wird bei Shift-Click oder Doppelklick genutzt — schnell "nur Bewilligte
 * zeigen" ohne 4 einzelne Toggle-Klicks.
 */
export function soloChipState(chipId: StatusQuickChipId): Record<StatusQuickChipId, ChipState> {
  const out: Partial<Record<StatusQuickChipId, ChipState>> = {};
  for (const chip of STATUS_QUICK_CHIPS) {
    out[chip.id] = chip.id === chipId ? 'on' : 'off';
  }
  return out as Record<StatusQuickChipId, ChipState>;
}
