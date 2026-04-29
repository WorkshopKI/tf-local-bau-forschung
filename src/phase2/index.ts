/**
 * Barrel-Export für den Phase-2-Triage-Baustein.
 *
 * Konsumenten (Dev-Panel, App.tsx, Folge-Patches) importieren von hier:
 *   import { triageFile, scanDocSource, ... } from '@/phase2';
 */

export * from './types';
export { triageFile, CLASSIFIER_VERSION } from './triage/triage';
export { runStage0 } from './triage/stage0-dms-lookup';
export { runStage1 } from './triage/stage1-structural';
export { runStage2 } from './triage/stage2-keywords';
export { runStage3 } from './triage/stage3-nemotron';
export { matchKeywords, findAkronymHint, STAGE2_KEYWORD_MARKERS } from './triage/keywords';
export { extractFkz, extractFkzStrict, extractFkzTolerant, isValidFkz } from './matcher/fkz-extractor';
export { runMatcher, matchByFkz, matchByAkronym, fkzExistsInStore } from './matcher/matcher';
export { findKnownAkronym, lookupAkronymCandidates } from './matcher/akronym-matcher';
export { scanDocSource } from './scanner/scan-roots';
export type { ScanFile, ScanOptions } from './scanner/scan-roots';
export {
  putManifestEntry,
  getManifestEntry,
  listManifestEntries,
  deleteManifestEntry,
} from './scanner/manifest-store';
export { loadDmsCsvFromShare, parseDmsCsv } from './dms-csv/loader';
export { parseCsvLine, parseCsvText } from './dms-csv/parser';
export {
  DEFAULT_AKTENPLAN_MAPPING,
  buildEffectiveMapping,
  lookupAktenplan,
  isDocTypeIrrelevant,
} from './dms-csv/aktenplan-mapping';
export {
  putSkipEntry,
  getSkipEntry,
  deleteSkipEntry,
  listAllSkipEntries,
  isSkipped,
} from './skip-list/store';
export { resetSkipListByVersion } from './skip-list/reclassify';
export {
  addPending,
  listAllPending,
  listPendingByAkronym,
  deletePending,
  rematchOnSnapshotReload,
} from './pending-antrag/holding-bucket';
export { ocrFirstPage, OcrNotImplementedError } from './ocr/side-car';
export type { OcrFirstPageRequest, OcrFirstPageResult } from './ocr/side-car';
export { CONFIDENCE_BADGE_CLASSES, TRIAGE_SOURCE_BADGE_CLASSES } from './ui-tokens';
