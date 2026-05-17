/**
 * Phase-Quickfilter: Single-Select-Wrapper um den `system-status`-Filter.
 *
 * Die 5 Phasen (Offen / Nachforderung / Bewilligt / Begleitung / Abgeschlossen)
 * decken die fachlich sinnvollen Status-Buckets aus `status-canonical.ts` ab.
 * Reuse: die Bucket-Definitionen + Status-Werte-Mapping kommen aus
 * `statusQuickChips.ts` (`STATUS_QUICK_CHIPS` + `chipStatusValues`) — damit ist
 * die Phase-Definition single-source-of-truth über beide Filter-Komponenten
 * hinweg.
 *
 * Verhalten:
 * - "Alle" → `system-status`-Filter wird gelöscht (`clearFilter`)
 * - Phase-Bucket → schreibt alle Status-Werte des Buckets + alle `sonstige`-
 *   Werte als Filter-Value (damit Irrläufer/unvollständige nicht versehentlich
 *   ausgeblendet werden — gleiche Regel wie im alten Multi-Toggle).
 *
 * Counts kommen über die gesamte Liste, nicht über die aktuell gefilterte
 * Teilmenge — Design-Vorgabe: Stabilität wichtiger als „akkurate Restanzahl
 * bei kombinierten Filtern" (siehe Handoff README, Abschnitt „Toolbar").
 */
import type { ActiveFilter } from '@/core/services/csv';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusValuesByCategory } from '@/core/utils/status-canonical';
import { STATUS_QUICK_CHIPS, chipStatusValues, type StatusQuickChipId } from './statusQuickChips';
import type { CollapsibleSegItem } from './CollapsibleSeg';

export const STATUS_FILTER_ID = 'system-status';

export type PhaseLabel = 'Alle' | 'Offen' | 'Nachforderung' | 'Bewilligt' | 'Begleitung' | 'Abgeschlossen';

const PHASE_LABEL_BY_CHIP_ID: Record<StatusQuickChipId, PhaseLabel> = {
  offen: 'Offen',
  nachforderung: 'Nachforderung',
  bewilligt: 'Bewilligt',
  begleitung: 'Begleitung',
  abgeschlossen: 'Abgeschlossen',
};

const SONSTIGE_VALUES: ReadonlySet<string> = new Set(getStatusValuesByCategory('sonstige'));

/** Wandelt einen Phase-Label-String in die zugehörige Chip-ID, oder null
 *  (für 'Alle' oder unbekannt). */
function chipIdForPhase(phase: PhaseLabel): StatusQuickChipId | null {
  for (const [chipId, label] of Object.entries(PHASE_LABEL_BY_CHIP_ID)) {
    if (label === phase) return chipId as StatusQuickChipId;
  }
  return null;
}

/** Status-Werte (lowercase) für eine Phase + die `sonstige`-Werte, damit
 *  Irrläufer nicht ausgeblendet werden. */
function statusValuesForPhase(phase: PhaseLabel): string[] {
  const chipId = chipIdForPhase(phase);
  if (chipId === null) return [];
  const out = new Set<string>([...chipStatusValues(chipId)]);
  for (const v of SONSTIGE_VALUES) out.add(v);
  return [...out].sort();
}

/** Liest die aktuelle Phase aus dem aktiven Filter-Set. Wenn der Filter nicht
 *  exakt einem Phase-Bucket entspricht (z.B. weil der User in der Sidebar
 *  manuell Status-Werte gemischt hat), wird 'Alle' returned — der Quickfilter
 *  zeigt dann seinen Default-Zustand. Die Sidebar bleibt davon unberührt. */
export function getPhaseFromActive(active: ActiveFilter[]): PhaseLabel {
  const entry = active.find(a => a.filterId === STATUS_FILTER_ID);
  if (!entry) return 'Alle';
  if (!Array.isArray(entry.value)) return 'Alle';
  const activeSet = new Set<string>();
  for (const v of entry.value) {
    if (typeof v === 'string') activeSet.add(v.toLowerCase().trim());
  }
  for (const chip of STATUS_QUICK_CHIPS) {
    const expected = new Set<string>([...chipStatusValues(chip.id)]);
    for (const v of SONSTIGE_VALUES) expected.add(v);
    if (setsEqual(activeSet, expected)) {
      return PHASE_LABEL_BY_CHIP_ID[chip.id];
    }
  }
  return 'Alle';
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Liefert die Items für `CollapsibleSeg`: Alle + 5 Phasen, jeweils mit Count
 *  über die gesamte Antrags-Liste (vor allen Filtern). */
export function getPhaseItems(antraege: AntragListItem[]): CollapsibleSegItem[] {
  const counts: Record<PhaseLabel, number> = {
    Alle: antraege.length,
    Offen: 0,
    Nachforderung: 0,
    Bewilligt: 0,
    Begleitung: 0,
    Abgeschlossen: 0,
  };
  for (const a of antraege) {
    const s = typeof a.status === 'string' ? a.status.toLowerCase().trim() : '';
    if (!s) continue;
    for (const chip of STATUS_QUICK_CHIPS) {
      if (chipStatusValues(chip.id).has(s)) {
        counts[PHASE_LABEL_BY_CHIP_ID[chip.id]]++;
        break;
      }
    }
  }
  return [
    { label: 'Alle', count: counts.Alle },
    { label: 'Offen', count: counts.Offen },
    { label: 'Nachforderung', count: counts.Nachforderung },
    { label: 'Bewilligt', count: counts.Bewilligt },
    { label: 'Begleitung', count: counts.Begleitung },
    { label: 'Abgeschlossen', count: counts.Abgeschlossen },
  ];
}

/** Wendet die User-Auswahl auf den Filter-State an. `applyFn`-Callbacks werden
 *  aus dem Caller aus `useFilterState` bereitgestellt, damit dieses Modul
 *  keinen Store-Import braucht (testbar mit Mocks). */
export function applyPhase(
  phase: PhaseLabel,
  setActiveValue: (filterId: string, value: string[]) => void,
  clearFilter: (filterId: string) => void,
): void {
  if (phase === 'Alle') {
    clearFilter(STATUS_FILTER_ID);
    return;
  }
  const values = statusValuesForPhase(phase);
  if (values.length === 0) {
    clearFilter(STATUS_FILTER_ID);
    return;
  }
  setActiveValue(STATUS_FILTER_ID, values);
}
