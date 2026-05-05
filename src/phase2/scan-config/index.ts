export type { ScanConfigEntry, ScanRunHistoryEntry } from './types';
export { SCAN_CONFIG_SHARE_PATH } from './types';
export { getLastScanRun, recordScanRun, pathsHash } from './scan-history';
export { getScanConfig, saveScanConfig, clearScanConfig } from './store';
export { listSubdirs, type SubdirEntry } from './tree-loader';
export {
  exportScanConfigToShare,
  importScanConfigFromShare,
  type ScanConfigExportResult,
  type ScanConfigImportResult,
} from './share-mirror';
export {
  findCoveringParent,
  isPathCovered,
  dedupeWithInheritance,
} from './inheritance';
