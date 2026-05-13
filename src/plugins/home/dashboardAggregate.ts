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
import type { AntragListItem } from '@/core/services/csv/types';
import type { Vorgang } from '@/core/types/vorgang';
import {
  antragMatchesBearbeiter,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { getStatusCategory } from '@/core/utils/status-canonical';

export type AntragVorgang = Vorgang & {
  _isAntrag: true;
  vb_phase?: number;
  /** Akronym aus dem CSV (z.B. "CALYPSO"). Wird auf der Home-Liste
   *  als bold-prefix vom restlichen Titel separat gerendert, um den
   *  Render-Stil der Antraege-Seite zu spiegeln. */
  acronym?: string;
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
  meineAntraege: AntragVorgang[];
  stats: DashboardStats;
  /** Wurde mindestens ein Antrag mit einem nicht-leeren KUERZ-Feld gesehen?
   *  Wird gebraucht, um die "Bearbeiter-Filter ohne KUERZ-Daten"-Warnung
   *  korrekt zu setzen. */
  anyKuerzelSeen: boolean;
}

export interface AggregateOptions {
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
function antragToVorgangLike(a: AntragListItem): AntragVorgang {
  const deadline = typeof a.frist_datum === 'string' ? a.frist_datum : undefined;
  const created = typeof a.antragsdatum === 'string' ? a.antragsdatum : a._updated_at;
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
      if (bearbeiterMode.active && !antragMatchesBearbeiter(a, bearbeiterMode)) continue;
      const v = antragToVorgangLike(a);
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
  const meineAntraege = [...offeneAntraege]
    .sort((a, b) => {
      const da = a.deadline ?? '￿';
      const db = b.deadline ?? '￿';
      const dCmp = da.localeCompare(db);
      if (dCmp !== 0) return dCmp;
      const pa = a.vb_phase ?? Number.POSITIVE_INFINITY;
      const pb = b.vb_phase ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    })
    .slice(0, 5);

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
