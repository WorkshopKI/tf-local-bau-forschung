/**
 * Reine Aggregations-Funktion fuer die Dashboard-Counts.
 *
 * Wurde aus `useDashboardData()` heraus-extrahiert, damit der Aggregat-Loop
 * unit-testbar ist (ohne Zustand-Stores zu mocken). Der Hook ist jetzt ein
 * duenner Wrapper, der die Store-Werte einliest und diese Funktion ruft.
 *
 * Status-Vergleiche laufen ueber die Kategorie-Helper aus `status-canonical`,
 * d.h. sowohl Welt-A (Seed-Werte wie `genehmigt`/`in_pruefung`) als auch Welt-B
 * (CSV-Rohwerte wie `bewilligt`/`VN geprüft`/`NF gestellt`) werden korrekt
 * gezaehlt.
 */
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { computeFristDatum } from '@/core/services/csv/frist';
import type { Vorgang } from '@/core/types/vorgang';
import {
  antragMatchesBearbeiter,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { getStatusCategory, isBegleitungStatus } from '@/core/utils/status-canonical';

export type AntragVorgang = Vorgang & {
  _isAntrag: true;
  vb_phase?: number;
  /** Akronym aus dem CSV (z.B. "CALYPSO"). Wird auf der Home-Liste
   *  als bold-prefix vom restlichen Titel separat gerendert, um den
   *  Render-Stil der Antraege-Seite zu spiegeln. */
  acronym?: string;
  /** Verbund-ID des Antrags (leer / undefined bei Solo-Antraegen). Wird auf
   *  der Home fuer das Verbund-Clustering der `meineAntraege`-Liste genutzt. */
  verbund_id?: string;
  /** Verbund-Titel aus dem `Verbund`-Store (CSV-Spalte `VB_TITEL`). Wird in
   *  der Home-Liste bevorzugt vor dem TV-Titel angezeigt — sowohl bei Verbund-
   *  Clustern (mehrere TVs gleicher verbund_id) als auch bei Einzelprojekten
   *  (dort ist VB_TITEL meist identisch mit TV-Titel). Fallback auf TV-Titel
   *  wenn `verbund_titel` leer ist. */
  verbund_titel?: string;
  /** Anzahl Teilvorhaben im Verbund-Cluster. Bei Solo-Antraegen 1, bei
   *  Verbund-Lead-TVs = Anzahl aller TVs (inkl. Lead). UI rendert
   *  `+N`-Indikator wenn > 1. Wird nur in `meineAntraege` gesetzt. */
  tv_count?: number;
  /** Wiedereinreicher-Hinweis aus der CSV-Spalte `T_XSW` (custom-Feld
   *  `t_xsw`). Wird in „Meine Anträge" rot/fett hinter dem Titel gerendert. */
  t_xsw?: string;
};

export interface DashboardStats {
  total: number;
  offen: number;
  inPruefung: number;
  nachforderung: number;
  /** Antraege in Begleit-Phase (VN/ZB-Pruefung, nach Bewilligung). */
  begleitung: number;
  bewilligt: number;
}

export interface DashboardAggregateResult {
  offeneVorgaenge: Vorgang[];
  dringend: Array<Vorgang & { daysLeft: number }>;
  naechsterSchritt: (Vorgang & { daysLeft: number }) | null;
  fristenDieseWoche: number;
  letzteAenderungen: Vorgang[];
  /** Alle offenen eigenen Förderanträge, sortiert nach Frist asc, dann
   *  vb_phase asc. Die UI (HomePage/MeineAntraegeSection) schneidet selbst
   *  ab — initial nach `profile.home_meine_antraege_count` (Default 5),
   *  optional erweiterbar via "+10 mehr"-Button. */
  meineAntraege: AntragVorgang[];
  stats: DashboardStats;
  /** Wurde mindestens ein Antrag mit einem nicht-leeren KUERZ-Feld gesehen?
   *  Wird gebraucht, um die "Bearbeiter-Filter ohne KUERZ-Daten"-Warnung
   *  korrekt zu setzen. */
  anyKuerzelSeen: boolean;
}

export interface AggregateOptions {
  /** Optional: Verbund-Lookup (verbund_id → Verbund). Wird in
   *  `antragToVorgangLike` genutzt um `verbund_titel` an die MeineAntraege-
   *  Liste anzuhaengen. Wenn nicht uebergeben, bleibt `verbund_titel`
   *  undefined und das UI faellt auf den TV-Titel zurueck. */
  verbundById?: Map<string, Verbund>;
  includeBauantraege: boolean;
  includeAntraege: boolean;
  /** Erlaubt Tests mit einem fixen Heute-Datum. Default `Date.now()`. */
  nowMs?: number;
}

const KUERZ_KEYS_CANONICAL: readonly string[] = [
  'tib_kuerz', 'bib_kuerz', 'ztp_kuerz', 'pfm_kuerz',
];
const KUERZ_KEYS_CANONICAL_SET: ReadonlySet<string> = new Set(KUERZ_KEYS_CANONICAL);

/** Inline-Variante von hasAnyKuerzelData(single-record). Spart eine separate
 *  Full-Scan-Pass über die Antrag-Liste — wir checken im Aggregations-Loop
 *  parallel, ob irgendein Antrag eine der KUERZ-Spalten gesetzt hat. */
function antragHasAnyKuerzel(antrag: AntragListItem): boolean {
  const rec = antrag as unknown as Record<string, unknown>;
  for (const k of KUERZ_KEYS_CANONICAL) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  for (const key in rec) {
    if (KUERZ_KEYS_CANONICAL_SET.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key) continue;
    if (!KUERZ_KEYS_CANONICAL_SET.has(lk)) continue;
    const v = rec[key];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  return false;
}

function daysUntil(dateStr: string | undefined, nowMs: number): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - nowMs;
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Minimal-Projektion eines Antrags auf eine Vorgang-aehnliche Shape. */
function antragToVorgangLike(
  a: AntragListItem,
  verbundById?: Map<string, Verbund>,
): AntragVorgang {
  const antragsdatum = typeof a.antragsdatum === 'string' ? a.antragsdatum : undefined;
  // `deadline` ist die phasen-abhaengige Frist (siehe csv/frist.ts):
  // - Antragsphase: antragsdatum + 90 Tage
  // - Begleitphase: vn_eingang_datum + 6 Monate
  // Damit ist `daysLeft <= 0` "Frist verletzt", `daysLeft ∈ [0, 7]` "Frist
  // droht diese Woche zu reissen" — kompatibel zur bestehenden Aggregat-Logik.
  const deadline = computeFristDatum(a) ?? undefined;
  const created = antragsdatum ?? a._updated_at;
  const verbundId = typeof a.verbund_id === 'string' && a.verbund_id.length > 0 ? a.verbund_id : undefined;
  // Verbund-Titel (VB_TITEL) bevorzugt aus dem Verbund-Store ziehen. Wenn der
  // Verbund nicht gefunden wird oder das Titel-Feld leer ist, bleibt es
  // undefined und das UI faellt auf den TV-Titel zurueck.
  const verbundTitel = verbundId && verbundById
    ? (() => {
        const vb = verbundById.get(verbundId);
        const t = typeof vb?.titel === 'string' ? vb.titel.trim() : '';
        return t.length > 0 ? t : undefined;
      })()
    : undefined;
  return {
    id: a.aktenzeichen,
    type: 'bauantrag',
    title: a.titel ?? a.aktenzeichen,
    status: (a.status as Vorgang['status']) ?? 'neu',
    priority: 'normal',
    assignee: a.antragsteller ?? '',
    created,
    modified: a._updated_at,
    deadline,
    tags: [],
    notes: '',
    _isAntrag: true,
    vb_phase: typeof a.vb_phase === 'number' ? a.vb_phase : undefined,
    acronym: typeof a.akronym === 'string' && a.akronym.trim().length > 0 ? a.akronym.trim() : undefined,
    verbund_id: verbundId,
    verbund_titel: verbundTitel,
    t_xsw: typeof a.t_xsw === 'string' && a.t_xsw.trim().length > 0 ? a.t_xsw.trim() : undefined,
  };
}

interface MutableStats {
  total: number;
  offen: number;
  inPruefung: number;
  nachforderung: number;
  begleitung: number;
  bewilligt: number;
}

/** Zaehlt einen Status-Wert in das Stats-Objekt und gibt zurueck, ob der
 *  Status final entschieden ist (closed = nicht mehr in `offen`). */
function tallyStatus(status: string | undefined, stats: MutableStats): boolean {
  const cat = getStatusCategory(status);
  if (cat === 'in_pruefung') stats.inPruefung++;
  else if (cat === 'nachforderung') stats.nachforderung++;
  else if (cat === 'begleitung') stats.begleitung++;
  else if (cat === 'bewilligt') stats.bewilligt++;
  return cat === 'bewilligt' || cat === 'abgelehnt' || cat === 'abgeschlossen';
}

export function computeDashboardAggregate(
  bauantraege: readonly Vorgang[],
  antraege: readonly AntragListItem[],
  bearbeiterMode: BearbeiterFilterMode,
  options: AggregateOptions,
): DashboardAggregateResult {
  const nowMs = options.nowMs ?? Date.now();
  const stats: MutableStats = {
    total: 0, offen: 0, inPruefung: 0, nachforderung: 0, begleitung: 0, bewilligt: 0,
  };
  let anyKuerzelSeen = false;
  const offeneVorgaenge: Vorgang[] = [];
  const fristKandidaten: Array<Vorgang & { daysLeft: number }> = [];

  if (options.includeBauantraege) {
    for (const v of bauantraege) {
      stats.total++;
      const isClosed = tallyStatus(v.status as string, stats);
      if (isClosed) continue;
      stats.offen++;
      offeneVorgaenge.push(v);
      const dl = daysUntil(v.deadline, nowMs);
      if (dl !== null) fristKandidaten.push({ ...v, daysLeft: dl });
    }
  }

  const offeneAntraege: AntragVorgang[] = [];
  if (options.includeAntraege) {
    for (const a of antraege) {
      if (!anyKuerzelSeen && antragHasAnyKuerzel(a)) anyKuerzelSeen = true;
      if (isIrrlaeufer(a.vb_phase)) continue;
      // Phase-Filter: Antraege in Begleitphase (VN-/ZB-Stati) nur sichtbar,
      // wenn der Profil-Toggle `bearbeiter_inkl_begleitung` aktiv ist. Die
      // Begleitung hat andere Zustaendigkeit (ZTP/PFM) und andere Frist-
      // Berechnung — Default ist sie auf der Home ausgeblendet.
      if (isBegleitungStatus(a.status) && !bearbeiterMode.includeBegleitung) continue;
      if (bearbeiterMode.active && !antragMatchesBearbeiter(a, bearbeiterMode)) continue;
      const v = antragToVorgangLike(a, options.verbundById);
      stats.total++;
      const isClosed = tallyStatus(v.status as string, stats);
      if (isClosed) continue;
      stats.offen++;
      offeneVorgaenge.push(v);
      offeneAntraege.push(v);
      const dl = daysUntil(v.deadline, nowMs);
      if (dl !== null) fristKandidaten.push({ ...v, daysLeft: dl });
    }
  }

  fristKandidaten.sort((x, y) => x.daysLeft - y.daysLeft);
  const dringend = fristKandidaten.filter(v => v.daysLeft <= 7);
  const naechster = fristKandidaten[0] ?? null;
  let fristenDieseWoche = 0;
  for (const v of fristKandidaten) {
    if (v.daysLeft >= 0 && v.daysLeft <= 7) fristenDieseWoche++;
  }

  const letzteAenderungen = [...offeneVorgaenge]
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, 8);

  // Sortierung: Frist primaer (frueheste Frist oben), VB-Phase als Tie-Breaker.
  // Antraege ohne `deadline` (frist_datum nicht gepflegt) rutschen ans Ende
  // durch den `￿`-Sentinel-Sort-Key.
  const sortedMeineAntraege = [...offeneAntraege]
    .sort((a, b) => {
      const da = a.deadline ?? '￿';
      const db = b.deadline ?? '￿';
      const dCmp = da.localeCompare(db);
      if (dCmp !== 0) return dCmp;
      const pa = a.vb_phase ?? Number.POSITIVE_INFINITY;
      const pb = b.vb_phase ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    });

  // Verbund-Clustering: pro `verbund_id` nur den ersten TV behalten (= TV mit
  // der kritischsten Frist, weil die Liste schon sortiert ist). Solo-Antraege
  // ohne verbund_id bleiben einzeln. `tv_count` zaehlt die Geschwister inkl.
  // Lead, damit die UI einen "+N"-Indikator rendern kann.
  // Begruendung: die Home soll nur signalisieren *dass* an einem Antrag etwas
  // offen ist — der User klickt darauf und sieht den vollen Cluster in der
  // Antrags-Liste. TVs einzeln auflisten blaehte die Home auf (Beispiel
  // KOMPaSS mit 3 TVs = 3 fast identische Zeilen). Kein Slice — UI schneidet
  // selbst ab, damit "+10 mehr"-Erweiterung in-page funktioniert.
  const verbundCount = new Map<string, number>();
  for (const tv of sortedMeineAntraege) {
    if (tv.verbund_id) {
      verbundCount.set(tv.verbund_id, (verbundCount.get(tv.verbund_id) ?? 0) + 1);
    }
  }
  const seenVerbund = new Set<string>();
  const meineAntraege: AntragVorgang[] = [];
  for (const tv of sortedMeineAntraege) {
    if (tv.verbund_id) {
      if (seenVerbund.has(tv.verbund_id)) continue;
      seenVerbund.add(tv.verbund_id);
      meineAntraege.push({ ...tv, tv_count: verbundCount.get(tv.verbund_id) ?? 1 });
    } else {
      meineAntraege.push({ ...tv, tv_count: 1 });
    }
  }

  return {
    offeneVorgaenge,
    dringend,
    naechsterSchritt: naechster,
    fristenDieseWoche,
    letzteAenderungen,
    meineAntraege,
    stats: { ...stats },
    anyKuerzelSeen,
  };
}
