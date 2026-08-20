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
import {
  STATUS_QUICK_CHIPS, chipStatusValues, chipLabel, chipLabelKurz, type StatusQuickChipId,
} from './statusQuickChips';
import type { CollapsibleSegItem } from './CollapsibleSeg';

export const STATUS_FILTER_ID = 'system-status';

/**
 * Die Pille arbeitet mit dem Anzeige-Label als Wert — so verlangt es
 * `CollapsibleSeg`. Das ist hier unbedenklich: die Auswahl ist **transient**,
 * persistiert wird der Filter über seine Status-WERTE
 * (`activeFilterPersistence`), nicht über diesen String. Deshalb ist ein
 * umbenanntes Label kein Migrationsfall — anders als bei den Abschnitts-Ids in
 * `antragGroups.ts`, die genau deshalb umgestellt wurden.
 */
export type PhaseLabel = string;

export const ALLE_LABEL = 'Alle';

/**
 * Beschriftung für einen Status-Filter, den die Pille nicht ausdrücken kann —
 * gesetzt in der Filterleiste, wo man einzelne Zustände frei kombiniert.
 *
 * Bis v4.65 fiel die Pille in diesem Fall auf `Alle` zurück und behauptete
 * damit das Gegenteil dessen, was die Liste zeigte: sie war gefiltert, die
 * Pille sagte „Alle 38". Die Schnellzugriff-Leiste löst dasselbe Problem seit
 * Längerem mit „Mehrere" — dieselbe Idee, dieselbe Regel: **ein Klick darauf
 * ist wirkungslos**, denn die Auswahl beschreibt sich selbst, sie ist keine
 * Wahl, die man treffen könnte.
 */
export const EIGENE_AUSWAHL_LABEL = 'Eigene Auswahl';

/**
 * Kurzform je Bucket — Label und Zähler müssen zusammen in eine Zeile, sonst
 * bricht die Toolbar um, sobald die Pille mit Zahlen wie `10.845` aufklappt.
 * Abgeleitet aus der Einzelquelle, nicht als eigene Tabelle geführt (v2.409).
 */
function phaseLabelVon(id: StatusQuickChipId): string {
  return chipLabelKurz(id);
}

/** Die `sonstige`-Werte — nur noch, um einen früher gespeicherten Filter-Wert
 *  wiederzuerkennen (siehe `getPhaseFromActive`).
 *
 *  Wird bei jedem Aufruf abgeleitet, nicht als Modul-Konstante gehalten: eine
 *  solche entsteht beim Import, also bevor der kuratierte Katalog als Snapshot
 *  gesetzt ist, und bliebe dann für immer auf dem eingebauten Seed stehen.
 *  `getPhaseFromActive` läuft je Interaktion, nicht je Datensatz — die
 *  Ableitung ist hier billig. */
function sonstigeWerte(): ReadonlySet<string> {
  return new Set(getStatusValuesByCategory('sonstige'));
}

/** Wandelt einen Phase-Label-String in die zugehörige Chip-ID, oder null
 *  (für 'Alle' oder unbekannt). */
function chipIdForPhase(phase: PhaseLabel): StatusQuickChipId | null {
  return STATUS_QUICK_CHIPS.find(c => phaseLabelVon(c.id) === phase)?.id ?? null;
}

/** Status-Werte einer Phase — dieselbe Menge, über die `getPhaseItems` zählt. */
function statusValuesForPhase(phase: PhaseLabel): string[] {
  const chipId = chipIdForPhase(phase);
  if (chipId === null) return [];
  return [...chipStatusValues(chipId)].sort();
}

/** Liest die aktuelle Phase aus dem aktiven Filter-Set. Wenn der Filter nicht
 *  exakt einem Phase-Bucket entspricht (z.B. weil der User in der Sidebar
 *  manuell Status-Werte gemischt hat), wird `EIGENE_AUSWAHL_LABEL` returned —
 *  die Pille sagt dann, dass hier etwas gilt, das sie nicht in einem ihrer
 *  Segmente ausdrücken kann. Die Sidebar bleibt davon unberührt.
 *
 *  Der frühere Wertesatz (Bucket + `sonstige`) zählt weiter als Treffer:
 *  die aktiven Filter überleben den Reload (`activeFilterPersistence.ts`), und
 *  eine restaurierte Auswahl darf nach dem Update nicht als „Alle" erscheinen,
 *  während die Liste gefiltert ist. */
export function getPhaseFromActive(active: ActiveFilter[]): PhaseLabel {
  const entry = active.find(a => a.filterId === STATUS_FILTER_ID);
  if (!entry) return ALLE_LABEL;
  // Ein Nicht-Array im Status-Slot ist kein Bucket, aber auch nicht „nichts" —
  // es filtert, also darf hier nicht `Alle` stehen.
  if (!Array.isArray(entry.value)) return EIGENE_AUSWAHL_LABEL;
  const activeSet = new Set<string>();
  for (const v of entry.value) {
    if (typeof v === 'string') activeSet.add(v.toLowerCase().trim());
  }
  const sonstige = sonstigeWerte();
  for (const chip of STATUS_QUICK_CHIPS) {
    const werte = chipStatusValues(chip.id);
    const mitSonstige = new Set<string>([...werte, ...sonstige]);
    if (setsEqual(activeSet, werte) || setsEqual(activeSet, mitSonstige)) {
      return phaseLabelVon(chip.id);
    }
  }
  // Leeres Werte-Array = ein Slot ohne Wirkung; das ist tatsächlich „Alle".
  return activeSet.size === 0 ? ALLE_LABEL : EIGENE_AUSWAHL_LABEL;
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
export function getPhaseItems(
  antraege: AntragListItem[], aktuellePhase: PhaseLabel = ALLE_LABEL,
): CollapsibleSegItem[] {
  // Einmal vor der Schleife: `chipStatusValues` leitet seit dem Wegfall der
  // Modul-Konstante bei jedem Aufruf aus dem aktiven Katalog ab.
  const buckets = STATUS_QUICK_CHIPS.map(chip => ({
    label: phaseLabelVon(chip.id),
    voll: chipLabel(chip.id),
    werte: chipStatusValues(chip.id),
    count: 0,
  }));
  for (const a of antraege) {
    const s = typeof a.status === 'string' ? a.status.toLowerCase().trim() : '';
    if (!s) continue;
    for (const b of buckets) {
      if (b.werte.has(s)) {
        b.count++;
        break;
      }
    }
  }
  return [
    { label: ALLE_LABEL, count: antraege.length },
    // Die Kurzform steht in der Leiste, der volle Name im Tooltip — sonst
    // müsste man „Nachforderung" ohne Zusatz raten.
    ...buckets.map(b => ({ label: b.label, count: b.count, title: b.voll })),
    // Nur wenn er gerade gilt: ein Segment, das man nicht wählen kann, wäre
    // sonst dauerhaft ein toter Knopf. Ohne Zähler — was die Leiste gesetzt hat,
    // zählt die Pille nicht nach (das täte sie auf einer anderen Basis).
    ...(aktuellePhase === EIGENE_AUSWAHL_LABEL
      ? [{ label: EIGENE_AUSWAHL_LABEL, title: 'In der Filterleiste gesetzt — dort auch wieder aufzuheben' }]
      : []),
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
  // „Eigene Auswahl" ist eine Auskunft, keine Wahl — ein Klick darauf darf die
  // Auswahl nicht leeren, die er gerade beschreibt (wie `MEHRERE` in PinLeiste).
  if (phase === EIGENE_AUSWAHL_LABEL) return;
  if (phase === ALLE_LABEL) {
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
