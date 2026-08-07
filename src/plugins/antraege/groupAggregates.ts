import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { getEingangAmpel, type EingangAmpel } from './eingangAmpel';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import { fristErgebnisVon, fristTageVon } from './fristAnzeige';
import { formatFkzRange } from './antragGroups';
import { sectionOf, type StatusSectionId } from './antragGroups';

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
 * Kritischste Frist aller TVs (kleinste Restzeit). Der Verbund ist so kritisch
 * wie sein dringendster TV (am staerksten negativer/kleinster Wert).
 * Phase-abhaengig: Antragsphase-TV vs. Begleit-TV mischen ist OK, weil beide
 * auf das gleiche "Tage bis zur Frist"-Mass normalisiert sind.
 *
 * Liefert `null`, wenn bei keinem TV eine Uhr laeuft — angehaltene und
 * unberechenbare zaehlen hier NICHT als 0 oder als grosse Zahl mit, sonst
 * sortierte ein stillstehender Verbund zwischen die dringenden.
 */
export function criticalFristAware(tvs: AntragListItem[]): number | null {
  let min: number | null = null;
  for (const tv of tvs) {
    const d = fristTageVon(tv);
    if (d === null) continue;
    if (min === null || d < min) min = d;
  }
  return min;
}

/**
 * Der Frist-ZUSTAND des Verbundes — die Aggregat-Fassung von `berechneFrist`.
 *
 * Reihenfolge der Aussagen, absteigend nach Dringlichkeit dessen, was der
 * Nutzer wissen muss:
 *
 * 1. Laeuft irgendwo eine Uhr, gilt die knappste. Ein Verbund mit einem
 *    laufenden und vier angehaltenen TVs hat eine Frist.
 * 2. Sonst: steht mindestens eine Uhr still, ist der Verbund angehalten.
 * 3. Sonst gibt es keine Grundlage — und die Anzeige sagt das, statt leer zu
 *    bleiben.
 *
 * `tvs` leer (dazu kommt es bei einem Pseudo-Verbund) ⇒ `nicht_berechenbar`.
 */
export function criticalFristErgebnis(
  tvs: AntragListItem[], nowMs: number = Date.now(),
): FristErgebnis {
  let bester: FristErgebnis | null = null;
  let angehalten: FristErgebnis | null = null;
  let ohne: FristErgebnis | null = null;
  for (const tv of tvs) {
    const e = fristErgebnisVon(tv, nowMs);
    if (e.zustand === 'laeuft') {
      if (bester === null || (e.tageRest ?? Infinity) < (bester.tageRest ?? Infinity)) bester = e;
    } else if (e.zustand === 'angehalten') {
      angehalten ??= e;
    } else {
      ohne ??= e;
    }
  }
  return bester ?? angehalten ?? ohne
    ?? { zustand: 'nicht_berechenbar', haltedatumQuelle: 'unbekannt' };
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
 * Der Abschnitt einer Verbund-/Cluster-Gruppe — basiert auf `dominantStatus`.
 * Eingesetzt in `buildAntragGroups({ mode: 'status' })`, damit Verbund-Cluster
 * komplett in eine Section wandern statt pro TV einzeln verteilt zu werden.
 *
 * Die Zuordnung selbst steht in `sectionOf` (antragGroups.ts). Bis v2.409 stand
 * hier eine dritte wortgleiche `switch`-Kaskade — sie lief so lange mit, wie
 * niemand eine der drei anfasste.
 */
export function statusPhaseForGroup(
  tvs: AntragListItem[],
  verbundStatus?: string | null,
): StatusSectionId {
  return sectionOf(dominantStatus(tvs, verbundStatus));
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
export function sumFoerdersumme(tvs: ReadonlyArray<{ foerdersumme?: unknown }>): number | null {
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
