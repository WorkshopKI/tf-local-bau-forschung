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
  CANONICAL_TIB_KUERZ,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  type Klassifizierung,
  type UeberKategorie,
} from '../types';
import { klassifiziereAntrag } from './klassifizierung-engine';
import { normalizeKuerzel } from './anonym-map';

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
  if (kl.vorgeschlageneKategorien.length === 0) return 'low';
  const top = kl.vorgeschlageneKategorien.reduce((a, b) => a.confidence > b.confidence ? a : b);
  if (top.confidence >= 0.7) return 'high';
  if (top.confidence >= 0.4) return 'medium';
  return 'low';
}

/** Eindeutige Verbund-Key fuer Bucketing — `verbund_id` falls gesetzt,
 *  sonst Solo-ID = `aktenzeichen`. */
export function verbundKeyOf(antrag: Antrag): string {
  const vid = readString(antrag, CANONICAL_VERBUND_ID);
  return vid.length > 0 ? vid : antrag.aktenzeichen;
}

// ─── Pool-Filterung (frueher in KlassifizierungsReview.istZuVerteilen) ──
// In den Service gezogen, damit der Closure-Cache auf `cache.antraege` keyen
// kann (Store-Ref, ref-stable ueber Re-Mount). Ein extern vor-gefiltertes
// Array kommt aus einem useMemo und ist beim Re-Mount instabil.

const POOL_EXCLUDED_STATUS = new Set(['abgelehnt/zurückgezogen', 'irrläufer']);

function istZuVerteilen(antrag: Antrag, jahr: number): boolean {
  const datum = (antrag as Record<string, unknown>)[CANONICAL_ANTRAGSDATUM];
  if (typeof datum !== 'string' || !datum.startsWith(`${jahr}-`)) return false;
  if (normalizeKuerzel((antrag as Record<string, unknown>)[CANONICAL_TIB_KUERZ]) !== null) return false;
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
  jahr: number | null;
  kategorien: readonly UeberKategorie[];
  persisted: readonly Klassifizierung[];
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined;
  stage2Aktiv: boolean;
  verbuende: readonly Verbund[];
  value: VerbundKlassifizierungsView[];
}

let cachedViews: CachedClassificationViews | null = null;

export function buildVerbundClassificationViews(
  antraege: readonly Antrag[],
  jahr: number | null,
  kategorien: readonly UeberKategorie[],
  persisted: readonly Klassifizierung[],
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined,
  stage2Aktiv: boolean,
  verbuende: readonly Verbund[],
): VerbundKlassifizierungsView[] {
  if (cachedViews
      && cachedViews.antraege === antraege
      && cachedViews.jahr === jahr
      && cachedViews.kategorien === kategorien
      && cachedViews.persisted === persisted
      && cachedViews.verbundEmbeddings === verbundEmbeddings
      && cachedViews.stage2Aktiv === stage2Aktiv
      && cachedViews.verbuende === verbuende) {
    return cachedViews.value;
  }
  const value = computeVerbundClassificationViews(
    antraege, jahr, kategorien, persisted, verbundEmbeddings, stage2Aktiv, verbuende,
  );
  cachedViews = { antraege, jahr, kategorien, persisted, verbundEmbeddings, stage2Aktiv, verbuende, value };
  return value;
}

/** Cache-Invalidierung — primaer fuer Tests; in der App nicht noetig, weil
 *  jede Mutation eine neue Array-Ref (oder Map-Ref) ueber den Store erzeugt
 *  und damit automatisch einen Cache-Miss ausloest. */
export function invalidateVerbundClassificationCache(): void {
  cachedViews = null;
}

function computeVerbundClassificationViews(
  antraege: readonly Antrag[],
  jahr: number | null,
  kategorien: readonly UeberKategorie[],
  persisted: readonly Klassifizierung[],
  verbundEmbeddings: ReadonlyMap<string, number[]> | undefined,
  stage2Aktiv: boolean,
  verbuende: readonly Verbund[],
): VerbundKlassifizierungsView[] {
  // 0) Pool filtern.
  const pool = jahr === null ? antraege : antraege.filter(a => istZuVerteilen(a, jahr));

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
    const verbund = verbuendeById.get(key);
    const akronym = (verbund?.akronym && verbund.akronym.length > 0)
      ? verbund.akronym
      : readString(rep, CANONICAL_AKRONYM);
    const verbundTitel = (verbund?.titel && verbund.titel.length > 0)
      ? verbund.titel
      : readString(rep, CANONICAL_VERBUND_TITEL) || readString(rep, CANONICAL_TITEL);

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
      // Verbund-Titel maximale Gewichtung bekommt.
      const queryEmbedding = verbundEmbeddings?.get(key);
      kl = klassifiziereAntrag({
        antrag: rep,
        kategorien: kategorien as UeberKategorie[],
        queryEmbedding,
        stage2Aktiv,
      });
      // Re-Identify auf Verbund-Key — die persistierten Records bleiben pro
      // antragId, aber der live-Vorschlag braucht keine valide antragId.
      kl = { ...kl, antragId: rep.aktenzeichen };
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
