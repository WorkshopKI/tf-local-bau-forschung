/**
 * Embedding-Corpus-Mirror — spiegelt den lokalen IDB-Cache auf den
 * SMB-Daten-Share, damit ein zweiter PL den Korpus nicht 46 min neu
 * bauen muss.
 *
 * Zwei Sidecar-Dateien:
 *  - `_intern/auslastung-embedding-corpus.manifest.json` (klein, Metadaten)
 *  - `_intern/auslastung-embedding-corpus.bin`           (~40 MB, konkat. float32)
 *
 * **Backward-Compat:** Filenames bleiben `auslastung-*`. Umbenennen wuerde
 * geteilte Korpora fuer Teammitglieder unsichtbar machen, bis jemand neu
 * baut + hochlaedt.
 *
 * Kompat-Modell:
 *  - Modell-Wechsel ist team-weiter Bruch → Manifest mit `modellId + dim`
 *    blockiert das Laden, wenn lokal ein anderes Modell aktiv ist.
 *  - Antraege-Drift wird ueber `aktenzeichenSetHash` (SHA-256 ueber die
 *    sortierten aktenzeichen) erkannt — Mismatch → Hinweis im UI,
 *    inkrementell neu bauen empfohlen.
 *  - `corpusBuildVersion` + `documentPrefix` markieren den VEKTORRAUM — welcher
 *    Text und welcher Praefix die Vektoren erzeugt hat
 *    ([signatur.ts](./signatur.ts)).
 *
 * Sicherheit: Klartext-Vektoren. Sie enthalten keine Klartext-Antrags-
 * inhalte zurueck (Embeddings sind nicht umkehrbar), aber strukturelle
 * Aehnlichkeits-Information. Die antraege selbst liegen ohnehin im
 * Klartext auf dem Daten-Share (CSV-Imports) — keine zusaetzliche
 * Anonymitaets-Schwaechung.
 */
import type { StorageService } from '@/core/services/storage';
import {
  atomicWrite, atomicWriteStream, readText, readBinary,
} from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { storeEmbedding } from './storage';
import { CORPUS_BUILD_VERSION } from './signatur';
import type { IDBStore } from '@/core/services/storage/idb-store';

export const CORPUS_MANIFEST_PATH = '_intern/auslastung-embedding-corpus.manifest.json';
export const CORPUS_BIN_PATH = '_intern/auslastung-embedding-corpus.bin';


export interface EmbeddingCorpusManifest {
  version: 1;
  /** Modell-ID aus `model-registry.ts` (z.B. "embeddinggemma-300m"). */
  modellId: string;
  /** Vektor-Dimension (768/640/1024/...). */
  dim: number;
  /** Anzahl Embeddings in der Bin-Datei. */
  antraegeCount: number;
  /** ISO-Datum des Builds. */
  builtAt: string;
  /** Profil-Name des bauenden Users (nur Notiz, nicht security). */
  builderProfile?: string;
  /** SHA-256 der sortierten aktenzeichen-Liste — Drift-Detection ohne
   *  content-hash. */
  aktenzeichenSetHash: string;
  /** Liste der aktenzeichen in der Reihenfolge wie in der .bin-Datei. */
  aktenzeichen: string[];
  /** Format der Bin: aktuell "f32-stream" = concat(vektor1, vektor2, ...). */
  binFormat: 'f32-stream';
  /** Sanity-Check: erwartete Bytes der .bin (count × dim × 4). */
  binBytes: number;
  /** Inhaltliche Build-Version (siehe `CORPUS_BUILD_VERSION`). Optional fuer
   *  Rueckwaerts-Kompat mit alten v1-Manifests, die das Feld nicht hatten. */
  corpusBuildVersion?: number;
  /**
   * Der Dokument-Praefix, mit dem diese Vektoren erzeugt wurden (v4.113).
   *
   * Gehoert ins Manifest, weil er den Vektorraum mitbestimmt und bis dahin
   * NIRGENDS festgehalten war: zwei Korpora mit gleichem Modell, gleicher
   * Dimension und verschiedenem Praefix galten als kompatibel. Optional, weil
   * alte Manifests ihn nicht fuehren — dann macht er keine Aussage
   * ([signatur.ts](./signatur.ts)).
   */
  documentPrefix?: string;
}

/** Liefert die Build-Version eines Manifests; alte Manifests ohne Feld
 *  gelten als Version 1 (vor dem Deskriptoren-Update). */
export function getCorpusBuildVersion(manifest: EmbeddingCorpusManifest): number {
  return manifest.corpusBuildVersion ?? 1;
}

export type CompatStatus =
  | { kind: 'compatible' }
  | { kind: 'modell-mismatch'; shareModell: string; lokalModell: string }
  | { kind: 'dim-mismatch'; shareDim: number; lokalDim: number };

// ───────────────────────────────────────────────────────────────────
// Hash + Serialize/Parse
// ───────────────────────────────────────────────────────────────────

/** Stabile SHA-256 ueber die sortierten aktenzeichen via Web-Crypto. */
export async function hashAktenzeichenSet(aktenzeichen: string[]): Promise<string> {
  const sorted = [...aktenzeichen].sort();
  const text = sorted.join('\n');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Serialisiert eine Map<aktenzeichen, vektor> in (Manifest, Bin)-Tupel.
 * Erzwingt einheitliche Dimension — wirft bei Dim-Mismatch.
 */
export async function serializeCorpus(
  embeddings: Map<string, number[]>,
  modellId: string,
  dim: number,
  builderProfile?: string,
  /** Der Praefix, mit dem DIESE Vektoren gebaut wurden — aus der lokalen
   *  Korpus-Signatur, nicht aus dem gerade aktiven Modell. */
  documentPrefix?: string,
  /** Die Text-Build-Version DIESER Vektoren. Ohne Angabe die aktuelle. */
  buildVersion?: number,
): Promise<{ manifest: EmbeddingCorpusManifest; bin: ArrayBuffer }> {
  const aktenzeichen = [...embeddings.keys()].sort();
  const count = aktenzeichen.length;
  const totalFloats = count * dim;
  const buffer = new ArrayBuffer(totalFloats * 4);
  const view = new Float32Array(buffer);
  for (let i = 0; i < count; i++) {
    const az = aktenzeichen[i]!;
    const vec = embeddings.get(az)!;
    if (vec.length !== dim) {
      throw new Error(
        `serializeCorpus: Dim-Mismatch fuer "${az}": erwartet ${dim}, gefunden ${vec.length}.`,
      );
    }
    view.set(vec, i * dim);
  }
  const manifest: EmbeddingCorpusManifest = {
    version: 1,
    modellId,
    dim,
    antraegeCount: count,
    builtAt: new Date().toISOString(),
    builderProfile,
    aktenzeichenSetHash: await hashAktenzeichenSet(aktenzeichen),
    aktenzeichen,
    binFormat: 'f32-stream',
    binBytes: buffer.byteLength,
    corpusBuildVersion: buildVersion ?? CORPUS_BUILD_VERSION,
    documentPrefix,
  };
  return { manifest, bin: buffer };
}

/**
 * Parst (Manifest, Bin) zurueck in Map<aktenzeichen, number[]> fuer
 * Bulk-Import in den lokalen IDB-Cache. Sanity-Check via binBytes.
 */
export function parseCorpus(
  manifest: EmbeddingCorpusManifest,
  bin: ArrayBuffer,
): Map<string, number[]> {
  if (manifest.binBytes !== bin.byteLength) {
    throw new Error(
      `parseCorpus: Bin-Groesse passt nicht zum Manifest (erwartet ${manifest.binBytes}, geladen ${bin.byteLength}).`,
    );
  }
  if (manifest.binFormat !== 'f32-stream') {
    throw new Error(`parseCorpus: unbekanntes binFormat "${manifest.binFormat}".`);
  }
  const view = new Float32Array(bin);
  const out = new Map<string, number[]>();
  for (let i = 0; i < manifest.antraegeCount; i++) {
    const az = manifest.aktenzeichen[i]!;
    const vec = Array.from(view.subarray(i * manifest.dim, (i + 1) * manifest.dim));
    out.set(az, vec);
  }
  return out;
}

/** Kompat-Check: Modell + Dim. */
export function checkCompat(
  manifest: EmbeddingCorpusManifest,
  lokalModellId: string,
  lokalDim: number,
): CompatStatus {
  if (manifest.modellId !== lokalModellId) {
    return { kind: 'modell-mismatch', shareModell: manifest.modellId, lokalModell: lokalModellId };
  }
  if (manifest.dim !== lokalDim) {
    return { kind: 'dim-mismatch', shareDim: manifest.dim, lokalDim };
  }
  return { kind: 'compatible' };
}

// ───────────────────────────────────────────────────────────────────
// SMB-IO
// ───────────────────────────────────────────────────────────────────

/** Liest nur das Manifest. Schnell, ohne 42 MB Bin-Roundtrip. */
export async function loadManifest(storage: StorageService): Promise<EmbeddingCorpusManifest | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const text = await readText(handle, CORPUS_MANIFEST_PATH);
  if (text == null) return null;
  try {
    const parsed = JSON.parse(text) as EmbeddingCorpusManifest;
    if (parsed.version !== 1) {
      console.warn('[embedding-corpus-mirror] unbekannte Manifest-Version, ignoriere:', parsed.version);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[embedding-corpus-mirror] Manifest-Parse fehlgeschlagen:', err);
    return null;
  }
}

/**
 * Laedt das Bin als ArrayBuffer. Wird nur aufgerufen wenn Manifest passt
 * UND lokal Embeddings fehlen.
 */
export async function loadBin(
  storage: StorageService,
  expectedBytes: number,
): Promise<ArrayBuffer | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const bytes = await readBinary(handle, CORPUS_BIN_PATH);
  if (bytes == null) return null;
  if (bytes.byteLength !== expectedBytes) {
    console.warn(
      `[embedding-corpus-mirror] Bin-Groesse ${bytes.byteLength} weicht von erwartet ${expectedBytes} ab — koennte korrupt sein.`,
    );
    return null;
  }
  // `readBinary` liefert eine frische, isolierte Uint8Array
  // (`new Uint8Array(await file.arrayBuffer())`) → der underlying ArrayBuffer ist
  // exakt diese Bytes (byteOffset 0, keine View ueber einen groesseren Buffer).
  // In dem Fall die Defensivkopie ueberspringen — spart auf RAM-knappem Citrix
  // 40 MB Peak (v2.61.5). Nur falls (wider Erwarten) eine Teil-View ankommt,
  // sicherheitshalber kopieren.
  if (bytes.byteOffset === 0 && bytes.buffer.byteLength === bytes.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/** Wie viele Bytes je Schreib-Scheibe an den Share gehen (~4 MB). */
const SCHEIBE_BYTES = 4 * 1024 * 1024;
/** Wartezeiten zwischen den Schreibversuchen. Laenge = Zahl der Wiederholungen. */
const WIEDERHOL_PAUSEN_MS = [500, 2000];

async function warte(ms: number): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

export interface SpiegelFortschritt {
  /** Bereits geschriebene Bytes der laufenden Datei. */
  geschrieben: number;
  /** Gesamtgroesse der laufenden Datei. */
  gesamt: number;
}

/**
 * Eine Korpus-Datei auf den Share schreiben — mit frischem Handle je Versuch.
 *
 * **Warum ein neuer Handle die eigentliche Reparatur ist.** Der Verzeichnis-
 * Handle wird aus der IndexedDB deserialisiert ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts))
 * und traegt danach einen gecachten Zustand mit sich. Reisst die Verbindung
 * kurz weg — ueber VPN der Normalfall, nicht die Ausnahme — wirft jeder Zugriff
 * `InvalidStateError` („state cached in an interface object … had changed since
 * it was read from disk"), und zwar dauerhaft: derselbe Handle erholt sich
 * nicht. Ein zweiter Versuch auf DEMSELBEN Handle waere sinnlos; erst ein neu
 * geholter hat wieder einen gueltigen Zustand.
 *
 * Ein 42-MB-Bau kostet Minuten. Ihn wegen einer Sekunde Netz wegzuwerfen, war
 * die teuerste Stelle des ganzen Laufs (v6.16).
 */
export async function schreibeKorpusDatei(
  storage: StorageService,
  pfad: string,
  daten: Uint8Array<ArrayBuffer> | string,
  onFortschritt?: (p: SpiegelFortschritt) => void,
): Promise<void> {
  let letzterFehler: unknown;

  for (let versuch = 0; versuch <= WIEDERHOL_PAUSEN_MS.length; versuch++) {
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');

    // Erst fragen, dann dreimal in denselben Fehler laufen: ist das Schreibrecht
    // weg, hilft keine Wiederholung. `requestPermission` waere hier zwecklos —
    // die Nutzergeste, die den Bau startete, ist Minuten alt (Pitfall
    // „one prompt per gesture").
    if (versuch === 0) {
      const recht = await queryPermission(handle).catch(() => 'granted' as const);
      if (recht !== 'granted') {
        throw new Error(
          'Das Schreibrecht für den Daten-Share ist nicht mehr erteilt. '
          + 'Bitte die Seite neu laden und den Ordner erneut auswählen — der lokale Korpus bleibt erhalten.',
        );
      }
    }

    try {
      if (typeof daten === 'string') {
        await atomicWrite(handle, pfad, daten, { skipBackup: true });
      } else {
        // In Scheiben statt in einem `write`: senkt den Gipfel im Speicher,
        // verwirft die `.tmp` bei Abbruch sauber — und ist die einzige Stelle,
        // an der ein Upload ueberhaupt Fortschritt melden KANN.
        await atomicWriteStream(handle, pfad, async (sink) => {
          for (let off = 0; off < daten.byteLength; off += SCHEIBE_BYTES) {
            const ende = Math.min(off + SCHEIBE_BYTES, daten.byteLength);
            await sink.write(daten.subarray(off, ende));
            onFortschritt?.({ geschrieben: ende, gesamt: daten.byteLength });
          }
        }, { skipBackup: true });
      }
      return;
    } catch (err) {
      letzterFehler = err;
      const pause = WIEDERHOL_PAUSEN_MS[versuch];
      if (pause === undefined) break;
      console.warn(
        `[embedding-corpus-mirror] Schreiben von ${pfad} fehlgeschlagen `
        + `(Versuch ${versuch + 1}/${WIEDERHOL_PAUSEN_MS.length + 1}), neuer Anlauf in ${pause} ms:`,
        err,
      );
      await warte(pause);
    }
  }

  throw letzterFehler instanceof Error ? letzterFehler : new Error(String(letzterFehler));
}

/**
 * Schreibt Manifest + Bin atomar. Beide mit `skipBackup: true` —
 * `.backup`-Rotation auf 42 MB wuerde 84 MB Share-Bandbreite kosten
 * fuer einen Schutz, der durch Re-Build trivial ersetzbar ist.
 */
export async function saveCorpusToShare(
  storage: StorageService,
  manifest: EmbeddingCorpusManifest,
  bin: ArrayBuffer,
  onFortschritt?: (p: SpiegelFortschritt) => void,
): Promise<void> {
  // Bin zuerst schreiben, dann Manifest — wenn jemand zwischendurch das
  // Manifest liest, zeigt es auf eine bereits vollstaendige Bin-Datei.
  await schreibeKorpusDatei(storage, CORPUS_BIN_PATH, new Uint8Array(bin), onFortschritt);
  await schreibeKorpusDatei(storage, CORPUS_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ───────────────────────────────────────────────────────────────────
// IDB-Bulk-Apply
// ───────────────────────────────────────────────────────────────────

/** Bulk-Schreiben in IDB nach Download. */
export async function applyCorpusToIdb(
  idb: IDBStore,
  embeddings: Map<string, number[]>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = embeddings.size;
  let done = 0;
  for (const [az, vec] of embeddings) {
    await storeEmbedding(idb, az, vec);
    done++;
    if (done % 100 === 0) {
      onProgress?.(done, total);
      // Yield damit UI responsive bleibt waehrend grosser Imports
      await new Promise(r => setTimeout(r, 0));
    }
  }
  onProgress?.(done, total);
}

/**
 * Streamendes Pendant zu `parseCorpus` + `applyCorpusToIdb` (v2.61.5,
 * Cold-Start-Memory-Fix): iteriert direkt ueber die Float32Array-View der Bin
 * und schreibt jedes Embedding einzeln in den IDB — OHNE die vollstaendige
 * ~80-MB-`Map<string, number[]>` als Zwischenstand zu materialisieren. Jeder
 * Vektor ist nur als kurzlebiges 768er-`number[]` im RAM (sofort GC-faehig).
 * Yield alle 100 Eintraege haelt den Main-Thread responsiv (file://: der
 * Korpus wird im Main-Thread verarbeitet, Pitfall #8). Returnt die Anzahl
 * geschriebener Embeddings. Funktional identisch zum 2-Schritt-Pfad — getestet
 * in `embedding-corpus-mirror.test.ts`.
 */
export async function applyCorpusStreamed(
  idb: IDBStore,
  manifest: EmbeddingCorpusManifest,
  bin: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (manifest.binBytes !== bin.byteLength) {
    throw new Error(
      `applyCorpusStreamed: Bin-Groesse passt nicht zum Manifest (erwartet ${manifest.binBytes}, geladen ${bin.byteLength}).`,
    );
  }
  if (manifest.binFormat !== 'f32-stream') {
    throw new Error(`applyCorpusStreamed: unbekanntes binFormat "${manifest.binFormat}".`);
  }
  const view = new Float32Array(bin);
  const total = manifest.antraegeCount;
  const dim = manifest.dim;
  for (let i = 0; i < total; i++) {
    const az = manifest.aktenzeichen[i]!;
    const vec = Array.from(view.subarray(i * dim, (i + 1) * dim));
    await storeEmbedding(idb, az, vec);
    if ((i + 1) % 100 === 0) {
      onProgress?.(i + 1, total);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  onProgress?.(total, total);
  return total;
}
