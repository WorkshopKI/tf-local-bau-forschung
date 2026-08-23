/**
 * Verbund-Embedding-Korpus.
 *
 * Separater IDB-Storage neben dem Antrag-Embedding-Korpus
 * (`auslastung-emb:<aktenzeichen>`), damit `loadAllEmbeddings` aus
 * `@/core/services/embedding-corpus` nicht versehentlich Verbund-Vektoren
 * mit ausliefert. Prefix: `auslastung-emb-verbund:<verbund_id>`.
 *
 * Embedding-Text: nur `verbund_titel` (+ `akronym` als Anchor). TV-spezifische
 * Felder fliessen NICHT ein — der Verbund-Titel soll fuer die Klassifizierung
 * maximale Gewichtung bekommen (User-Entscheidung).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_AKRONYM,
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  FIELD_VORHABEN_ZUSAMMENFASSUNG_AST,
  FIELD_VORHABEN_ZUSAMMENFASSUNG_PDF,
} from '../../types';
import {
  ensureEmbeddingReady,
  erzeugeErholer,
  embedMitErholung,
  type EmbeddingGeraet,
  type ErholungsMeldung,
} from '@/core/services/embedding-corpus';
import { verbundKeyOf } from '../verbund/verbund-aggregation';
import { FEHLERSERIE_ABBRUCH, type BuildAbbruchGrund } from './embedding-corpus';

const VERBUND_EMB_PREFIX = 'auslastung-emb-verbund:';

function idbKey(key: string): string {
  return `${VERBUND_EMB_PREFIX}${key}`;
}

function readString(antrag: Antrag, key: string): string {
  const v = (antrag as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

// ───────────────────────────────────────────────────────────────────────────
// Storage
// ───────────────────────────────────────────────────────────────────────────

export async function loadVerbundEmbedding(idb: IDBStore, verbundId: string): Promise<number[] | null> {
  const value = await idb.get<number[]>(idbKey(verbundId));
  return Array.isArray(value) ? value : null;
}

export async function storeVerbundEmbedding(
  idb: IDBStore,
  verbundId: string,
  vector: number[],
): Promise<void> {
  await idb.set(idbKey(verbundId), vector);
  // Single-Eintrag-Updates invalidieren den Cache nicht — der naechste
  // `loadAllVerbundEmbeddings`-Call wuerde sonst stale Daten liefern.
  // Aktuell wird storeVerbundEmbedding nur vom Corpus-Build genutzt, der
  // selbst `invalidateVerbundEmbeddingsCache()` ruft. Falls das spaeter
  // ausserhalb des Builds passiert, dort die Cache-Invalidierung mitziehen.
}

// ─── Module-globaler Cache (ueberlebt Komponenten-Unmount) ───────────────
// KlassifizierungsReview.useEffect ruft `loadAllVerbundEmbeddings(idb)` auf
// jedem Mount → bei Plugin-Wechsel (Auslastung → Förderanträge → Auslastung)
// triggerte das einen vollen IDB-Scan ueber 400+ Verbuende (~300-500 ms).
// Cache keyed auf `idb`-Identity, weil das `IDBStore`-Objekt waehrend der
// App-Session stabil ist (kommt aus dem Storage-Singleton).

let cachedEmbeddings: { idb: IDBStore; map: Map<string, number[]> } | null = null;
/** In-Flight-Load (Dedupe): mehrere Consumer beim Modul-Open sollen sich EINEN
 *  ~44-MB-Scan teilen, statt ihn parallel doppelt zu fahren. */
let inflightLoad: { idb: IDBStore; promise: Promise<Map<string, number[]>> } | null = null;

/** Vollstaendige Map aller persistierten Verbund-Embeddings. Cached auf
 *  `idb`-Identity — Folge-Calls innerhalb derselben App-Session liefern den
 *  gecachten Wert ohne IDB-Roundtrip. Cache wird beim Corpus-Rebuild via
 *  `invalidateVerbundEmbeddingsCache()` invalidiert. */
export async function loadAllVerbundEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  if (cachedEmbeddings && cachedEmbeddings.idb === idb) {
    return cachedEmbeddings.map;
  }
  if (inflightLoad && inflightLoad.idb === idb) {
    return inflightLoad.promise;
  }
  // Bulk-Read in EINER Transaktion (Cursor) statt `keys()` + N einzelne
  // `get()`-Roundtrips: bei 7000+ Verbünden war der alte N+1-Pfad ein großer
  // Teil des Cold-Loads. `entries()` ist genau dafür gebaut. Identisches
  // Ergebnis (Map<verbundId, vector>).
  const promise = (async () => {
    const entries = await idb.entries(VERBUND_EMB_PREFIX);
    const result = new Map<string, number[]>();
    for (const [k, v] of entries) {
      if (Array.isArray(v)) result.set(k.slice(VERBUND_EMB_PREFIX.length), v as number[]);
    }
    cachedEmbeddings = { idb, map: result };
    return result;
  })();
  inflightLoad = { idb, promise };
  try {
    return await promise;
  } finally {
    if (inflightLoad && inflightLoad.idb === idb) inflightLoad = null;
  }
}

/** Cache invalidieren — Caller: `EmbeddingCorpusSection.buildCorpus` nach
 *  erfolgreichem Rebuild des Verbund-Korpus. Sonst wuerde der naechste
 *  Load die stale Daten zurueckgeben. */
export function invalidateVerbundEmbeddingsCache(): void {
  cachedEmbeddings = null;
  inflightLoad = null;
}

/** Synchroner Cache-Read fuer den useState-Initializer in
 *  KlassifizierungsReview. Liefert die gecachte Map wenn vorhanden, sonst null
 *  (kein async-Load — den uebernimmt der nachgelagerte useEffect). Spart
 *  beim Re-Mount einen Render-Cycle: erster Render hat schon Stage 2 statt
 *  zwischendurch ohne Embeddings zu rendern und im naechsten Render
 *  Stage-2-Recompute auszuloesen. */
export function getCachedVerbundEmbeddings(idb: IDBStore): Map<string, number[]> | null {
  if (cachedEmbeddings && cachedEmbeddings.idb === idb) {
    return cachedEmbeddings.map;
  }
  return null;
}

export async function listVerbundEmbeddingKeys(idb: IDBStore): Promise<Set<string>> {
  const keys = await idb.keys(VERBUND_EMB_PREFIX);
  const result = new Set<string>();
  for (const k of keys) result.add(k.slice(VERBUND_EMB_PREFIX.length));
  return result;
}

export async function countVerbundEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(VERBUND_EMB_PREFIX);
  return keys.length;
}

export async function clearVerbundEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(VERBUND_EMB_PREFIX);
  for (const k of keys) await idb.delete(k);
  return keys.length;
}

// ───────────────────────────────────────────────────────────────────────────
// Text-Builder + Build-Pipeline
// ───────────────────────────────────────────────────────────────────────────

/**
 * Embedding-Text fuer einen Verbund. Reihenfolge:
 *  1. Verbund-Titel (Anker, immer da)
 *  2. Akronym (Kurz-Anker)
 *  3. Antragsteller-Zusammenfassung (AST, 100–300 Worte, fuer neue Antraege —
 *     Feld wird elektronisch erfasst sobald verfuegbar)
 *  4. PDF-Zusammenfassung (LLM-extrahiert aus der Vorhabensbeschreibung;
 *     gibt es noch nicht im Schema)
 *  5. VB_Inhalt (`projektbeschreibung_text`) — Bearbeiter-Zusammenfassung,
 *     nur fuer historische, bereits bewilligte Antraege gefuellt
 *
 * Die optionalen Felder (3–5) decken sich inhaltlich (alle: Themen-
 * Zusammenfassung des Vorhabens), kommen aber von verschiedenen Quellen.
 * Sie fliessen alle ein, weil sie sich in der Praxis ergaenzen statt
 * konkurrieren — fuer einen Verbund ist meist nur eine davon gefuellt.
 *
 * Wir nehmen den Verbund-Titel des **ersten** TVs als Quelle — alle TVs
 * eines Verbundes haben definitionsgemaess den gleichen `verbund_titel`.
 * Fallback bei Solo-TVs: TV-Titel. Custom-Felder sind ebenfalls auf
 * Verbund-Ebene gepflegt (gleicher Wert ueber alle TVs).
 *
 * Cap bei 4000 Zeichen fuer Modell-Token-Limit. Reihenfolge prioritaer:
 * der wichtigste Anker (Titel + Akronym) steht vorne, damit er beim Cap
 * nicht abgeschnitten wird.
 */
export function buildVerbundEmbeddingText(tvs: Antrag[]): string {
  if (tvs.length === 0) return '';
  const rep = tvs[0]!;
  const fields = [
    readString(rep, CANONICAL_VERBUND_TITEL) || readString(rep, CANONICAL_TITEL),
    readString(rep, CANONICAL_AKRONYM),
    readString(rep, FIELD_VORHABEN_ZUSAMMENFASSUNG_AST),
    readString(rep, FIELD_VORHABEN_ZUSAMMENFASSUNG_PDF),
    readString(rep, FIELD_PROJEKTBESCHREIBUNG),
  ];
  const parts: string[] = [];
  for (const f of fields) {
    if (f.trim()) parts.push(f.trim());
  }
  return parts.join(' \n ').slice(0, 4000);
}

/** Buckette Antraege nach Verbund-Key (verbund_id oder Solo-aktenzeichen). */
export function bucketAntraegeByVerbund(antraege: Antrag[]): Map<string, Antrag[]> {
  const map = new Map<string, Antrag[]>();
  for (const a of antraege) {
    const key = verbundKeyOf(a);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    bucket.push(a);
  }
  return map;
}

export interface VerbundBuildProgress {
  done: number;
  total: number;
  lastVerbundId?: string;
}

export interface VerbundBuildOptions {
  onProgress?: (p: VerbundBuildProgress) => void;
  signal?: AbortSignal;
  incremental?: boolean;
  /** Siehe {@link BuildOptions} — dasselbe Nachladen, dieselbe Anzeige. */
  onLadenBeginnt?: (geraet: EmbeddingGeraet, nummer: number) => void;
  onErholt?: (m: ErholungsMeldung) => void;
}

export interface VerbundBuildErgebnis {
  done: number;
  /** `ohneText + fehlgeschlagen` — siehe {@link BuildErgebnis}. */
  skipped: number;
  ohneText: number;
  fehlgeschlagen: number;
  aborted: boolean;
  abbruchGrund?: BuildAbbruchGrund;
  ersterFehler?: string;
  /** Jede Erholung von einem Geraeteverlust in DIESER Phase. */
  erholungen: readonly ErholungsMeldung[];
}

/**
 * Welche Verbuende dieser Lauf anfassen wird — **vor** dem Lauf.
 *
 * Der Fortschrittsbalken braucht die Gesamtzahl beider Phasen, bevor die erste
 * beginnt; sonst kann er nur je Phase von vorne zaehlen (und tat das: zweimal
 * 0→100). Die Queue-Regel darf dafuer aber nicht ein zweites Mal aufgeschrieben
 * werden — `buildVerbundEmbeddingCorpus` ruft genau diese Funktion.
 */
export async function planeVerbundQueue(
  idb: IDBStore,
  antraege: Antrag[],
  incremental: boolean,
): Promise<Array<{ verbundId: string; tvs: Antrag[] }>> {
  const buckets = bucketAntraegeByVerbund(antraege);
  const existing = incremental ? await listVerbundEmbeddingKeys(idb) : new Set<string>();

  const queue: Array<{ verbundId: string; tvs: Antrag[] }> = [];
  for (const [verbundId, tvs] of buckets.entries()) {
    if (!incremental || !existing.has(verbundId)) {
      queue.push({ verbundId, tvs });
    }
  }
  return queue;
}

/**
 * Iteriert pro Verbund (dedupliziert ueber `verbund_id` bzw. Solo-aktenzeichen),
 * embed't den Verbund-Text und persistiert.
 */
export async function buildVerbundEmbeddingCorpus(
  idb: IDBStore,
  antraege: Antrag[],
  opts: VerbundBuildOptions = {},
): Promise<VerbundBuildErgebnis> {
  const incremental = opts.incremental ?? true;
  await ensureEmbeddingReady(idb);

  const queue = await planeVerbundQueue(idb, antraege, incremental);

  const total = queue.length;
  let done = 0;
  let ohneText = 0;
  let fehlgeschlagen = 0;
  let serie = 0;
  let ersterFehler: string | undefined;
  const erholer = erzeugeErholer(idb, {
    onLadenBeginnt: opts.onLadenBeginnt,
    onErholt: opts.onErholt,
  });

  const ergebnis = (
    aborted: boolean,
    abbruchGrund?: BuildAbbruchGrund,
  ): VerbundBuildErgebnis => ({
    done,
    skipped: ohneText + fehlgeschlagen,
    ohneText,
    fehlgeschlagen,
    aborted,
    abbruchGrund,
    ersterFehler,
    erholungen: erholer.meldungen,
  });

  for (const { verbundId, tvs } of queue) {
    if (opts.signal?.aborted) {
      return ergebnis(true, 'nutzer');
    }
    const text = buildVerbundEmbeddingText(tvs);
    if (!text) {
      ohneText++;
      done++;
      opts.onProgress?.({ done, total, lastVerbundId: verbundId });
      continue;
    }
    try {
      const vec = await embedMitErholung(text, 'document', erholer);
      await storeVerbundEmbedding(idb, verbundId, vec);
      done++;
      serie = 0;
      opts.onProgress?.({ done, total, lastVerbundId: verbundId });
    } catch (err) {
      if (ersterFehler === undefined) {
        ersterFehler = err instanceof Error ? err.message : String(err);
        console.error(`[verbund-embedding] embed failed for ${verbundId}:`, err);
      } else {
        console.warn(`[verbund-embedding] embed failed for ${verbundId}:`, err);
      }
      fehlgeschlagen++;
      serie++;
      done++;
      opts.onProgress?.({ done, total, lastVerbundId: verbundId });
      // Siehe FEHLERSERIE_ABBRUCH: eine tote Pipeline soll nicht durch 7.535
      // Verbuende rauschen und danach „fertig" melden.
      if (serie >= FEHLERSERIE_ABBRUCH) {
        console.error(
          `[verbund-embedding] ${serie} Fehlschlaege hintereinander — Lauf abgebrochen `
          + `(${done} von ${total} durchlaufen). Erster Fehler: ${ersterFehler}`,
        );
        return ergebnis(true, 'fehlerserie');
      }
    }
    await new Promise(r => setTimeout(r, 0));
  }

  return ergebnis(false);
}
