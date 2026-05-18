import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { getEingangAmpel, type EingangAmpel } from './eingangAmpel';
import { daysUntilFrist } from './views';
import { formatFkzRange } from './antragGroups';
import type { StatusPhaseLabel } from './antragGroups';

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

function trimmedString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Subset der Antrag-/AntragListItem-Felder, die für die Cluster-Aggregate
 *  ausreichen. Damit funktionieren `dominantStatus`, `sumFoerdersumme` etc.
 *  sowohl auf der schmalen Listen-Projektion (`AntragListItem`) als auch auf
 *  dem vollen `Antrag`-Record (z.B. im Verbund-Detail). */
interface StatusTv {
  status?: unknown;
}

/**
 * Status, der auf der Verbund-Card/Cluster-Zeile als einzelne Pill angezeigt
 * wird. Bevorzugt das gepflegte `Verbund.status` (CSV-Feld `verbund_status`),
 * fällt bei Leer/Fehlen auf den ersten TV in der Eingabe-Reihenfolge zurück —
 * die Caller-Pipeline (Lead-First-Sort innerhalb von Verbund-Clustern) hat
 * den Konsortialführer dort hingeführt. Liefert `null` wenn weder Verbund-
 * Status noch TV-Status gesetzt ist.
 */
export function dominantStatus(
  tvs: ReadonlyArray<StatusTv>,
  verbundStatus?: string | null,
): string | null {
  const v = trimmedString(verbundStatus);
  if (v) return v;
  for (const tv of tvs) {
    const s = trimmedString(tv.status);
    if (s) return s;
  }
  return null;
}

/**
 * Phase-Label für eine Verbund-/Cluster-Gruppe — basiert auf `dominantStatus`.
 * Eingesetzt in `buildAntragGroups({ mode: 'status' })`, damit Verbund-Cluster
 * komplett in eine Phase-Section wandern statt pro TV einzeln verteilt zu
 * werden.
 */
export function statusPhaseForGroup(
  tvs: AntragListItem[],
  verbundStatus?: string | null,
): StatusPhaseLabel {
  const raw = dominantStatus(tvs, verbundStatus);
  const cat = getStatusCategory(raw);
  switch (cat) {
    case 'offen':
    case 'in_pruefung':
    case 'entscheidung':
      return 'Offen';
    case 'nachforderung':
      return 'Nachforderung';
    case 'bewilligt':
      return 'Bewilligt';
    case 'begleitung':
      return 'Begleitung';
    case 'abgeschlossen':
    case 'abgelehnt':
      return 'Abgeschlossen';
    default:
      return 'Sonstige';
  }
}

/**
 * Förderkennzeichen, das auf der Verbund-Card als Subtitle erscheint.
 * Bevorzugt `verbund.verbund_id` (= das in der CSV gepflegte Verbund-FKZ),
 * fällt sonst auf die FKZ-Range der TVs zurück (`16KN…–16KN…`).
 */
export function verbundFkz(verbund: Verbund | undefined, tvs: AntragListItem[]): string {
  const vid = trimmedString(verbund?.verbund_id);
  if (vid) return vid;
  return formatFkzRange(tvs);
}

/**
 * Summe der TV-Fördervolumen (kanonisches Feld `foerdersumme`). Liefert `null`
 * wenn kein TV das Feld gesetzt hat. Wird auf der Verbund-Detail-Stammdaten-
 * Card als „Fördervolumen (geplant)" angezeigt.
 */
export function sumFoerdersumme(tvs: ReadonlyArray<Record<string, unknown>>): number | null {
  let sum = 0;
  let any = false;
  for (const tv of tvs) {
    const raw = tv.foerdersumme;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      sum += raw;
      any = true;
      continue;
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const n = Number(raw.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n)) { sum += n; any = true; }
    }
  }
  return any ? sum : null;
}
