/**
 * Slot-Namen und Marker der Variante „local" — der Vertrag zwischen Client und
 * Server. **ZERO-IMPORT**, weil beide Seiten (Browser-Adapter und der über
 * `vite.config.ts` gebündelte Node-Handler) dieses Modul lesen.
 *
 * Die Slot-Namen sind bewusst DIESELBEN Strings wie die Handle-Slots in
 * `infrastructure/types.ts` (`SMB_HANDLE_*`). So kann `slots.ts` die Fake-Handles
 * ohne Übersetzungstabelle direkt in die `smb-handles`-Map einsetzen.
 */

/** Daten-Share-Wurzel (`programm/`, `_intern/`, `backups/`). */
export const SLOT_DATEN_SHARE = 'daten-share';
/** Home-Ordner des Users; die App navigiert selbst nach `ZAH/`. */
export const SLOT_PERSOENLICH = 'persoenlich';
/** Wurzel der Home-Laufwerke; Kinder = User-Verzeichnisse. */
export const SLOT_USER_FOLDERS_ROOT = 'user-folders-root';
/** Ordner der CSV-Quelldateien (eigener IDB-Key, nicht in der smb-handles-Map). */
export const SLOT_CSV_SOURCE_DIR = 'csv-source-dir';
/** Ordner der DOCX-Gutachten-Vorlagen. */
export const SLOT_VORLAGEN = 'gutachten-vorlagen';

/** Slot-Name einer DMS-Quelle. Spiegelt `dmsSourceSlotKey` aus `types.ts`. */
export function dmsSlot(sourceId: string): string {
  return `dms-source-${sourceId}`;
}

/**
 * Marker an synthetisierten Handles.
 *
 * Fake-Handles tragen Methoden und sind damit NICHT structured-cloneable —
 * `idb.set('smb-handles', map)` würfe `DataCloneError`. Der Fehler liefe still
 * durch (`App.tsx` fängt die Migration mit `console.warn`), deshalb muss
 * `writeAll` die Fakes wieder herausfiltern. Ein Symbol als Marker, weil es bei
 * `Object.keys`/`JSON.stringify` unsichtbar bleibt und nicht mit echten
 * Handle-Properties kollidieren kann.
 */
export const TF_LOKAL_BRAND: unique symbol = Symbol.for('teamflow.local-fs.handle');

/** Trägt dieser Wert den Lokal-Marker? */
export function istLokalerHandle(wert: unknown): boolean {
  return typeof wert === 'object' && wert !== null
    && (wert as Record<symbol, unknown>)[TF_LOKAL_BRAND] === true;
}

/**
 * Setzt den Marker — nicht-enumerierbar, damit er weder in Spreads noch in
 * `Object.keys` auftaucht.
 */
export function markiereAlsLokal<T extends object>(handle: T): T {
  Object.defineProperty(handle, TF_LOKAL_BRAND, {
    value: true, enumerable: false, writable: false, configurable: false,
  });
  return handle;
}
