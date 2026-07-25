/**
 * Mappings für die CSV-Standardspalte VB_PHASE (Verbund-Phase, Werte 1–9).
 *
 * Domain-getrennt von Status-Labels (siehe Kommentar in `status-mappings.ts`):
 * VB-Phase beschreibt den Antrags-Typ (Netzwerk-Phase / FuE / DL / DS / Irrläufer),
 * Status den Workflow-Zustand. Beide Mappings landen nebeneinander auf der Card,
 * aber ihre Semantik überschneidet sich nicht.
 *
 * Werte 6–8 sind reserviert; sie werden hier nicht abgebildet und führen zu
 * einem `null`-Label (Badge wird dann nicht gerendert).
 */
import type { BadgeVariant } from './status-mappings';

export const IRRLAEUFER_PHASE = 9;

export const VB_PHASE_LABELS: Record<number, string> = {
  1: 'NW 1',
  2: 'NW 2',
  3: 'FuE',
  4: 'DL',
  5: 'DS',
  9: 'Irrläufer',
};

export const VB_PHASE_VARIANTS: Record<number, BadgeVariant> = {
  1: 'info',
  2: 'info',
  3: 'success',
  4: 'default',
  5: 'default',
  9: 'warning',
};

/**
 * Tolerant gegenüber `number | string | undefined | null`.
 * `AntragListItem.vb_phase` ist als `number` typisiert, aber der Filter-Layer
 * arbeitet mit String-Werten aus den FilterDefinition-Manuelle-Werte, deshalb
 * akzeptieren wir hier beides.
 */
export function toVbPhaseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.length === 0) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function getVbPhaseLabel(raw: unknown): string | null {
  const n = toVbPhaseNumber(raw);
  if (n === null) return null;
  return VB_PHASE_LABELS[n] ?? null;
}

export function getVbPhaseVariant(raw: unknown): BadgeVariant {
  const n = toVbPhaseNumber(raw);
  if (n === null) return 'default';
  return VB_PHASE_VARIANTS[n] ?? 'default';
}

export function isIrrlaeufer(raw: unknown): boolean {
  return toVbPhaseNumber(raw) === IRRLAEUFER_PHASE;
}

/**
 * Fachlicher Antragstyp (ZIM-Kategorie) — die Achse, entlang derer Kapazitäten
 * geplant, Anträge gefiltert und Bearbeitungszeiten ausgewertet werden.
 *
 * Fasst die beiden Netzwerk-Phasen zu einem `NW`-Bucket zusammen; das ist die
 * gröbere Schwester von `VB_PHASE_LABELS` (dort bleiben NW 1 / NW 2 getrennt).
 * Wohnt hier und nicht im Plugin, weil inzwischen mehrere Module (Förderanträge-
 * Quickfilter, Auslastungs-Kapazität, Bearbeitungs-Meilensteine) dieselbe
 * Zuordnung brauchen — es darf nur EINE geben.
 */
export type AntragstypBucket = 'FuE' | 'DS' | 'DL' | 'NW';

/** Anzeige-/Iterations-Reihenfolge der Antragstypen. */
export const ANTRAGSTYP_BUCKETS: readonly AntragstypBucket[] = ['FuE', 'DS', 'DL', 'NW'];

/**
 * vb_phase → Antragstyp. `null` für Irrläufer (9), reservierte Phasen (6–8) und
 * leere/unparsbare Werte — diese tragen bewusst keinen Typ.
 */
export function getAntragstypBucket(raw: unknown): AntragstypBucket | null {
  const n = toVbPhaseNumber(raw);
  if (n === null) return null;
  if (n === 3) return 'FuE';
  if (n === 5) return 'DS';
  if (n === 4) return 'DL';
  if (n === 1 || n === 2) return 'NW';
  return null;
}
