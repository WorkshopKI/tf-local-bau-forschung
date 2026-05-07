/**
 * Phasen-Gruppierung für den Status-Filter.
 *
 * Die 30 Status-Labels stammen aus dem Forschungsförderungs-Domänenmodell
 * (Design-Handoff `_design/handoff/filter-sidebar/README.md`). Reihenfolge
 * innerhalb einer Phase und Reihenfolge der Phasen sind designvorgegeben —
 * nicht alphabetisch sortieren.
 *
 * Unbekannte Runtime-Werte (z.B. snake_case-Seeds wie `genehmigt`/`in_pruefung`)
 * landen via `getPhaseForStatus()` in der Phase `sonstige`.
 */

export type PhaseId =
  | 'eingang'
  | 'pruefung'
  | 'entscheidung'
  | 'nachforderung'
  | 'abgeschlossen'
  | 'sonstige';

export interface StatusItem {
  /** Roher Status-Wert wie im CSV-Import (case-sensitive). */
  value: string;
}

export interface PhaseGroup {
  id: PhaseId;
  label: string;
  items: StatusItem[];
}

export const STATUS_GROUPS: readonly PhaseGroup[] = [
  {
    id: 'eingang',
    label: 'Eingang',
    items: [
      { value: 'beantragt' },
      { value: 'bearbeitungsreif' },
      { value: 'NL eingegangen' },
    ],
  },
  {
    id: 'pruefung',
    label: 'Prüfung',
    items: [
      { value: 'VN geprüft' },
      { value: 'VN techn. geprüft' },
      { value: 'techn geprüft' },
      { value: 'kaufm geprüft' },
      { value: 'Gutachten fertig' },
    ],
  },
  {
    id: 'entscheidung',
    label: 'Entscheidung',
    items: [
      { value: 'bewilligt' },
      { value: 'bewilligungsreif' },
      { value: 'Bewilligungsentwurf VDI/VDE-IT' },
      { value: 'ablehnungsreif' },
      { value: 'Ablehnung' },
      { value: 'Widerruf' },
      { value: 'Anhörung zum Widerruf' },
      { value: 'Rücknahmeempfehlung' },
      { value: 'Stellungnahme zur Rücknahmeempf.' },
      { value: 'Widerspruch zur Ablehnung' },
    ],
  },
  {
    id: 'nachforderung',
    label: 'Nachforderung',
    items: [
      { value: 'NF gestellt' },
      { value: 'keine weiteren NF' },
    ],
  },
  {
    id: 'abgeschlossen',
    label: 'Abgeschlossen',
    items: [
      { value: 'Schlussvermerk' },
      { value: 'beendet' },
      { value: 'abgelehnt/zurückgezogen' },
      { value: 'abgebrochen' },
    ],
  },
  {
    id: 'sonstige',
    label: 'Sonstige',
    items: [
      { value: 'Irrläufer' },
      { value: 'unvollständig' },
    ],
  },
];

/** Lookup-Map: lowercased value → phase id. Wird einmalig initialisiert. */
const VALUE_TO_PHASE: ReadonlyMap<string, PhaseId> = (() => {
  const m = new Map<string, PhaseId>();
  for (const phase of STATUS_GROUPS) {
    for (const item of phase.items) {
      m.set(item.value.toLowerCase(), phase.id);
    }
  }
  return m;
})();

/** Mappt rohen Status-Wert auf eine Phase. Unbekannt → 'sonstige'. */
export function getPhaseForStatus(raw: string): PhaseId {
  return VALUE_TO_PHASE.get(raw.toLowerCase()) ?? 'sonstige';
}

export interface GroupedItem {
  /** Roher Status-Wert (case wie im Design oder im CSV-Import). */
  value: string;
  /** Anzahl Anträge mit diesem Status (post-Filter, exklusive aktiver Status-Selektion). */
  count: number;
  /** True wenn der Wert aus dem Design stammt (auch bei count=0 anzeigen). */
  designed: boolean;
}

export interface GroupedPhase {
  id: PhaseId;
  label: string;
  items: GroupedItem[];
}

/**
 * Bin alle Runtime-Werte (Keys der Counts-Map) in Phasen.
 *
 * Verhalten:
 * - Design-bekannte Status-Labels einer Phase erscheinen IMMER als Item, auch
 *   wenn `counts.get(value) === 0` (Orientierung für den Kurator).
 * - Zusätzliche Runtime-only-Werte (z.B. `genehmigt` aus den Seeds) erscheinen
 *   in der Phase `sonstige` mit `designed=false`.
 * - Reihenfolge: zuerst die design-vorgegebenen Items in Design-Reihenfolge,
 *   dann die Runtime-only-Items alphabetisch sortiert (nur in `sonstige`).
 */
export function groupStatusValues(counts: Map<string, number>): GroupedPhase[] {
  const result: GroupedPhase[] = STATUS_GROUPS.map(p => ({
    id: p.id,
    label: p.label,
    items: p.items.map(it => ({
      value: it.value,
      count: counts.get(it.value) ?? 0,
      designed: true,
    })),
  }));

  const knownLower = new Set(VALUE_TO_PHASE.keys());
  const extras: GroupedItem[] = [];
  for (const [value, count] of counts) {
    if (!value || value === '(leer)') continue;
    if (knownLower.has(value.toLowerCase())) continue;
    extras.push({ value, count, designed: false });
  }
  if (extras.length > 0) {
    extras.sort((a, b) => a.value.localeCompare(b.value, 'de'));
    const sonstige = result.find(p => p.id === 'sonstige');
    if (sonstige) sonstige.items.push(...extras);
  }
  return result;
}
