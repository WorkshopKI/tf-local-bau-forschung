/**
 * Auslastungs-Wrapper um den generischen Embedding-Korpus.
 *
 * Schmale Antrag-spezifische Schicht ueber `@/core/services/embedding-corpus`:
 *  - Antrag → Embedding-Text-Mapping (welche Felder fliessen ins Embedding)
 *  - Build-Pipeline, die diesen Mapper + den generischen IDB-Cache nutzt
 *
 * Generische Operationen (IDB-CRUD, SMB-Mirror, Modell-Init) leben in core.
 * Die historischen IDB-Prefixe + SMB-Pfade (`auslastung-*`) bleiben dort
 * unveraendert — siehe core/services/embedding-corpus/storage.ts.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
} from '../types';
import {
  storeEmbedding,
  listEmbeddingKeys,
  ensureEmbeddingReady,
  embedText,
} from '@/core/services/embedding-corpus';
import { buildDescriptorsText } from '@/plugins/antraege/services/descriptor-text';

/**
 * Erzeugt den Embedding-Text fuer einen Antrag. Reihenfolge: VB-Titel,
 * Titel, Abstract, Deskriptoren (TECHN/BRANCHE/ANWEND + ZT-Klartexte).
 *
 * Deskriptoren sind seit corpus-build-v2 Teil des Embedding-Texts —
 * semantische Suche nach „Wärmedämmung" findet damit auch Antraege mit
 * ZT-Leichtbau-Flag ohne Wörter-Match im Abstract. Aelteren Korpora (v1)
 * fehlt dieser Anteil; sie bleiben funktional, der Auslastungs-Tab schlaegt
 * einen Rebuild vor.
 */
export function buildEmbeddingTextForAntrag(antrag: Antrag): string {
  const fields = [
    antrag[CANONICAL_VERBUND_TITEL],
    antrag[CANONICAL_TITEL],
    antrag[FIELD_PROJEKTBESCHREIBUNG],
    buildDescriptorsText(antrag),
  ];
  const parts: string[] = [];
  for (const f of fields) {
    if (typeof f === 'string' && f.trim()) parts.push(f.trim());
  }
  return parts.join(' \n ').slice(0, 4000); // cap fuer Modell-Token-Limit
}

/**
 * True wenn ein Antrag genug Text-Daten fuer ein Embedding hat. Identische
 * Bedingung wie im Build-Loop ({@link buildEmbeddingCorpus}, der ohne Text
 * skipt). Wird in der UI gebraucht, damit Drift-Detection (lokaler Hash vs.
 * Share-Manifest-Hash) nur ueber die tatsaechlich embedbaren Akz rechnet —
 * sonst weicht der Hash strukturell ab, weil Foyer-Exporte regelmaessig
 * 5–10 Antraege ohne Titel/VB-Titel/Projektbeschreibung enthalten.
 */
export function isEmbeddableAntrag(antrag: Antrag): boolean {
  return buildEmbeddingTextForAntrag(antrag).length > 0;
}

/** Sortierte aktenzeichen-Liste der embedbaren Antraege — Input fuer
 *  `hashAktenzeichenSet`. */
export function getEmbeddableAktenzeichen(antraege: Antrag[]): string[] {
  const out: string[] = [];
  for (const a of antraege) {
    if (isEmbeddableAntrag(a)) out.push(a.aktenzeichen);
  }
  return out;
}

/** Wieviele Antraege haben noch kein Embedding? */
export async function countMissing(idb: IDBStore, antraege: Antrag[]): Promise<number> {
  const existing = await listEmbeddingKeys(idb);
  let missing = 0;
  for (const a of antraege) {
    if (!existing.has(a.aktenzeichen)) missing++;
  }
  return missing;
}

export interface BuildProgress {
  done: number;
  total: number;
  lastAntrag?: string;
  /** Geschaetzte verbleibende Zeit in Sekunden, oder undefined wenn noch zu unsicher. */
  etaSec?: number;
}

export interface BuildOptions {
  onProgress?: (p: BuildProgress) => void;
  signal?: AbortSignal;
  /** Nur fehlende neu embedden. Default true. */
  incremental?: boolean;
}

/**
 * Hauptpfad: laeuft durch alle Antraege, embed't den Text (VB-Titel + Titel
 * + Abstract + Deskriptoren) und schreibt in den IDB-Cache.
 *
 * Annahme: Caller hat `ensureEmbeddingReady(idb)` bereits aufgerufen — wenn
 * nicht, machen wir das hier nochmal idempotent.
 */
export async function buildEmbeddingCorpus(
  idb: IDBStore,
  antraege: Antrag[],
  opts: BuildOptions = {},
): Promise<{ done: number; skipped: number; aborted: boolean }> {
  const incremental = opts.incremental ?? true;
  await ensureEmbeddingReady(idb);

  // Liste filtern
  let queue: Antrag[];
  if (incremental) {
    const existing = await listEmbeddingKeys(idb);
    queue = antraege.filter(a => !existing.has(a.aktenzeichen));
  } else {
    queue = antraege;
  }

  const total = queue.length;
  let done = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const a of queue) {
    if (opts.signal?.aborted) {
      return { done, skipped, aborted: true };
    }
    const text = buildEmbeddingTextForAntrag(a);
    if (!text) {
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
      continue;
    }
    try {
      const vec = await embedText(text, 'document');
      await storeEmbedding(idb, a.aktenzeichen, vec);
      done++;
      const elapsed = (Date.now() - startedAt) / 1000;
      const etaSec = done > 5 ? (elapsed / done) * (total - done) : undefined;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen, etaSec });
    } catch (err) {
      console.warn(`[embedding-corpus] embed failed for ${a.aktenzeichen}:`, err);
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
    }
    // Yield zwischen Iterations -> UI bleibt responsiv
    await new Promise(r => setTimeout(r, 0));
  }

  return { done, skipped, aborted: false };
}
