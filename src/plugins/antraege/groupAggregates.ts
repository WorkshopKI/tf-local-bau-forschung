import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { normalisierePrecheck, type PrecheckKlasse } from '@/core/utils/naechsterSchritt';
import { getEingangAmpel, type EingangAmpel } from './eingangAmpel';
import { verbundFristErgebnis, type FristErgebnis } from '@/core/services/csv/frist-ergebnis';
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
  // Die Faltung wohnt seit v6.66 im csv-Layer — der Meilenstein-Plan liest
  // dieselbe, sonst hätte er wieder eine eigene Uhr.
  return verbundFristErgebnis(tvs, nowMs);
}

/**
 * Der Frist-Zustand EINER Tabellenzeile — Verbund-Aggregat oder Einzel-TV.
 *
 * Die eine Weiche zwischen beiden Fällen. Sie stand bis v4.62 modul-privat in
 * `tableColumns.tsx` und diente nur der Frist-Zelle; seit die Tabelle auch nach
 * Dringlichkeit gruppieren kann, brauchen Zelle UND Abschnitt denselben Wert.
 * Zwei Fassungen liefen genau dann auseinander, wenn es darauf ankommt: die
 * Zelle sagte „in 3 T", der Abschnitt „ohne laufende Frist".
 *
 * Sie wohnt hier und nicht in `fristAnzeige.ts`, weil sie die Verbund-Form
 * (`_verbund.tvs`) kennt — und hier, statt in `tableGrouping.ts`, damit die
 * Gruppierung nicht auf `tableColumns.tsx` zeigen muss (das holt seinerseits
 * `AntragTableRow` von dort — ein Laufzeit-Zyklus, und die Allowlist ist leer).
 */
export function fristErgebnisFuerZeile(
  r: AntragListItem & { _verbund?: { tvs: AntragListItem[] } },
  nowMs: number = Date.now(),
): FristErgebnis {
  return r._verbund ? criticalFristErgebnis(r._verbund.tvs, nowMs) : fristErgebnisVon(r, nowMs);
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

/** Die zwei PreCheck-Felder, die eine Faltung braucht. */
interface PrecheckTv {
  precheck_tv_status_label?: string;
  precheck_tv_status_datum?: string;
}

/**
 * Der TV-PreCheck einer **Verbund-Zeile**: das schwerwiegendste Urteil über alle
 * Teilvorhaben, nicht das des Lead-Teilvorhabens.
 *
 * `buildVerbundTableRows` baut die verdichtete Zeile aus `...lead` — sie erbt
 * also alles, was nicht ausdrücklich gefaltet wird. Beim PreCheck ist das
 * falsch: er ist ein **Urteil je Teilvorhaben**, und ein einziges negatives
 * entscheidet über den Verbund. Bei KITED (ZKN125314) trug das zweite von drei
 * Teilvorhaben einen negativen PreCheck; die Zeile las den des ersten und meldete
 * „positiv" — auch nach dem Spalten-Split hätte sie das getan.
 *
 * Dieselbe Rangfolge wie in `precheckUrteil` (negativ vor positiv vor offen), nur
 * über die Teilvorhaben statt über die zwei Ebenen. Der Verbund-PreCheck
 * (`precheck_vb_*`) braucht keine Faltung — er steht auf jedem TV-Record gleich.
 */
export function dominantPrecheckTv(tvs: ReadonlyArray<PrecheckTv>): PrecheckTv | null {
  const rang: Record<PrecheckKlasse, number> = { negativ: 0, positiv: 1, offen: 2, ohne: 3 };
  let beste: { tv: PrecheckTv; r: number } | null = null;
  for (const tv of tvs) {
    const r = rang[normalisierePrecheck(tv.precheck_tv_status_label)];
    if (beste === null || r < beste.r) beste = { tv, r };
  }
  if (beste === null || beste.r === rang.ohne) return null;
  return {
    ...(beste.tv.precheck_tv_status_label !== undefined
      ? { precheck_tv_status_label: beste.tv.precheck_tv_status_label } : {}),
    ...(beste.tv.precheck_tv_status_datum !== undefined
      ? { precheck_tv_status_datum: beste.tv.precheck_tv_status_datum } : {}),
  };
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
