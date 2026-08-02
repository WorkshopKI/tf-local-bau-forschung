/**
 * Gruppierung des Status-Filters — **nach ZAH-Phasen, auf Code-Ebene**.
 *
 * Bis v2.383 stand hier eine dritte Achse: eine handgeschriebene Liste von 24
 * Roh-Labels aus einem Design-Handoff, entkoppelt vom Katalog. Sie lief
 * auseinander, wo es zählt — `NF gestellt` unter „Nachforderung", im Katalog
 * unter „Vollständigkeit"; `bewilligt` unter „Entscheidung", im Katalog unter
 * „Begleitung"; und jede amtliche Schreibweise, die der Handoff nicht kannte,
 * fiel in „Sonstige". Jetzt gilt dieselbe Achse wie in Cockpit, Stepper und
 * Erklärung, und ein Umhängen durch die PL wirkt hier mit.
 *
 * **Ein Eintrag je Code, nicht je Schreibweise.** Der Export liefert denselben
 * Status mal ausgeschrieben, mal abgekürzt („Stellungnahme zur
 * Rücknahmeempfehlung" / „…Rücknahmeempf."). Als zwei Filter-Zeilen mit je
 * eigener Zahl wäre das für die Nutzerin eine Fehlinformation — es sind
 * Schreibweisen eines Status. Sie kollabieren auf einen Eintrag mit
 * **Summen-Zählung**; gefiltert wird über alle Schreibweisen.
 *
 * **Marker sind eine eigene Gruppe** (29 Irrläufer, 88 Sonderstatus, 93/94
 * Partner): sie laufen neben dem Verfahren, nicht darin. „Sonstige" enthält
 * danach nur noch echte Katalog-Fremde — und wird damit zur Kuratier-Anzeige
 * statt zum Sammelbecken.
 */
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';
import {
  ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL, ZAH_MARKER_LABEL, SEED_CODE_ZU_ZAH_PHASE,
  SEED_MARKER_CODES,
} from '@/core/status/zah-phasen';
import { codeFuerStatusText } from '@/core/status/kategorie-ableitung';
import type { ZahPhaseId } from '@/core/status/typen';

/** Gruppen-Id: eine ZAH-Phase, die Marker-Gruppe oder der Rest. */
export type PhaseId = ZahPhaseId | 'marker' | 'sonstige';

export interface StatusItem {
  /** Anzeige-Schreibweise (amtlicher Text bzw. der Roh-Wert bei Katalog-Fremden). */
  value: string;
  /** Alle Schreibweisen, die auf denselben Eintrag filtern (inkl. `value`). */
  schreibweisen: readonly string[];
}

export interface PhaseGroup {
  id: PhaseId;
  label: string;
  items: StatusItem[];
}

const GRUPPEN_LABEL: Record<PhaseId, string> = {
  ...ZAH_PHASE_LABEL,
  marker: ZAH_MARKER_LABEL,
  sonstige: 'Nicht im Katalog',
};

/** Gruppen-Reihenfolge: Verfahren zuerst, danach was danebensteht. */
const GRUPPEN_REIHENFOLGE: readonly PhaseId[] = [...ZAH_PHASEN_REIHENFOLGE, 'marker', 'sonstige'];

/** Zu welcher Gruppe ein Code gehört. */
function gruppeFuerCode(code: number): PhaseId {
  if (SEED_MARKER_CODES.has(code)) return 'marker';
  return SEED_CODE_ZU_ZAH_PHASE.get(code) ?? 'marker';
}

/**
 * Die Gruppen aus dem Code-Katalog — ein Eintrag je Code, in Code-Reihenfolge.
 * Das ist die Orientierung für den Kurator: sie steht auch, wenn im Bestand
 * gerade kein Vorgang darauf liegt.
 */
export const STATUS_GROUPS: readonly PhaseGroup[] = (() => {
  const proGruppe = new Map<PhaseId, StatusItem[]>(GRUPPEN_REIHENFOLGE.map(id => [id, []]));
  for (const e of STATUS_CODE_KATALOG) {
    proGruppe.get(gruppeFuerCode(e.code))!.push({
      value: e.text,
      schreibweisen: [e.text, ...e.varianten],
    });
  }
  return GRUPPEN_REIHENFOLGE.map(id => ({
    id, label: GRUPPEN_LABEL[id], items: proGruppe.get(id) ?? [],
  }));
})();

/** Lookup: normalisierte Schreibweise → Anzeige-Wert des Eintrags. */
const SCHREIBWEISE_ZU_WERT: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of STATUS_GROUPS) {
    for (const it of g.items) {
      for (const s of it.schreibweisen) m.set(s.toLowerCase().trim(), it.value);
    }
  }
  return m;
})();

/** Mappt einen rohen Status-Wert auf seine Gruppe. Unbekannt → `sonstige`. */
export function getPhaseForStatus(raw: string): PhaseId {
  const code = codeFuerStatusText(raw);
  return code === null ? 'sonstige' : gruppeFuerCode(code);
}

/** Deutsches Label einer Gruppe. */
export function getPhaseLabel(id: PhaseId): string {
  return GRUPPEN_LABEL[id] ?? id;
}

export interface GroupedItem {
  /** Anzeige-Schreibweise. */
  value: string;
  /** Summe über alle Schreibweisen dieses Codes (post-Filter). */
  count: number;
  /** True, wenn der Wert aus dem Code-Katalog stammt (auch bei count = 0 zeigen). */
  designed: boolean;
  /** Womit gefiltert wird — alle bekannten Schreibweisen. */
  schreibweisen: readonly string[];
}

export interface GroupedPhase {
  id: PhaseId;
  label: string;
  items: GroupedItem[];
}

/**
 * Bin die Runtime-Werte (Keys der Counts-Map) in Gruppen.
 *
 * - Katalog-Codes erscheinen IMMER als Eintrag, auch mit `count: 0` — als
 *   Orientierung, welche Zustände es überhaupt gibt.
 * - Zählungen summieren über alle Schreibweisen eines Codes.
 * - Werte, die der Katalog nicht kennt, landen in `sonstige` mit
 *   `designed: false`. Das ist der Hinweis „im Export gesehen, nicht im Katalog"
 *   — und im Idealfall ist die Gruppe leer.
 */
export function groupStatusValues(counts: Map<string, number>): GroupedPhase[] {
  const summen = new Map<string, number>();
  const fremde: GroupedItem[] = [];
  for (const [value, count] of counts) {
    if (!value || value === '(leer)') continue;
    const eintrag = SCHREIBWEISE_ZU_WERT.get(value.toLowerCase().trim());
    if (eintrag === undefined) {
      fremde.push({ value, count, designed: false, schreibweisen: [value] });
      continue;
    }
    summen.set(eintrag, (summen.get(eintrag) ?? 0) + count);
  }

  const result: GroupedPhase[] = STATUS_GROUPS.map(g => ({
    id: g.id,
    label: g.label,
    items: g.items.map(it => ({
      value: it.value,
      count: summen.get(it.value) ?? 0,
      designed: true,
      schreibweisen: it.schreibweisen,
    })),
  }));

  if (fremde.length > 0) {
    fremde.sort((a, b) => a.value.localeCompare(b.value, 'de'));
    const sonstige = result.find(p => p.id === 'sonstige');
    if (sonstige) sonstige.items.push(...fremde);
  }
  return result;
}
