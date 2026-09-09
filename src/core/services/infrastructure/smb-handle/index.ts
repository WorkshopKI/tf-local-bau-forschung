/**
 * SMB-Handle-Manager (Phase 1a + v1.9 + v2.0).
 *
 * Persistiert mehrere File-System-Access-DirectoryHandles: Daten-Share,
 * persoenlicher Ordner, DMS-Quellen je Id, Wurzeln der persoenlichen Ordner.
 * IDB-Layout: Key `smb-handles` -> `Record<string, FileSystemDirectoryHandle>`;
 * der Legacy-Slot `test-programm` wird beim Laden transparent als Daten-Share
 * gelesen.
 *
 * Bis v6.42 war das EINE Datei mit 941 Zeilen und 98 Importeuren. Die Grenzen
 * standen darin schon als Kommentar-Banner; dieser Ordner setzt sie um. Zwei
 * Teile waren dabei gar keine Handle-Verwaltung: `share-struktur.ts` beschreibt
 * das LAYOUT des Shares und kennt keine IDB, und `permissions.ts` ist reine
 * Ablauf-Logik ueber den Slots — 37 % der Datei, und die fehleranfaelligste
 * Stelle, weil dort die file://-Regel „ein Prompt pro User-Gesture" haengt.
 *
 * Der Import-Spezifizierer bleibt buchstabengleich
 * `@/core/services/infrastructure/smb-handle` — alle 104 Importzeilen sind
 * unveraendert.
 *
 * Aus `kern.ts` wird bewusst NUR das re-exportiert, was vorher schon oeffentlich
 * war; `readAll`/`writeAll`/`pickDirectory` bleiben Innenleben. Submodule
 * importieren einander direkt, nie ueber dieses Barrel (Zyklus-Allowlist ist leer).
 */
export type { FsDirHandle, FsFileHandle, PickResult } from './kern';
export * from './daten-share';
export * from './dms-source';
export * from './share-struktur';
export * from './persoenlich';
export * from './user-folders-roots';
export * from './permissions';
