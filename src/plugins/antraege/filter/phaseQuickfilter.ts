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
 * - Phase-Bucket → schreibt **genau** die Status-Werte des Buckets als
 *   Filter-Value.
 *
 * **Die Zahl an der Pille ist die Zeilenzahl, die ihr Klick liefert.** Zählung
 * (`getPhaseItems`) und Filter (`applyPhase`) speisen sich aus derselben Menge
 * `chipStatusValues(chip)`; die Engine vergleicht schreibungs-tolerant. Früher
 * hängte `applyPhase` zusätzlich alle `sonstige`-Werte an — Werte, die die
 * Pille nicht mitzählte. Das Motiv (Irrläufer nicht verstecken) trägt bereits
 * der implizite `vb_phase = 9`-Vorfilter in `useFilteredAntraege`; wer
 * „Bewilligt" wählt, will keine katalogfremden Sätze sehen.
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

// Kurz-Labels für die Filter-Pille — verhindern Umbruch der Toolbar wenn die
// Phase-CollapsibleSeg mit Counts wie `Abgeschl. 10.845` aufgeklappt wird.
// Die Status-Gruppierungs-Section-Header (antragGroups.ts → StatusPhaseLabel)
// nutzen weiterhin die vollen Namen.
export type PhaseLabel = 'Alle' | 'Offen' | 'NF' | 'Bewilligt' | 'Begleitung' | 'Abgeschl.';

const PHASE_LABEL_BY_CHIP_ID: Record<StatusQuickChipId, PhaseLabel> = {
  offen: 'Offen',
  nachforderung: 'NF',
  bewilligt: 'Bewilligt',
  begleitung: 'Begleitung',
  abgeschlossen: 'Abgeschl.',
};

/** Die `sonstige`-Werte — nur noch, um einen früher gespeicherten Filter-Wert
 *  wiederzuerkennen (siehe `getPhaseFromActive`). */
const SONSTIGE_VALUES: ReadonlySet<string> = new Set(getStatusValuesByCategory('sonstige'));

/** Wandelt einen Phase-Label-String in die zugehörige Chip-ID, oder null
 *  (für 'Alle' oder unbekannt). */
function chipIdForPhase(phase: PhaseLabel): StatusQuickChipId | null {
  for (const [chipId, label] of Object.entries(PHASE_LABEL_BY_CHIP_ID)) {
    if (label === phase) return chipId as StatusQuickChipId;
  }
  return null;
}

/** Status-Werte einer Phase — dieselbe Menge, über die `getPhaseItems` zählt. */
function statusValuesForPhase(phase: PhaseLabel): string[] {
  const chipId = chipIdForPhase(phase);
  if (chipId === null) return [];
  return [...chipStatusValues(chipId)].sort();
}

/** Liest die aktuelle Phase aus dem aktiven Filter-Set. Wenn der Filter nicht
 *  exakt einem Phase-Bucket entspricht (z.B. weil der User in der Sidebar
 *  manuell Status-Werte gemischt hat), wird 'Alle' returned — der Quickfilter
 *  zeigt dann seinen Default-Zustand. Die Sidebar bleibt davon unberührt.
 *
 *  Der frühere Wertesatz (Bucket + `sonstige`) zählt weiter als Treffer:
 *  die aktiven Filter überleben den Reload (`activeFilterPersistence.ts`), und
 *  eine restaurierte Auswahl darf nach dem Update nicht als „Alle" erscheinen,
 *  während die Liste gefiltert ist. */
export function getPhaseFromActive(active: ActiveFilter[]): PhaseLabel {
  const entry = active.find(a => a.filterId === STATUS_FILTER_ID);
  if (!entry) return 'Alle';
  if (!Array.isArray(entry.value)) return 'Alle';
  const activeSet = new Set<string>();
  for (const v of entry.value) {
    if (typeof v === 'string') activeSet.add(v.toLowerCase().trim());
  }
  for (const chip of STATUS_QUICK_CHIPS) {
    const werte = chipStatusValues(chip.id);
    const mitSonstige = new Set<string>([...werte, ...SONSTIGE_VALUES]);
    if (setsEqual(activeSet, werte) || setsEqual(activeSet, mitSonstige)) {
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
 *  über die übergebene Sicht (`countBase` — vor den Sidebar-Filtern).
 *
 *  Zählt über `chipStatusValues`, also über **exakt** die Menge, die
 *  `applyPhase` in den Filter schreibt. Diese Deckungsgleichheit ist die
 *  Invariante der Pille; `phaseQuickfilter.test.ts` hält sie fest. */
export function getPhaseItems(antraege: AntragListItem[]): CollapsibleSegItem[] {
  const counts: Record<PhaseLabel, number> = {
    'Alle': antraege.length,
    'Offen': 0,
    'NF': 0,
    'Bewilligt': 0,
    'Begleitung': 0,
    'Abgeschl.': 0,
  };
  // Einmal vor der Schleife: `chipStatusValues` leitet seit dem Wegfall der
  // Modul-Konstante bei jedem Aufruf aus dem aktiven Katalog ab.
  const buckets = STATUS_QUICK_CHIPS.map(chip => ({
    label: PHASE_LABEL_BY_CHIP_ID[chip.id],
    werte: chipStatusValues(chip.id),
  }));
  for (const a of antraege) {
    const s = typeof a.status === 'string' ? a.status.toLowerCase().trim() : '';
    if (!s) continue;
    for (const b of buckets) {
      if (b.werte.has(s)) {
        counts[b.label]++;
        break;
      }
    }
  }
  return [
    { label: 'Alle', count: counts['Alle'] },
    { label: 'Offen', count: counts['Offen'] },
    { label: 'NF', count: counts['NF'] },
    { label: 'Bewilligt', count: counts['Bewilligt'] },
    { label: 'Begleitung', count: counts['Begleitung'] },
    { label: 'Abgeschl.', count: counts['Abgeschl.'] },
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
