/**
 * Variante „local": feste Entwickler-Ordner statt File-System-Access-API-Picker.
 *
 * Der gesamte Zweig hängt an `__TEAMFLOW_LOCAL_FS__` (siehe `vite.config.ts`) —
 * die Konstante ist in JEDEM Build `false`, Rollup eliminiert ihn. Siehe
 * docs/architecture/local-variante.md.
 */

export { wurzelHandle, LokalerVerzeichnisHandle } from './verzeichnis-handle';
export { LokalerDateiHandle, type LokalerWritable } from './datei-handle';
export { LocalFsTransport, ladeSlots, setzeBasis } from './transport';
export { WritablePuffer, type SchreibChunk, type SchreibAuftrag } from './writable-puffer';
export {
  SLOT_DATEN_SHARE,
  SLOT_PERSOENLICH,
  SLOT_USER_FOLDERS_ROOT,
  SLOT_CSV_SOURCE_DIR,
  SLOT_VORLAGEN,
  dmsSlot,
  istLokalerHandle,
  markiereAlsLokal,
  TF_LOKAL_BRAND,
} from './typen';
export {
  mitLokalenHandles,
  ohneLokaleHandles,
  lokalerSlotHandle,
  leseHandleKey,
  schreibeHandleKey,
} from './slots';
export { sorgeFuerLokalesProfil } from './boot';
