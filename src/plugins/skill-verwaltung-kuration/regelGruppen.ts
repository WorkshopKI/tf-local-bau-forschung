/**
 * Reiner Bucket-Helfer für die Regel-Zuordnung im Skill-Editor. Buckert die
 * Regel-Bibliothek (`QualitaetsRegel[]`) nach ihrer Kategorie/„Art"
 * (`effektiveKategorie`) und liefert nicht-leere Gruppen in stabiler
 * `KATEGORIE_ORDER`. Pro Gruppe wird gezählt, wie viele ihrer Regeln dem Skill
 * aktuell zugeordnet (angehakt) sind — das treibt das Auto-Aufklappen der
 * Editor-Sektionen. Kein React, kein Registry-Lookup — isoliert testbar.
 *
 * Muster gespiegelt von `plugins/antraege/gutachten/checkGruppen.ts`.
 */
import {
  effektiveKategorie,
  KATEGORIE_LABEL,
  KATEGORIE_ORDER,
  type QualitaetsRegel,
} from '@/core/services/skills';

export interface RegelGruppe {
  kategorie: string;
  /** Menschenlesbares Label (`KATEGORIE_LABEL[k] ?? k`). */
  label: string;
  regeln: QualitaetsRegel[];
  /** Anzahl der Regeln dieser Gruppe, die dem Skill zugeordnet (angehakt) sind. */
  zugeordnet: number;
  /** Anzahl der Regeln in der Gruppe insgesamt. */
  gesamt: number;
}

/**
 * Gruppiert die Regel-Bibliothek nach `effektiveKategorie` (Fallback intern
 * `'sonstige'`); nur nicht-leere Gruppen, unbekannte Kategorien stabil ans Ende.
 */
export function groupRegelnByKategorie(
  regeln: QualitaetsRegel[],
  checkedIds: readonly string[],
): RegelGruppe[] {
  const checked = new Set(checkedIds);
  const buckets = new Map<string, QualitaetsRegel[]>();
  for (const r of regeln) {
    const k = effektiveKategorie(r);
    const arr = buckets.get(k) ?? [];
    arr.push(r);
    buckets.set(k, arr);
  }

  const order = [...KATEGORIE_ORDER];
  // Unbekannte Kategorien (z.B. kuratorgesetzte Sonder-Kategorie) stabil ans Ende.
  for (const k of buckets.keys()) if (!order.includes(k)) order.push(k);

  const gruppen: RegelGruppe[] = [];
  for (const k of order) {
    const arr = buckets.get(k);
    if (!arr || arr.length === 0) continue;
    gruppen.push({
      kategorie: k,
      label: KATEGORIE_LABEL[k] ?? k,
      regeln: arr,
      zugeordnet: arr.reduce((n, r) => n + (checked.has(r.id) ? 1 : 0), 0),
      gesamt: arr.length,
    });
  }
  return gruppen;
}
