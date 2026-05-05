/**
 * Triage-Orchestrator: Stage 0 → 1 → 2 → 3, mit Skip-List-Schnellpfad,
 * Matcher-Aufruf und Pending-Antrag-Routing.
 *
 * Output: ManifestEntry pro Datei (in IDB scan_manifest gespeichert + auf
 * Wunsch JSONL-gespiegelt vom Caller).
 *
 * Classifier-Version wird zentral über `CLASSIFIER_VERSION` gesetzt — manuell
 * erhöhen wenn Klassifikator-Logik signifikant geändert wird.
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import type { AITransport } from '../../core/services/ai/transports/streamlit';
import type {
  AktenplanLookup,
  DmsEntry,
  ManifestEntry,
  TriageResult,
} from '../types';
import type { ScanFile } from '../scanner/scan-roots';
import { runStage0 } from './stage0-dms-lookup';
import { runStage1 } from './stage1-structural';
import { runStage2 } from './stage2-keywords';
import { runStage3 } from './stage3-nemotron';
import { matchByFkz, runMatcher } from '../matcher/matcher';
import { addPending, listPendingByAkronym } from '../pending-antrag/holding-bucket';
import { getSkipEntry, putSkipEntry } from '../skip-list/store';
import { getManifestEntry, putManifestEntry } from '../scanner/manifest-store';

/**
 * Version-Counter für Skip-List-Reset-Mechanik. Bei Klassifikator-Updates erhöhen.
 *
 * v1 → v2: SkipListEntry erweitert um dms_*-Felder (Bug-Fix: vorher gingen die
 *   Stage-0-Erkenntnisse beim Schnellpfad-Restore verloren). Alle v1-Einträge
 *   werden beim nächsten Triage-Lauf re-klassifiziert.
 */
export const CLASSIFIER_VERSION = 2;

export interface TriageContext {
  idb: IDBStore;
  programmId: string;
  dmsMap: Map<string, DmsEntry>;
  aktenplan: Map<string, AktenplanLookup>;
  /** Optional: Stage-3-Transport. Wenn null → Stage 3 übersprungen. */
  llmTransport?: AITransport | null;
  /** Optional: Akronym-Hint kommt aus DMS-Bezeichnung — wenn nicht aus Page 1 da. */
  fallbackAkronymFromBezeichnung?: boolean;
}

export interface TriageRunResult {
  manifest: ManifestEntry;
  /** True wenn die Datei via Skip-Liste übersprungen wurde. */
  skipped: boolean;
  /** Pending-Antrag-Eintrag wenn relevant. */
  pendingId?: string;
}

/**
 * Triagiert eine einzelne Datei. Caller liefert ScanFile + Lazy-Blob-Provider
 * (damit der Orchestrator die Datei nur lädt wenn Stage 1+ es braucht).
 */
export async function triageFile(
  ctx: TriageContext,
  file: ScanFile,
  loadBlob: (file: ScanFile) => Promise<Blob | null>,
): Promise<TriageRunResult> {
  // Schnellpfad 1: Skip-Liste (irrelevante Files — günstigster Pfad, ein IDB-Lookup)
  const skipped = await getSkipEntry(ctx.idb, file.filename);
  if (skipped && skipped.classifier_version >= CLASSIFIER_VERSION) {
    const manifest = manifestFromSkip(file, skipped);
    return { manifest, skipped: true };
  }

  // Schnellpfad 2: Manifest-Cache (relevante Files mit unveränderten Datei-Metadaten).
  // Verhindert dass bei einem inkrementellen Scan alle relevanten Files Stage 0/1/2/3
  // erneut durchlaufen, wenn sich an der Datei nichts geändert hat. mtime + size_bytes
  // sind die robusten Heuristiken — Hash-basiert wäre teurer (File-Open).
  const cached = await getManifestEntry(ctx.idb, file.filename);
  if (
    cached &&
    cached.classifier_version >= CLASSIFIER_VERSION &&
    cached.mtime === file.mtime &&
    cached.size_bytes === file.size_bytes
  ) {
    // Marker im reason, damit User/Logs sehen dass Cache fired. Persistierter
    // Wert im IDB bleibt unverändert (wir mutieren nur das Return-Objekt).
    return {
      manifest: {
        ...cached,
        triage_reason: cached.triage_reason.startsWith('cached: ')
          ? cached.triage_reason
          : `cached: ${cached.triage_reason}`,
      },
      skipped: true,
    };
  }

  // Stage 0 — DMS-Lookup ohne Datei-Zugriff
  const stage0 = runStage0({
    filename: file.filename,
    dmsMap: ctx.dmsMap,
    aktenplan: ctx.aktenplan,
  });

  let triage: TriageResult;
  let blob: Blob | null = null;

  if (stage0.matched) {
    triage = stage0.result;
    if (triage.triage_state === 'irrelevant') {
      // Direkt in Skip-Liste, ohne Datei zu öffnen
      return await persistIrrelevant(ctx, file, triage, 'dms_csv');
    }

    // Schnellpfad: PDF + doc_type=gutachten/gutachten_qs + Bezeichnung enthaelt
    // 'final' (case-insensitive) — die Klassifikation ist damit aus Stage 0
    // bereits eindeutig (DMS-Aktenplan-Mapping liefert doc_type, FKZ steht in
    // DmsEntry.extractedFkz). Wir koennen Stage 1+2 (zwei pdfjs.getDocument-
    // Calls plus arrayBuffer-Reads pro Datei) komplett ueberspringen.
    // Akronym fehlt damit (Stage 2 extrahiert es aus Page-1-Text), das ist
    // fuer Gutachten aber unkritisch — der Antrag-Match laeuft ueber FKZ.
    const isPdfGutachtenFinal =
      file.filename.toLowerCase().endsWith('.pdf') &&
      (triage.doc_type === 'gutachten' || triage.doc_type === 'gutachten_qs') &&
      !!triage.dms_bezeichnung &&
      /final/i.test(triage.dms_bezeichnung);

    if (isPdfGutachtenFinal) {
      triage = {
        ...triage,
        reason: `${triage.reason} | bezeichnung_final_pdf_skip_stages_1_2`,
      };
      // blob bleibt null — nachfolgende `if (blob && ...)`-Bloecke ueberspringen
      // Stage 1/2 automatisch. Wir fallen direkt durch zum Matcher.
    } else {
      // Blob laden für Stage 1/2
      blob = await loadBlob(file);
      // Stage 1 strukturell (vor allem Gutachten-DOCX-Sonderregel)
      const stage1 = await runStage1({
        filename: file.filename,
        blob,
        docTypeHint: triage.doc_type,
        fkzHint: triage.extracted_fkz,
        // DMS-Felder durchreichen, damit sie im Stage-1-`decided` nicht verloren gehen
        dmsBezeichnungHint: triage.dms_bezeichnung,
        dmsAktenplanHint: triage.dms_aktenplan,
        creatorKuerzelHint: triage.creator_kuerzel,
      });
      if (stage1.decided) {
        triage = stage1.decided;
        if (triage.triage_state === 'irrelevant') {
          return await persistIrrelevant(ctx, file, triage, 'stage1');
        }
      }
    }
  } else {
    // Kein DMS-Treffer → ab Stage 1 mit Datei-Zugriff
    blob = await loadBlob(file);
    if (!blob) {
      // Datei nicht lesbar — als orphan in Skip-Liste, damit Re-Scan sie nicht erneut versucht
      const manifest = manifestFromTriage(
        file,
        emptyTriage(file.filename, 'sonstiges', 'review', 1, 'stage1', 'file_not_readable'),
        emptyMatch(),
      );
      await persistManifest(ctx.idb, manifest);
      return { manifest, skipped: false };
    }
    const stage1 = await runStage1({ filename: file.filename, blob });
    if (stage1.decided) {
      triage = stage1.decided;
      if (triage.triage_state === 'irrelevant') {
        return await persistIrrelevant(ctx, file, triage, 'stage1');
      }
    } else {
      // Stage 2 startet hier — Stage 0 hat nichts geliefert
      const stage2 = await runStage2({ filename: file.filename, blob });
      triage = stage2.result;
    }
  }

  // Stage 2 zur Verfeinerung (FKZ aus Page-1, Akronym, doc_type) wenn wir schon
  // einen Stage-0-Match haben — wir wollen FKZ + Akronym auch für DMS-Treffer.
  if (blob && triage.triage_stage === 0) {
    const stage2 = await runStage2({
      filename: file.filename,
      blob,
      docTypeHint: triage.doc_type,
      fkzHint: triage.extracted_fkz,
    });
    // Stage-2-Ergebnisse mergen — DMS-Klassifikation gewinnt für doc_type,
    // aber Akronym + Page-1-Text werden übernommen.
    triage = {
      ...triage,
      page1_text: stage2.result.page1_text,
      extracted_akronym: stage2.result.extracted_akronym ?? triage.extracted_akronym,
      extracted_fkz: triage.extracted_fkz ?? stage2.result.extracted_fkz,
    };
  }

  // Stage 3 — nur wenn wir nichts Eindeutiges haben und LLM verfügbar ist
  const isAmbiguous =
    triage.doc_type === 'sonstiges' || triage.triage_state === 'review';
  if (isAmbiguous && ctx.llmTransport && triage.page1_text) {
    const stage3 = await runStage3({
      filename: file.filename,
      page1_text: triage.page1_text,
      docTypeHint: triage.doc_type,
      fkzHint: triage.extracted_fkz,
      akronymHint: triage.extracted_akronym,
      transport: ctx.llmTransport,
    });
    // Stage 3 setzt DMS-Felder hardcoded null (LLM kennt sie nicht). Wenn
    // wir vorher einen Stage-0-Match hatten, wäre dieser Wert wertvoll —
    // also DMS-Felder aus dem vorherigen triage-Stand erben.
    triage = {
      ...stage3.result,
      creator_kuerzel: stage3.result.creator_kuerzel ?? triage.creator_kuerzel,
      dms_bezeichnung: stage3.result.dms_bezeichnung ?? triage.dms_bezeichnung,
      dms_aktenplan: stage3.result.dms_aktenplan ?? triage.dms_aktenplan,
    };
  }

  if (triage.triage_state === 'irrelevant') {
    return await persistIrrelevant(ctx, file, triage, triage.source);
  }

  // Matcher
  const match = await runMatcher(ctx.idb, {
    fkz: triage.extracted_fkz,
    akronym: triage.extracted_akronym,
    programmId: ctx.programmId,
  });

  // Sonderfall Projektbeschreibung ohne Match → pending_antrag-Bucket
  let pendingId: string | undefined;
  if (
    triage.doc_type === 'projektbeschreibung' &&
    match.matched_antrag_id == null &&
    !match.flag_conflict
  ) {
    const pending = await addPending(ctx.idb, {
      filename: file.filename,
      filepath: file.filepath,
      akronym: triage.extracted_akronym,
      fkz_candidate: triage.extracted_fkz,
      programm_id: ctx.programmId,
      classifier_version: CLASSIFIER_VERSION,
    });
    pendingId = pending.id;
    const manifest = manifestFromTriage(
      file,
      { ...triage, triage_state: 'pending_antrag' },
      { ...match, match_method: 'pending_antrag', requires_review: false },
    );
    await persistManifest(ctx.idb, manifest);
    return { manifest, skipped: false, pendingId };
  }

  // Manifest fertig zusammensetzen + persistieren
  const manifest = manifestFromTriage(file, triage, match);
  await persistManifest(ctx.idb, manifest);
  return { manifest, skipped: false };
}

// -- Helpers ---------------------------------------------------------------

function manifestFromTriage(
  file: ScanFile,
  triage: TriageResult,
  match: { matched_antrag_id: string | null; match_method: ManifestEntry['match_method']; match_confidence: ManifestEntry['match_confidence']; candidate_antrag_ids: string[]; requires_review: boolean },
): ManifestEntry {
  return {
    filename: file.filename,
    filepath: file.filepath,
    size_bytes: file.size_bytes,
    mtime: file.mtime,
    classifier_version: CLASSIFIER_VERSION,
    classified_at: new Date().toISOString(),
    doc_type: triage.doc_type,
    triage_state: triage.triage_state,
    triage_stage: triage.triage_stage,
    triage_source: triage.source,
    triage_reason: triage.reason,
    extracted_fkz: triage.extracted_fkz,
    extracted_akronym: triage.extracted_akronym,
    matched_antrag_id: match.matched_antrag_id,
    match_method: match.match_method,
    match_confidence: match.match_confidence,
    candidate_antrag_ids: match.candidate_antrag_ids,
    requires_review: match.requires_review,
    creator_kuerzel: triage.creator_kuerzel,
    dms_bezeichnung: triage.dms_bezeichnung,
    dms_aktenplan: triage.dms_aktenplan,
  };
}

function manifestFromSkip(file: ScanFile, skip: import('../types').SkipListEntry): ManifestEntry {
  return {
    filename: file.filename,
    filepath: file.filepath,
    size_bytes: file.size_bytes,
    mtime: file.mtime,
    classifier_version: skip.classifier_version,
    classified_at: skip.classified_at,
    doc_type: skip.doc_type,
    triage_state: 'irrelevant',
    triage_stage: 0,
    triage_source: skip.source,
    triage_reason: `skipped: ${skip.reason}`,
    // Restore aus dem Skip-Eintrag (alte v1-Einträge ohne diese Felder kommen
    // mit `undefined` und fallen auf null) — siehe SkipListEntry-Erweiterung.
    extracted_fkz: skip.extracted_fkz ?? null,
    extracted_akronym: skip.extracted_akronym ?? null,
    matched_antrag_id: skip.antrag_id,
    match_method: skip.antrag_id ? 'fkz' : null,
    match_confidence: skip.antrag_id ? 'high' : null,
    candidate_antrag_ids: [],
    requires_review: false,
    creator_kuerzel: skip.creator_kuerzel ?? null,
    dms_bezeichnung: skip.dms_bezeichnung ?? null,
    dms_aktenplan: skip.dms_aktenplan ?? null,
  };
}

function emptyTriage(
  filename: string,
  doc_type: TriageResult['doc_type'],
  state: TriageResult['triage_state'],
  stage: TriageResult['triage_stage'],
  source: TriageResult['source'],
  reason: string,
): TriageResult {
  return {
    filename,
    doc_type,
    triage_state: state,
    triage_stage: stage,
    source,
    reason,
    extracted_fkz: null,
    extracted_akronym: null,
    creator_kuerzel: null,
    dms_bezeichnung: null,
    dms_aktenplan: null,
  };
}

function emptyMatch(): {
  matched_antrag_id: null;
  match_method: null;
  match_confidence: 'orphan';
  candidate_antrag_ids: string[];
  requires_review: true;
} {
  return {
    matched_antrag_id: null,
    match_method: null,
    match_confidence: 'orphan',
    candidate_antrag_ids: [],
    requires_review: true,
  };
}

async function persistManifest(idb: IDBStore, m: ManifestEntry): Promise<void> {
  await putManifestEntry(idb, m);
}

async function persistIrrelevant(
  ctx: TriageContext,
  file: ScanFile,
  triage: TriageResult,
  source: import('../types').ClassifierSource,
): Promise<TriageRunResult> {
  // Audit-Vollständigkeit: auch für irrelevante Files den FKZ→Antrag-Bezug
  // dokumentieren wenn ein FKZ erkannt wurde (z.B. Gutachten-DOCX-Sonderregel).
  // requires_review bleibt false — die Datei wird sowieso nicht in den Index
  // aufgenommen, der Match ist nur informativ.
  let antragId: string | null = null;
  if (triage.extracted_fkz) {
    try {
      const r = await matchByFkz(ctx.idb, triage.extracted_fkz);
      antragId = r.matched_antrag_id;
    } catch {
      // Best-effort, Match-Fehler dürfen nicht den Skip-Persist blockieren
      antragId = null;
    }
  }

  const manifest = manifestFromTriage(file, triage, emptyMatch());
  manifest.matched_antrag_id = antragId;
  manifest.match_method = antragId ? 'fkz' : null;
  manifest.match_confidence = antragId ? 'high' : null;
  manifest.requires_review = false;
  await persistManifest(ctx.idb, manifest);
  await putSkipEntry(ctx.idb, {
    filename: file.filename,
    antrag_id: antragId,
    doc_type: triage.doc_type,
    classifier_version: CLASSIFIER_VERSION,
    classified_at: new Date().toISOString(),
    reason: triage.reason,
    first_seen_hash: '',
    source,
    // DMS-Felder mit-persistieren, damit der Schnellpfad-Restore beim
    // nächsten Scan das Manifest vollständig rekonstruieren kann.
    dms_bezeichnung: triage.dms_bezeichnung,
    dms_aktenplan: triage.dms_aktenplan,
    creator_kuerzel: triage.creator_kuerzel,
    extracted_fkz: triage.extracted_fkz,
    extracted_akronym: triage.extracted_akronym,
  });
  return { manifest, skipped: false };
}

// Re-Export für Caller, die nur den Pending-Bucket lesen wollen
export { listPendingByAkronym };
