/**
 * Auslastung — Embedding-Korpus Share-Sync (Selbstheilung auf neuem Rechner).
 *
 * Problem (v2.19): Die Embedding-Caches des Auslastungs-Moduls liegen
 * maschine-lokal in der IDB. Ein PL auf einem NEUEN Rechner hatte sie leer und
 * damit weder automatische Klassifizierung (Verbund-Embeddings) noch
 * kompetenzbasiertes Matching (per-Antrag-Korpus) — der Download/Build steckte
 * nur im zugeklappten „Erweitert"-Accordion (kurator-typisch). Zwei Lücken:
 *
 *  1. Der **per-Antrag-Korpus** (`auslastung-emb:*`) WIRD zwar auf den Share
 *     gespiegelt (core `mirror.ts`), aber der Auto-Download lief nur beim Mount
 *     der Admin-Section.
 *  2. Die **Verbund-Embeddings** (`auslastung-emb-verbund:*`, für die
 *     Klassifizierung) wurden bis dato GAR NICHT gespiegelt.
 *
 * Dieses Modul schließt beides:
 *  - spiegelt die Verbund-Embeddings als separate Sidecar-Dateien (Reuse der
 *    key-agnostischen core-Serializer `serializeCorpus`/`parseCorpus` — das
 *    Manifest-Feld `aktenzeichen` hält hier verbundIds);
 *  - bietet `ensureVerbundEmbeddings()` + `ensureAntragCorpus()` als
 *    „download-if-empty"-Schritt, der direkt in die bestehenden Lade-Pfade der
 *    Views eingehängt wird (kein separater Hintergrund-Hook → keine Race mit
 *    dem View-State). Beide sind idempotent (Count-Guard) und deduplizieren
 *    parallele Aufrufe über einen Modul-Inflight.
 *
 * Schreib-Profil der Verbund-Sidecars: `skipBackup` (rebuildbar) wie der
 * per-Antrag-Korpus (Pitfall #23). Modell-Wechsel ist team-weiter Bruch →
 * `checkCompat` gegen das aktive Modell blockiert das Laden inkompatibler
 * Vektoren (Pitfall #19).
 */
import type { StorageService } from '@/core/services/storage';
import { atomicWrite, readText, readBinary } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadManifest as loadAntragManifest,
  loadBin as loadAntragBin,
  parseCorpus,
  serializeCorpus,
  applyCorpusToIdb,
  checkCompat,
  hashAktenzeichenSet,
  countEmbeddings,
  type EmbeddingCorpusManifest,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import type { Antrag } from '@/core/services/csv/types';
import { getEmbeddableAktenzeichen } from './embedding-corpus';
import {
  loadAllVerbundEmbeddings,
  storeVerbundEmbedding,
  invalidateVerbundEmbeddingsCache,
  countVerbundEmbeddings,
} from './verbund-embedding';

export const VERBUND_CORPUS_MANIFEST_PATH = '_intern/auslastung-embedding-corpus-verbund.manifest.json';
export const VERBUND_CORPUS_BIN_PATH = '_intern/auslastung-embedding-corpus-verbund.bin';

/**
 * Ergebnis eines „download-if-empty"-Versuchs.
 *  - `already-present`: lokal schon befüllt → nichts getan.
 *  - `downloaded`: erfolgreich vom Share geladen.
 *  - `unavailable`: lokal leer, aber kein (lesbares) Manifest auf dem Share.
 *  - `incompatible`: Share-Korpus mit anderem Modell/Dim gebaut.
 *  - `hash-mismatch`: (nur per-Antrag) Share-Korpus deckt den aktuellen
 *    Antrags-Stand nicht ab.
 *  - `error`: IO/Parse-Fehler beim Download.
 */
export type CorpusSyncResult =
  | 'already-present'
  | 'downloaded'
  | 'unavailable'
  | 'incompatible'
  | 'hash-mismatch'
  | 'error';

async function activeModel(storage: StorageService): Promise<{ id: string; dim: number }> {
  const id = await getActiveModelId(storage.idb);
  return { id, dim: getModelById(id).dimensions };
}

// ───────────────────────────────────────────────────────────────────
// Verbund-Korpus Mirror (SMB-IO) — eigene Sidecars, Reuse core-Serializer
// ───────────────────────────────────────────────────────────────────

export async function loadVerbundManifest(
  storage: StorageService,
): Promise<EmbeddingCorpusManifest | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const text = await readText(handle, VERBUND_CORPUS_MANIFEST_PATH);
  if (text == null) return null;
  try {
    const parsed = JSON.parse(text) as EmbeddingCorpusManifest;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch (err) {
    console.warn('[corpus-share-sync] Verbund-Manifest-Parse fehlgeschlagen:', err);
    return null;
  }
}

async function loadVerbundBin(
  storage: StorageService,
  expectedBytes: number,
): Promise<ArrayBuffer | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const bytes = await readBinary(handle, VERBUND_CORPUS_BIN_PATH);
  if (bytes == null) return null;
  if (bytes.byteLength !== expectedBytes) {
    console.warn(
      `[corpus-share-sync] Verbund-Bin ${bytes.byteLength} != erwartet ${expectedBytes} — koennte korrupt sein.`,
    );
    return null;
  }
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/**
 * Spiegelt den lokalen Verbund-Embedding-Cache auf den Share. Caller hält
 * bereits den Build-Lock (läuft im selben `EmbeddingCorpusSection.build()`-
 * Block wie der per-Antrag-Upload). Soft-fail beim Caller — der lokale Build
 * bleibt gültig, nur die Share-Spiegelung hat ggf. nicht geklappt.
 */
export async function uploadVerbundCorpusToShare(
  storage: StorageService,
  modellId: string,
  dim: number,
  builderProfile?: string,
): Promise<void> {
  const embs = await loadAllVerbundEmbeddings(storage.idb);
  if (embs.size === 0) return;
  const { manifest, bin } = await serializeCorpus(embs, modellId, dim, builderProfile);
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) throw new Error('Daten-Share nicht verbunden.');
  // Bin zuerst, dann Manifest (atomarer Sichtbarkeits-Marker) — analog core.
  await atomicWrite(handle, VERBUND_CORPUS_BIN_PATH, new Uint8Array(bin), { skipBackup: true });
  await atomicWrite(handle, VERBUND_CORPUS_MANIFEST_PATH, JSON.stringify(manifest, null, 2), { skipBackup: true });
}

// ───────────────────────────────────────────────────────────────────
// download-if-empty (Selbstheilung beim Modul-/View-Open)
// ───────────────────────────────────────────────────────────────────

let verbundInflight: Promise<CorpusSyncResult> | null = null;
let antragInflight: Promise<CorpusSyncResult> | null = null;

async function downloadVerbundCorpusImpl(storage: StorageService): Promise<CorpusSyncResult> {
  if ((await countVerbundEmbeddings(storage.idb)) > 0) return 'already-present';
  const manifest = await loadVerbundManifest(storage);
  if (!manifest) return 'unavailable';
  const { id, dim } = await activeModel(storage);
  if (checkCompat(manifest, id, dim).kind !== 'compatible') return 'incompatible';
  try {
    const bin = await loadVerbundBin(storage, manifest.binBytes);
    if (!bin) return 'unavailable';
    const embs = parseCorpus(manifest, bin);
    for (const [verbundId, vec] of embs) {
      await storeVerbundEmbedding(storage.idb, verbundId, vec);
    }
    invalidateVerbundEmbeddingsCache();
    return 'downloaded';
  } catch (err) {
    console.warn('[corpus-share-sync] Verbund-Download fehlgeschlagen:', err);
    return 'error';
  }
}

/** Lädt den Verbund-Korpus vom Share, falls lokal leer + kompatibel. Dedupe
 *  paralleler Aufrufe über einen Modul-Inflight. */
export async function ensureVerbundCorpus(storage: StorageService): Promise<CorpusSyncResult> {
  if (verbundInflight) return verbundInflight;
  verbundInflight = (async () => {
    try {
      return await downloadVerbundCorpusImpl(storage);
    } finally {
      verbundInflight = null;
    }
  })();
  return verbundInflight;
}

/**
 * `ensureVerbundCorpus` + anschließendes Laden der Map — drop-in-Ersatz für
 * `loadAllVerbundEmbeddings` im Lade-Pfad der Klassifizierung. Gibt zusätzlich
 * das Sync-Ergebnis zurück, damit die View einen Hinweis-Banner zeigen kann,
 * wenn nichts ladbar war.
 */
export async function ensureVerbundEmbeddings(
  storage: StorageService,
): Promise<{ map: Map<string, number[]>; result: CorpusSyncResult }> {
  const result = await ensureVerbundCorpus(storage);
  const map = await loadAllVerbundEmbeddings(storage.idb);
  return { map, result };
}

async function downloadAntragCorpusImpl(
  storage: StorageService,
  antraege: Antrag[],
): Promise<CorpusSyncResult> {
  if ((await countEmbeddings(storage.idb)) > 0) return 'already-present';
  const manifest = await loadAntragManifest(storage);
  if (!manifest) return 'unavailable';
  const { id, dim } = await activeModel(storage);
  if (checkCompat(manifest, id, dim).kind !== 'compatible') return 'incompatible';
  const hash = await hashAktenzeichenSet(getEmbeddableAktenzeichen(antraege));
  if (manifest.aktenzeichenSetHash !== hash) return 'hash-mismatch';
  try {
    const bin = await loadAntragBin(storage, manifest.binBytes);
    if (!bin) return 'unavailable';
    const embs = parseCorpus(manifest, bin);
    await applyCorpusToIdb(storage.idb, embs);
    return 'downloaded';
  } catch (err) {
    console.warn('[corpus-share-sync] Antrag-Korpus-Download fehlgeschlagen:', err);
    return 'error';
  }
}

/** Lädt den per-Antrag-Korpus vom Share, falls lokal leer + kompatibel +
 *  Antrags-Stand passt. Dedupe paralleler Aufrufe über einen Modul-Inflight. */
export async function ensureAntragCorpus(
  storage: StorageService,
  antraege: Antrag[],
): Promise<CorpusSyncResult> {
  if (antragInflight) return antragInflight;
  antragInflight = (async () => {
    try {
      return await downloadAntragCorpusImpl(storage, antraege);
    } finally {
      antragInflight = null;
    }
  })();
  return antragInflight;
}
