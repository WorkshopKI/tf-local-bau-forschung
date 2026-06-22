/**
 * Reine Bucket-/Summary-Helfer für die gruppierte Ampel-Prüfung. Buckert die
 * flachen `CheckResult[]` eines Schritts nach ihrer (beim Lauf gestempelten)
 * `kategorie` und liefert nicht-leere Gruppen in stabiler `KATEGORIE_ORDER`.
 * Kein React, kein Registry-Lookup — testbar isoliert.
 */
import {
  KATEGORIE_LABEL,
  KATEGORIE_ORDER,
  worstLevel,
  type AmpelLevel,
  type CheckResult,
} from '@/core/services/skills';

export interface CheckGruppe {
  kategorie: string;
  label: string;
  checks: CheckResult[];
  /** Roll-up über die Check-Level der Gruppe (rot ⟩ gelb ⟩ grün). */
  worst: AmpelLevel;
  /** Anzahl nicht-ok Checks. */
  offen: number;
  /** Kurz-Summary für den Gruppen-Kopf. */
  summary: string;
}

function summarize(checks: CheckResult[]): string {
  const fehler = checks.filter(c => c.level === 'fehler').length;
  const hinweise = checks.filter(c => c.level === 'hinweis').length;
  if (fehler > 0) return fehler === 1 ? '1 Fehler' : `${fehler} Fehler`;
  if (hinweise > 0) return hinweise === 1 ? '1 Hinweis' : `${hinweise} Hinweise`;
  return 'alles ok';
}

/** Gruppiert nach `kategorie` (Fallback `'sonstige'`); nur nicht-leere Gruppen. */
export function groupChecksByKategorie(checks: CheckResult[]): CheckGruppe[] {
  const buckets = new Map<string, CheckResult[]>();
  for (const c of checks) {
    const k = c.kategorie ?? 'sonstige';
    const arr = buckets.get(k) ?? [];
    arr.push(c);
    buckets.set(k, arr);
  }
  const order = [...KATEGORIE_ORDER];
  // Unbekannte Kategorien (Fallback) stabil ans Ende.
  for (const k of buckets.keys()) if (!order.includes(k)) order.push(k);

  const gruppen: CheckGruppe[] = [];
  for (const k of order) {
    const arr = buckets.get(k);
    if (!arr || arr.length === 0) continue;
    gruppen.push({
      kategorie: k,
      label: KATEGORIE_LABEL[k] ?? k,
      checks: arr,
      worst: worstLevel(arr.map(c => c.level)),
      offen: arr.filter(c => c.level !== 'ok').length,
      summary: summarize(arr),
    });
  }
  return gruppen;
}
