import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { getEingangAmpel, type EingangAmpel } from './eingangAmpel';
import { daysUntilFrist } from './views';

/**
 * Reine Aggregator-Helpers für `AntragGroup.tvs[]` — werden von der Card- und
 * Compact-View genutzt, um über mehrere TVs eines Verbunds zusammenzufassen.
 * Kein UI-Code hier; bewusst lib-rein damit testbar.
 */

const AMPEL_RANK: Record<EingangAmpel, number> = {
  rot: 4,
  orange: 3,
  gelb: 2,
  gruen: 1,
};

/**
 * Ungünstigster Ampel-Wert aller TVs in der Gruppe. `null` wenn kein TV
 * eine Ampel hat (alle bewilligt/abgeschlossen oder ohne Antragsdatum).
 */
export function worstAmpel(tvs: AntragListItem[]): EingangAmpel | null {
  let worst: EingangAmpel | null = null;
  let worstRank = 0;
  for (const tv of tvs) {
    const a = getEingangAmpel(tv);
    if (a === null) continue;
    const r = AMPEL_RANK[a];
    if (r > worstRank) {
      worstRank = r;
      worst = a;
    }
  }
  return worst;
}

/**
 * Kritischste Frist (kleinster `daysUntilFrist`) aller TVs. `null` wenn
 * keiner eine Frist hat.
 */
export function criticalFrist(tvs: AntragListItem[]): number | null {
  let min: number | null = null;
  for (const tv of tvs) {
    const d = daysUntilFrist(tv);
    if (d === null) continue;
    if (min === null || d < min) min = d;
  }
  return min;
}

/**
 * Set der vorkommenden Status-Kategorien in der Gruppe. Wird genutzt, um zu
 * entscheiden ob die Verbund-Tile einen Status-Dot-Row oder ein einzelnes
 * Status-Label rendert.
 */
export function uniqueStatusCategories(tvs: AntragListItem[]): Set<StatusCategory> {
  const out = new Set<StatusCategory>();
  for (const tv of tvs) out.add(getStatusCategory(tv.status));
  return out;
}

/**
 * CSS-Farbe (Hex) pro Status-Kategorie für die Mini-Dots in der Verbund-Tile.
 * Phase-1-Implementierung mit Hex-Werten — kann später durch Theme-Tokens
 * ersetzt werden. Werte orientieren sich an den Badge-Variants (info/warning/
 * success/error/default), bleiben aber kategoriescharf damit visuell klar
 * ablesbar bleibt, was wo steht.
 */
export function getStatusCategoryColor(cat: StatusCategory): string {
  switch (cat) {
    case 'offen':         return '#94a3b8'; // slate-400 (neutral/eingang)
    case 'in_pruefung':   return '#3b82f6'; // blue-500
    case 'nachforderung': return '#f59e0b'; // amber-500
    case 'entscheidung':  return '#8b5cf6'; // violet-500
    case 'bewilligt':     return '#10b981'; // emerald-500
    case 'begleitung':    return '#14b8a6'; // teal-500
    case 'abgelehnt':     return '#ef4444'; // red-500
    case 'abgeschlossen': return '#6b7280'; // gray-500
    case 'sonstige':      return '#d1d5db'; // gray-300
  }
}

/**
 * Kurzlabel für die Kategorie (Tooltip). Nicht für UI-Badges — dafür gibt es
 * `getStatusLabel(rawStatus)` in `status-mappings.ts`.
 */
export function getStatusCategoryLabel(cat: StatusCategory): string {
  switch (cat) {
    case 'offen':         return 'Offen';
    case 'in_pruefung':   return 'In Prüfung';
    case 'nachforderung': return 'Nachforderung';
    case 'entscheidung':  return 'Entscheidung';
    case 'bewilligt':     return 'Bewilligt';
    case 'begleitung':    return 'Begleitung';
    case 'abgelehnt':     return 'Abgelehnt';
    case 'abgeschlossen': return 'Abgeschlossen';
    case 'sonstige':      return 'Sonstige';
  }
}
