import { create, upsert, remove, search, save, load, count,
  type Orama, type Results } from '@orama/orama';
import { pipelineLog } from './pipeline-logger';

export interface OramaDoc {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string;
  type: string;
  embedding: number[];
}

export interface OramaSearchResult {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string[];
  type: string;
  score: number;
  method: 'fulltext' | 'vector' | 'hybrid';
}

/**
 * Sprache des Volltext-Tokenizers — die Worttrennung des gesamten Dokumenten-Index.
 *
 * Orama trennt Wörter über ein Zeichenklassen-Muster pro Sprache. Das englische
 * Muster (`[^A-Za-zàèéìòóù0-9_'-]+`) kennt `ä ö ü ß` NICHT und behandelt sie als
 * Trennzeichen: „Fördergeber" zerfiel damit in `f` + `rdergeber`, „Größe" in
 * `gr` + `e`. Weil Anfrage und Index dieselbe Trennung benutzten, fand die Suche
 * zwar noch etwas — aber über Bruchstücke: am echten Textbestand entstanden so
 * 20 338 statt 14 778 verschiedene Token, darunter Rauschen wie `f` (859×) oder
 * `r` (626×), das jedes Umlautwort miteinander verband und die BM25-Wertung
 * verzerrte. 1 217 verschiedene Wörter zerriss die englische Trennung.
 *
 * Das deutsche Muster (`[^a-z0-9A-ZäöüÄÖÜß]+`) hält Umlautwörter zusammen und
 * trennt zusätzlich an `-` und `_`, wodurch „ZIM-Kooperationsprojekt" auch über
 * `kooperationsprojekt` auffindbar wird. Die anschließende Normalisierung faltet
 * Umlaute ohnehin (`förderung` → `forderung`), auf beiden Seiten gleich.
 *
 * KEIN Stemming: das bliebe ohne `@orama/stemmers` unmöglich (Orama wirft
 * `MISSING_STEMMER`) und wäre ein zweiter, eigener Eingriff.
 *
 * **Ein Index, der mit einer anderen Sprache gebaut wurde, bleibt lesbar.**
 * `load()` setzt `tokenizer.language` auf den gespeicherten Wert zurück — der
 * Alt-Index bleibt also in sich stimmig und die Suche läuft weiter wie bisher.
 * Er wird dadurch aber nicht besser: erst ein Vollindexlauf hebt ihn. Genau
 * deshalb erkennt {@link indexSpracheVeraltet} den Zustand, statt ihn zu heilen.
 */
export const INDEX_SPRACHE = 'german';

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: Orama<any> | null = null;
let currentDimensions: number | null = null;
let docChunkCounts: Record<string, number> | null = null;

const IDB_DIMENSIONS_KEY = 'orama-dimensions';

/**
 * Sprache, mit der ein serialisierter Index gebaut wurde — `save()` schreibt sie mit.
 * `null`, wenn die Rohdaten sie nicht führen (dann ist die Herkunft unbekannt und
 * wird bewusst NICHT geraten).
 */
export function spracheAusIndex(rohdaten: unknown): string | null {
  const sprache = (rohdaten as { language?: unknown } | null)?.language;
  return typeof sprache === 'string' && sprache.length > 0 ? sprache : null;
}

/** Sprache des GELADENEN Index; `null`, solange keiner geladen ist. */
export function getIndexSprache(): string | null {
  if (!db) return null;
  return spracheAusIndex({ language: (db as any).tokenizer?.language });
}

/**
 * Die Regel selbst, an einer Stelle: eine Sprache, die es GIBT und nicht die
 * aktuelle ist. Eine unbekannte Sprache (`null`) zählt ausdrücklich NICHT als
 * veraltet — ohne Beleg wird weder gewarnt noch ein Neuaufbau erzwungen.
 */
export function spracheVeraltet(sprache: string | null): boolean {
  return sprache !== null && sprache !== INDEX_SPRACHE;
}

/**
 * Der geladene Index stammt aus einer Fassung mit anderer Worttrennung.
 * Kein Fehler — nur ein Grund für einen Vollindexlauf (siehe {@link INDEX_SPRACHE}).
 */
export function indexSpracheVeraltet(): boolean {
  return spracheVeraltet(getIndexSprache());
}

export async function saveOramaDimensions(
  idb: { set: (key: string, value: unknown) => Promise<void> },
  dimensions: number,
): Promise<void> {
  await idb.set(IDB_DIMENSIONS_KEY, dimensions);
}

export async function getStoredDimensions(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<number | null> {
  return idb.get<number>(IDB_DIMENSIONS_KEY);
}

/**
 * Lädt die Chunk-Counts pro Dokument aus IDB.
 * Wird einmal beim App-Start aufgerufen.
 */
export async function loadDocChunkCounts(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<void> {
  docChunkCounts = await idb.get<Record<string, number>>('doc-chunk-counts');
}

/**
 * Normalisiert den Score basierend auf der Chunk-Anzahl des Quelldokuments.
 * Lange Dokumente (viele Chunks) werden abgestraft.
 * Formel: score * (1 / log2(chunkCount + 1))
 *
 * Beispiele:
 *   5 Chunks  → Faktor 0.39
 *   20 Chunks → Faktor 0.22
 *   100 Chunks → Faktor 0.15
 */
function normalizeScore(score: number, source: string): number {
  if (!docChunkCounts) return score;
  const count = docChunkCounts[source];
  if (!count || count <= 1) return score;
  return score * (1 / Math.log2(count + 1));
}

export function createOramaDB(vectorDimensions: number): void {
  currentDimensions = vectorDimensions;
  db = create({
    schema: {
      id: 'string',
      text: 'string',
      title: 'string',
      source: 'string',
      tags: 'string',
      type: 'string',
      embedding: `vector[${vectorDimensions}]`,
    } as any,
    language: INDEX_SPRACHE,
  } as any);
  pipelineLog.info('Orama', `Neue DB erstellt: vector[${vectorDimensions}], Worttrennung ${INDEX_SPRACHE}`);
}

/**
 * Stellt sicher, dass überhaupt eine DB existiert — legt sie nur an, wenn keine da ist.
 *
 * Ohne das kann eine Dokumentablage auf einem Rechner, auf dem nie ein Vollindexlauf
 * lief (frische Variant-IDB, kein Index vom Share), NIE gelingen: `createOramaDB` rief
 * bisher nur der Seed und der Kurator-Vollindexlauf, und `insertDoc` warf entsprechend
 * „Orama not initialized". Der Ablage-Pfad legt die DB jetzt selbst an.
 *
 * Bewusst NICHT in `insertDoc` versteckt: der Aufrufer kennt die Vektor-Dimension und
 * muss sie nach dem Anlegen auch persistieren (`saveOramaDimensions`) — sonst baut
 * `loadOramaFromDB` beim nächsten Start ein Schema ohne `embedding`-Feld.
 *
 * @returns true, wenn in diesem Aufruf eine neue (leere) DB entstanden ist.
 */
export function ensureOramaDB(vectorDimensions: number): boolean {
  if (db) return false;
  createOramaDB(vectorDimensions);
  return true;
}

export function getCurrentDimensions(): number | null {
  return currentDimensions;
}

export function getOramaDB(): Orama<any> | null {
  return db;
}

export function saveOramaToDB(
  idb: { set: (key: string, value: unknown) => Promise<void> },
): Promise<void> {
  if (!db) return Promise.resolve();
  const data = save(db);
  return idb.set('orama-db', data);
}

/** Trailing-Fenster für `persistOramaSoon` (ms). */
const PERSIST_DEBOUNCE_MS = 1500;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistRunning: Promise<void> = Promise.resolve();

/**
 * Speichert den Index nachlaufend und koaleszierend.
 *
 * `save(db)` serialisiert IMMER den kompletten Index — ein Drop von fünf Dateien würde
 * sonst fünf Vollserialisierungen auslösen. Mehrere Aufrufe innerhalb des Fensters
 * ergeben genau einen Schreibvorgang; überlappende Schreibläufe werden verkettet.
 * Bewusst fire-and-forget: die Ablage darf nicht auf das Persistieren warten.
 */
export function persistOramaSoon(
  idb: { set: (key: string, value: unknown) => Promise<void> },
): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistRunning = persistRunning
      .then(() => saveOramaToDB(idb))
      .catch(err => { pipelineLog.warn('Orama', `Index speichern fehlgeschlagen: ${err}`); });
  }, PERSIST_DEBOUNCE_MS);
}

/** Wartet auf einen ausstehenden `persistOramaSoon`-Lauf (Tests, Teardown). */
export async function flushOramaPersist(
  idb: { set: (key: string, value: unknown) => Promise<void> },
): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistRunning = persistRunning.then(() => saveOramaToDB(idb));
  }
  await persistRunning;
}

/**
 * Prüft ob der Vektor-Index nach dem Laden funktioniert.
 * Gibt false zurück wenn alle Vektoren identisch/kaputt sind.
 */
function verifyVectorIndex(): boolean {
  if (!db) return false;
  try {
    const dims = currentDimensions ?? 768;
    const testVec = new Array(dims).fill(0);
    testVec[0] = 1;

    const results = search(db, {
      mode: 'vector',
      vector: { value: testVec, property: 'embedding' },
      similarity: 0.0,
      limit: 3,
    } as any) as any;

    if (!results?.hits || results.hits.length === 0) {
      pipelineLog.warn('Orama', 'Vektor-Index leer nach dem Laden');
      return false;
    }

    const scores = results.hits.map((h: any) => h.score);
    const allSame = scores.length > 1 && scores.every((s: number) => s === scores[0]);
    if (allSame) {
      pipelineLog.warn('Orama', `Vektor-Index defekt: alle ${scores.length} Scores identisch (${scores[0]})`);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function loadOramaFromDB(
  idb: { get: <T>(key: string) => Promise<T | null> },
  expectedDimensions?: number,
): Promise<boolean> {
  if (expectedDimensions) {
    const stored = await idb.get<number>(IDB_DIMENSIONS_KEY);
    if (stored && stored !== expectedDimensions) {
      pipelineLog.warn('Orama', `Dimensions-Mismatch: gespeichert=${stored}, erwartet=${expectedDimensions} — DB wird nicht geladen`);
      db = null;
      return false;
    }
  }

  const data = await idb.get<Record<string, unknown>>('orama-db');
  if (!data) return false;

  const dimensions = await idb.get<number>(IDB_DIMENSIONS_KEY);

  try {
    const schema: Record<string, string> = {
      id: 'string',
      text: 'string',
      title: 'string',
      source: 'string',
      tags: 'string',
      type: 'string',
    };

    if (dimensions) {
      schema.embedding = `vector[${dimensions}]`;
      currentDimensions = dimensions;
    }

    db = create({ schema, language: INDEX_SPRACHE } as any);
    // `load` setzt `tokenizer.language` auf die im Index gespeicherte Sprache zurück
    // und überschreibt damit die Zeile darüber. Das ist gewollt: ein Alt-Index bleibt
    // so in sich stimmig (Anfrage und Index trennen gleich) statt stumm zu werden.
    load(db!, data as any);

    pipelineLog.info('Orama', `DB geladen: ${count(db!)} Dokumente, ${dimensions ? dimensions + 'd Vektoren' : 'keine Vektoren'}`);
    if (indexSpracheVeraltet()) {
      pipelineLog.warn('Orama', `Index mit Worttrennung „${getIndexSprache()}" gebaut (erwartet: „${INDEX_SPRACHE}") — bleibt nutzbar, ein Vollindexlauf hebt ihn`);
    }

    if (dimensions && !verifyVectorIndex()) {
      pipelineLog.warn('Orama', 'Vektor-Index defekt nach Laden — Neuindexierung empfohlen');
    }

    return true;
  } catch (err) {
    pipelineLog.warn('Orama', `DB laden fehlgeschlagen: ${err}`);
    db = null;
    return false;
  }
}

export function insertDoc(doc: OramaDoc): void {
  if (!db) throw new Error('Orama not initialized');
  upsert(db, doc as any);
}

export function removeDoc(id: string): void {
  if (!db) return;
  try { remove(db, id); } catch { /* not found */ }
}

/**
 * Dedupliziert Suchergebnisse: Maximal maxPerDoc Chunks pro Quelldokument.
 * Identifiziert Dokumente anhand des `source`-Feldes (Dateiname).
 */
function deduplicateBySource(
  results: OramaSearchResult[],
  maxPerDoc: number,
): OramaSearchResult[] {
  const counts = new Map<string, number>();
  return results.filter(r => {
    const key = r.source;
    const current = counts.get(key) ?? 0;
    if (current >= maxPerDoc) return false;
    counts.set(key, current + 1);
    return true;
  });
}

export function hybridSearch(
  query: string,
  queryVector: number[] | null,
  options?: { type?: string; limit?: number; maxPerDoc?: number; threshold?: number },
): OramaSearchResult[] {
  if (!db) return [];

  const limit = options?.limit ?? 10;
  const maxPerDoc = options?.maxPerDoc ?? 2;
  // Mehr Kandidaten holen um nach Deduplizierung genug zu haben
  const fetchLimit = limit * 3;
  const where = options?.type ? { type: options.type } : undefined;
  // Verknüpfung mehrerer Suchwörter. Orama kennt keine Booleschen Operatoren im
  // `term`; `threshold` ist die Stellschraube: 0 = nur Dokumente mit ALLEN
  // Tokens (UND), 1 = irgendeines genügt (ODER). Ohne Angabe bleibt Oramas
  // Laufzeit-Default 1 — was jahrelang stillschweigend ODER bedeutete, obwohl
  // die JSDoc der Bibliothek „0" behauptet. Der Wert wandert deshalb bewusst
  // explizit durch, statt sich auf den Default zu verlassen.
  const threshold = options?.threshold;

  let results: Results<any> | Promise<Results<any>>;

  if (queryVector && queryVector.length > 0) {
    results = search(db, {
      mode: 'hybrid',
      term: query,
      vector: { value: queryVector, property: 'embedding' },
      similarity: 0.2,
      limit: fetchLimit,
      where,
      threshold,
    } as any);
  } else {
    results = search(db, {
      mode: 'fulltext',
      term: query,
      limit: fetchLimit,
      where,
      threshold,
    } as any);
  }

  // Orama's search() is sync in v3 but typed as sync|async — cast safely
  const syncResults = results as Results<any>;

  const mapped = syncResults.hits.map(hit => {
    const doc = hit.document as Record<string, unknown>;
    return {
      id: doc.id as string,
      text: doc.text as string,
      title: doc.title as string,
      source: doc.source as string,
      tags: ((doc.tags as string) ?? '').split(',').filter(Boolean),
      type: doc.type as string,
      score: normalizeScore(hit.score, doc.source as string),
      method: queryVector ? 'hybrid' as const : 'fulltext' as const,
    };
  });

  // Nach Normalisierung neu sortieren (Scores haben sich verändert)
  mapped.sort((a, b) => b.score - a.score);
  const final = deduplicateBySource(mapped, maxPerDoc).slice(0, limit);

  if (final.length > 3) {
    const scores = final.map(r => r.score);
    const allSame = scores.every(s => s === scores[0]);
    if (allSame) {
      pipelineLog.warn('Orama', `WARNUNG: Alle ${final.length} Scores identisch (${scores[0]?.toFixed(4)}). Moeglicherweise Dimensions-Mismatch oder defekte Embeddings.`);
    }
  }

  pipelineLog.info('Orama', `${queryVector ? 'hybrid' : 'fulltext'}: ${syncResults.hits.length} Treffer → ${final.length} nach Dedup`);
  return final;
}

export function getDocCount(): number {
  if (!db) return 0;
  return count(db);
}

export function destroyOrama(): void {
  // Ausstehendes Persistieren verwerfen — sonst schreibt der Trailing-Timer den
  // gerade verworfenen Stand noch in die IDB.
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  db = null;
}
