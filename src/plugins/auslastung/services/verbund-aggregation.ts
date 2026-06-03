/**
 * Verbund-Aggregation fuer den Klassifizierungs-Tab.
 *
 * Hintergrund: Die Klassifizierungs-Entscheidung wird fachlich pro Verbund
 * getroffen (alle Teilvorhaben (TVs) eines Verbundes gehen an denselben
 * Bearbeiter und gehoeren zur gleichen Themengruppe). Die UI bündelt
 * deshalb TVs unter ihrem Verbund-Header; das Datenmodell der Klassifizierung
 * bleibt pro `antragId` (= aktenzeichen) — beim Freigeben werden alle TVs
 * eines Verbundes mit identischen Kategorien upgesertet.
 *
 * Solo-TVs (kein `verbund_id`) werden als 1er-Verbund behandelt, damit die
 * Liste eine einheitliche Render-Logik hat.
 */
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  CANONICAL_AKRONYM,
  CANONICAL_ANTRAGSDATUM,
  CANONICAL_D_XTEC,
  CANONICAL_TIB_KUERZ,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  type Klassifizierung,
  type UeberKategorie,
  type Zuweisung,
} from '../types';
import { klassifiziereAntrag } from './klassifizierung-engine';
import { normalizeKuerzel } from './anonym-map';
import type { KlassifizierungsView } from '../hooks/useKlassifizierungen';

export interface VerbundKlassifizierungsView {
  /** Stabile ID — `verbund_id` bei Verbund-Antraegen, sonst `aktenzeichen` als
   *  Pseudo-ID (Solo-TV als 1er-Verbund). */
  verbundId: string;
  /** True wenn dieser Verbund nur 1 TV hat — dann sind TV-Sub-Rows in der UI
   *  redundant (zeigen identische Daten wie der Header). UI rendert
   *  TV-Sub-Rows nur bei `!isSolo`. Achtung: das hat NICHTS damit zu tun, ob
   *  `verbund_id` gesetzt ist — auch ein "Einzel-Antrag mit verbund_id" ist
   *  ein Solo-Verbund aus UI-Sicht. */
  isSolo: boolean;
  akronym: string;
  verbundTitel: string;
  /** TVs in FKZ-Reihenfolge (alphanumerisch aufsteigend). */
  tvs: Antrag[];
  /** Klassifizierung des repraesentativen (ersten) TVs — alle TVs eines
   *  Verbundes teilen denselben Stand. */
  klassifizierung: Klassifizierung;
  confidence: 'high' | 'medium' | 'low';
}

function readString(antrag: Antrag, key: string): string {
  const v = (antrag as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

function confidenceFor(kl: Klassifizierung): 'high' | 'medium' | 'low' {
  const primaer = kl.vorgeschlagenePrimaer;
  if (!primaer) return 'low';
  if (primaer.confidence >= 0.7) return 'high';
  if (primaer.confidence >= 0.4) return 'medium';
  return 'low';
}

/** Eindeutige Verbund-Key fuer Bucketing — `verbund_id` falls gesetzt,
 *  sonst Solo-ID = `aktenzeichen`. */
export function verbundKeyOf(antrag: Antrag): string {
  const vid = readString(antrag, CANONICAL_VERBUND_ID);
  return vid.length > 0 ? vid : antrag.aktenzeichen;
}

/** Verbund-Anzeige-Metadaten (Akronym + Titel): primaer aus dem `verbuende`-
 *  Store, Fallback auf die Felder des repraesentativen TVs. Geteilt von der
 *  Klassifizierungs-Aggregation und der Zuweisungs-Gruppierung. */
export function resolveVerbundMeta(
  verbund: Verbund | undefined,
  rep: Antrag,
): { akronym: string; verbundTitel: string } {
  const akronym = (verbund?.akronym && verbund.akronym.length > 0)
    ? verbund.akronym
    : readString(rep, CANONICAL_AKRONYM);
  const verbundTitel = (verbund?.titel && verbund.titel.length > 0)
    ? verbund.titel
    : readString(rep, CANONICAL_VERBUND_TITEL) || readString(rep, CANONICAL_TITEL);
  return { akronym, verbundTitel };
}

// ─── Verbund = eine Einheit, ein Bearbeiter ──────────────────────────────
// Praezedenz bei mehreren ACTIVE Zuweisungen EINES Verbundes (Konflikt/Altdaten):
// PL-Freigabe schlaegt Selbst-Eintrag schlaegt Matching-Vorschlag.
const ZUWEISUNG_STATUS_RANK: Record<string, number> = { freigegeben: 0, selbst: 1, vorgeschlagen: 2 };
const zuweisungStatusRank = (s: string): number => ZUWEISUNG_STATUS_RANK[s] ?? 3;

/** Maßgebliche Zuweisung EINES Verbundes aus konkurrierenden Kandidaten:
 *  Freigabe > Selbst > Vorschlag; bei Gleichstand der Lead-TV (kleinstes
 *  Aktenzeichen), dann meiste Stunden. Deterministisch; gibt eine der
 *  Eingaben per Referenz zurueck (`candidates` ist nie leer). Geteilt vom
 *  Export (Anzeige-Gruppierung) und der Store-Reconciliation (Altdaten-Cleanup). */
export function pickVerbundZuweisung(candidates: readonly Zuweisung[]): Zuweisung {
  return candidates.reduce((best, z) => {
    const r = zuweisungStatusRank(z.status) - zuweisungStatusRank(best.status);
    if (r !== 0) return r < 0 ? z : best;
    const az = z.antragId.localeCompare(best.antragId, 'de');
    if (az !== 0) return az < 0 ? z : best;
    return z.stunden > best.stunden ? z : best;
  });
}

// ─── Pool-Filterung (frueher in KlassifizierungsReview.istZuVerteilen) ──
// In den Service gezogen, damit der Closure-Cache auf `cache.antraege` keyen
// kann (Store-Ref, ref-stable ueber Re-Mount). Ein extern vor-gefiltertes
// Array kommt aus einem useMemo und ist beim Re-Mount instabil.

const POOL_EXCLUDED_STATUS = new Set(['abgelehnt/zurückgezogen', 'irrläufer']);

/**
 * True, wenn der Antrag in der (Master-)CSV bereits ein Bearbeiter-Kürzel
 * (`tib_kuerz`) trägt — also schon vergeben ist. Pure + testbar; geteilt vom
 * Klassifizierungs-Pool (`istZuVerteilen`) und der Zuweisungs-Worklist
 * (bereits gekürzelte Anträge gehören in keine der beiden Listen).
 */
export function hatBearbeiterKuerzel(antrag: Antrag): boolean {
  return normalizeKuerzel((antrag as Record<string, unknown>)[CANONICAL_TIB_KUERZ]) !== null;
}

/**
 * True, wenn der Antrag im Feld `d_xtec` (D_XTEC) ein Datum traegt — d.h. alle
 * TVs des Verbundes sind eingegangen + erfasst. Pures Vorhandensein eines
 * nicht-leeren Strings reicht (Date-Felder landen als ISO-String im Merger).
 */
export function hatDXtecDatum(antrag: Antrag): boolean {
  const v = (antrag as Record<string, unknown>)[CANONICAL_D_XTEC];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * True, wenn der Antrag „nicht vollstaendig" ist: kein D_XTEC-Datum UND kein
 * Bearbeiter-Kuerzel. Solche Antraege bleiben im Verteil-Pool sichtbar +
 * zuweisbar, werden aber farbig markiert (Tooltip `UNVOLLSTAENDIG_TOOLTIP`).
 * Greift NICHT in `istZuVerteilen` ein (Pool unveraendert).
 */
export function istUnvollstaendig(antrag: Antrag): boolean {
  return !hatDXtecDatum(antrag) && !hatBearbeiterKuerzel(antrag);
}

/** Tooltip-Text fuer unvollstaendige Antraege (kein D_XTEC). Geteilt von beiden Tabs. */
export const UNVOLLSTAENDIG_TOOLTIP = 'Antrag nicht vollständig - kein D_XTEC gesetzt';

/**
 * Untere Datums-Grenze (inklusive, ISO `YYYY-MM-01`) des rollierenden Verteil-
 * Fensters: die letzten `lookbackMonate` Monate bis zum Ende des Quartals
 * `quartal` (YYYY-QN). null bei ungültigem Quartal-Format. Gleitet sauber über
 * den Jahreswechsel — ein Dezember-Antrag bleibt `lookbackMonate` Monate sichtbar,
 * unabhängig vom Kalenderjahr. Geteilt von Klassifizierungs- + Zuweisungs-Pool.
 */
export function verteilCutoffDatum(quartal: string, lookbackMonate: number): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(quartal);
  if (!m) return null;
  const year = Number(m[1]);
  const endMonth = Number(m[2]) * 3 - 1;        // 0-basiert: Q1→2 (März) … Q4→11 (Dez)
  const back = Math.max(1, Math.floor(lookbackMonate));
  let cm = endMonth - (back - 1);               // erster Monat des Fensters (0-basiert)
  let cy = year;
  while (cm < 0) { cm += 12; cy -= 1; }
  return `${cy}-${String(cm + 1).padStart(2, '0')}-01`;
}

/**
 * Pool-Gate „zu verteilen": Antragsdatum im rollierenden Fenster
 * (≥ `cutoffDatum`, ISO-Vergleich), OHNE Bearbeiter-Kürzel und nicht in einem
 * ausgeschlossenen Status. Geteilt von der Klassifizierungs-Liste UND der
 * Zuweisungs-Worklist — beide zeigen denselben Antrags-Pool.
 */
export function istZuVerteilen(antrag: Antrag, cutoffDatum: string): boolean {
  const datum = (antrag as Record<string, unknown>)[CANONICAL_ANTRAGSDATUM];
  if (typeof datum !== 'string' || datum < cutoffDatum) return false;
  if (hatBearbeiterKuerzel(antrag)) return false;
  const status = typeof antrag.status === 'string' ? antrag.status.trim().toLowerCase() : '';
  if (POOL_EXCLUDED_STATUS.has(status)) return false;
  return true;
}

// ─── Module-globaler Cache (ueberlebt Komponenten-Unmount) ───────────────
// Cache-Key MUSS ref-stable Store-Refs nutzen — KEINE useMemos. Bei Re-Mount
// liefern useMemos in den Konsumenten-Komponenten frische Refs, der Cache
// wuerde sonst nie greifen. Stattdessen filtert + baut die Funktion intern.

interface CachedClassificationViews {
  antraege: readonly Antrag[];
  cutoffDatum: string | null;
  kategorien: readonly UeberKategorie[];
  persisted: readonly Klassifizierung[];
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined;
  stage2Aktiv: boolean;
  verbuende: readonly Verbund[];
  value: VerbundKlassifizierungsView[];
}

let cachedViews: CachedClassificationViews | null = null;

// ─── Live-Klassifizierungs-Cache (Klick-Lag-Fix) ─────────────────────────
// Die Live-Klassifizierung (`klassifiziereAntrag`, Stage-2-Embedding) eines
// unklassifizierten Verbundes haengt NUR von (rep, kategorien, embedding[key],
// stage2Aktiv) ab — NICHT vom `persisted`-Array. Damit ein Pill-Klick (neues
// persisted-Array) nicht alle Live-Klassifizierungen neu rechnet, cachen wir
// sie pro Verbund-Key. Der Cache wird verworfen, sobald sich eine der echten
// Live-Deps (antraege/kategorien/embeddings/stage2Aktiv) ref-seitig aendert.
interface LiveKlGeneration {
  antraege: readonly Antrag[];
  kategorien: readonly UeberKategorie[];
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined;
  stage2Aktiv: boolean;
}
let liveGen: LiveKlGeneration | null = null;
let liveKlCache = new Map<string, Klassifizierung>();

export function buildVerbundClassificationViews(
  antraege: readonly Antrag[],
  cutoffDatum: string | null,
  kategorien: readonly UeberKategorie[],
  persisted: readonly Klassifizierung[],
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined,
  stage2Aktiv: boolean,
  verbuende: readonly Verbund[],
): VerbundKlassifizierungsView[] {
  if (cachedViews
      && cachedViews.antraege === antraege
      && cachedViews.cutoffDatum === cutoffDatum
      && cachedViews.kategorien === kategorien
      && cachedViews.persisted === persisted
      && cachedViews.verbundEmbeddings === verbundEmbeddings
      && cachedViews.stage2Aktiv === stage2Aktiv
      && cachedViews.verbuende === verbuende) {
    return cachedViews.value;
  }
  const value = computeVerbundClassificationViews(
    antraege, cutoffDatum, kategorien, persisted, verbundEmbeddings, stage2Aktiv, verbuende,
  );
  cachedViews = { antraege, cutoffDatum, kategorien, persisted, verbundEmbeddings, stage2Aktiv, verbuende, value };
  return value;
}

/** Cache-Invalidierung — primaer fuer Tests; in der App nicht noetig, weil
 *  jede Mutation eine neue Array-Ref (oder Map-Ref) ueber den Store erzeugt
 *  und damit automatisch einen Cache-Miss ausloest. */
export function invalidateVerbundClassificationCache(): void {
  cachedViews = null;
  liveGen = null;
  liveKlCache = new Map();
}

function computeVerbundClassificationViews(
  antraege: readonly Antrag[],
  cutoffDatum: string | null,
  kategorien: readonly UeberKategorie[],
  persisted: readonly Klassifizierung[],
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined,
  stage2Aktiv: boolean,
  verbuende: readonly Verbund[],
): VerbundKlassifizierungsView[] {
  // Live-Cache verwerfen, sobald sich eine echte Live-Dep-Ref geaendert hat.
  // (Eine reine `persisted`-Aenderung — der Pill-Klick-Fall — laesst diese
  // Refs unberuehrt, der Cache greift also.)
  if (
    !liveGen
    || liveGen.antraege !== antraege
    || liveGen.kategorien !== kategorien
    || liveGen.verbundEmbeddings !== verbundEmbeddings
    || liveGen.stage2Aktiv !== stage2Aktiv
  ) {
    liveKlCache = new Map();
    liveGen = { antraege, kategorien, verbundEmbeddings, stage2Aktiv };
  }

  // 0) Pool filtern.
  const pool = cutoffDatum === null ? antraege : antraege.filter(a => istZuVerteilen(a, cutoffDatum));

  // 0a) verbuende-Map einmal pro Compute bauen. Bei Cache-Hit oben skipped.
  const verbuendeById = new Map<string, Verbund>();
  for (const v of verbuende) {
    if (v.verbund_id) verbuendeById.set(v.verbund_id, v);
  }

  // 1) Bucket nach Verbund-Key, Reihenfolge der ersten Sichtung beibehalten.
  const persistedById = new Map(persisted.map(k => [k.antragId, k]));
  const buckets = new Map<string, Antrag[]>();
  const order: string[] = [];
  for (const a of pool) {
    const key = verbundKeyOf(a);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.push(a);
  }

  // 2) Pro Bucket einen VerbundView bauen.
  const out: VerbundKlassifizierungsView[] = [];
  for (const key of order) {
    const tvs = buckets.get(key)!;
    // FKZ-Sortierung innerhalb des Verbundes (lexikografisch).
    tvs.sort((a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen, 'de'));
    const rep = tvs[0]!;
    // isSolo prueft die TV-Anzahl, NICHT ob verbund_id leer ist — sonst wuerde
    // ein Einzelantrag mit gesetzter verbund_id eine redundante TV-Sub-Row in
    // der Klassifizierungs-Tabelle bekommen (Header + 1 identische Sub-Row).
    const isSolo = tvs.length === 1;
    // Verbund-Level-Felder (akronym, titel) stehen NICHT auf dem Antrag-Objekt,
    // sondern im separaten `verbuende`-IDB-Store (CSV-Merger schreibt Felder
    // mit `level: 'verbund'` dort hin). Fallback auf Antrag-Felder fuer Solo-
    // Antraege ohne Verbund-Objekt.
    const { akronym, verbundTitel } = resolveVerbundMeta(verbuendeById.get(key), rep);

    // Persistierte Klassifizierung — pruefe alle TVs (sollten gleich sein,
    // nimm den ersten Treffer).
    let kl: Klassifizierung | undefined;
    for (const tv of tvs) {
      const found = persistedById.get(tv.aktenzeichen);
      if (found) { kl = found; break; }
    }

    if (!kl) {
      // Live klassifizieren auf Basis des repraesentativen TVs. Stage 2 nutzt
      // das Verbund-Titel-Embedding (NICHT das pro-TV-Embedding), damit der
      // Verbund-Titel maximale Gewichtung bekommt. Ergebnis pro Verbund-Key
      // cachen — bei reiner persisted-Aenderung (Pill-Klick) greift der Cache.
      const cached = liveKlCache.get(key);
      if (cached) {
        kl = cached;
      } else {
        const queryEmbedding = verbundEmbeddings?.get(key);
        const live = klassifiziereAntrag({
          antrag: rep,
          kategorien: kategorien as UeberKategorie[],
          queryEmbedding,
          stage2Aktiv,
        });
        // Re-Identify auf Verbund-Key — die persistierten Records bleiben pro
        // antragId, aber der live-Vorschlag braucht keine valide antragId.
        kl = { ...live, antragId: rep.aktenzeichen };
        liveKlCache.set(key, kl);
      }
    }

    out.push({
      verbundId: key,
      isSolo,
      akronym,
      verbundTitel,
      tvs,
      klassifizierung: kl,
      confidence: confidenceFor(kl),
    });
  }

  return out;
}

// ─── Zuweisungs-Tab: Verbund-Gruppierung der freigegebenen Klassifizierungen ──

export interface VerbundZuweisungRow {
  /** verbund_id, sonst aktenzeichen (Solo). */
  verbundId: string;
  /** Repraesentativer TV (erster in FKZ-Reihenfolge) — Selektion + Zuweisung
   *  laufen ueber dieses Aktenzeichen. */
  leadAktenzeichen: string;
  akronym: string;
  verbundTitel: string;
  /** Aktenzeichen aller TVs dieses Verbundes — fuer aggregierte Status-/Filter-
   *  Pruefung gegen die Zuweisungen. */
  tvAktenzeichen: string[];
  tvCount: number;
  /** Geteilte Klassifizierung des Verbundes (vom Lead-TV). */
  klassifizierung: Klassifizierung;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Gruppiert bereits auf `status==='freigegeben'` gefilterte per-TV-Views zu
 * EINER Zeile pro Verbund. Lead = erster TV in FKZ-Reihenfolge; alle TVs eines
 * Verbundes teilen Klassifizierung + confidence. Titel/Akronym via
 * `resolveVerbundMeta` (verbuende-Store mit Antrag-Fallback). Pure — testbar.
 */
export function groupFreigegebeneByVerbund(
  views: readonly KlassifizierungsView[],
  verbuendeById: ReadonlyMap<string, Verbund>,
): VerbundZuweisungRow[] {
  const buckets = new Map<string, KlassifizierungsView[]>();
  const order: string[] = [];
  for (const v of views) {
    const key = verbundKeyOf(v.antrag);
    let bucket = buckets.get(key);
    if (!bucket) { bucket = []; buckets.set(key, bucket); order.push(key); }
    bucket.push(v);
  }

  const out: VerbundZuweisungRow[] = [];
  for (const key of order) {
    const group = buckets.get(key)!;
    group.sort((a, b) => a.antrag.aktenzeichen.localeCompare(b.antrag.aktenzeichen, 'de'));
    const lead = group[0]!;
    const { akronym, verbundTitel } = resolveVerbundMeta(verbuendeById.get(key), lead.antrag);
    out.push({
      verbundId: key,
      leadAktenzeichen: lead.antrag.aktenzeichen,
      akronym,
      verbundTitel,
      tvAktenzeichen: group.map(g => g.antrag.aktenzeichen),
      tvCount: group.length,
      klassifizierung: lead.klassifizierung,
      confidence: lead.confidence,
    });
  }
  return out;
}
