/**
 * Slot-Registry der Variante „local" — hier trifft die Brücke auf den App-Code.
 *
 * `mitLokalenHandles` ergänzt die aus IndexedDB gelesene Handle-Map um
 * synthetische Handles; `ohneLokaleHandles` entfernt sie vor dem Zurückschreiben.
 * Beide Richtungen sind Pflicht:
 *
 * Fake-Handles tragen Methoden und sind damit NICHT structured-cloneable —
 * `idb.set('smb-handles', map)` würfe `DataCloneError`. Und dieser Schreibpfad
 * läuft bei JEDEM Start (`App.tsx` → `migrateLegacyDmsSource` → `writeAll`),
 * wo der Fehler nur als `console.warn` landet. Ein rein lesender Hook hätte
 * also einen stillen, bei jedem Start wiederkehrenden Fehler erzeugt.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { runtimeConfig } from '@/config/runtime-config';
import { wurzelHandle } from './verzeichnis-handle';
import {
  SLOT_DATEN_SHARE,
  SLOT_PERSOENLICH,
  SLOT_USER_FOLDERS_ROOT,
  SLOT_CSV_SOURCE_DIR,
  SLOT_VORLAGEN,
  dmsSlot,
  istLokalerHandle,
} from './typen';

type HandleMap = Record<string, FileSystemDirectoryHandle>;

/**
 * Slot-Namen, die aus dem `local`-Config-Block in die `smb-handles`-Map gehören.
 *
 * Der Legacy-Slot `dokumentenquelle` fehlt hier ABSICHTLICH: `migrateLegacyDmsSource`
 * (App.tsx, läuft bei jedem Start) räumt ihn auf, sobald er existiert — und
 * schreibt dabei die Map zurück. DMS-Quellen bekommen direkt `dms-source-<id>`.
 */
function smbSlotNamen(): string[] {
  const local = runtimeConfig.local;
  if (!local) return [];
  const namen: string[] = [];
  if (local.datenShare) namen.push(SLOT_DATEN_SHARE);
  if (local.persoenlich) namen.push(SLOT_PERSOENLICH);
  if (local.userFoldersRoot) namen.push(SLOT_USER_FOLDERS_ROOT);
  for (const id of Object.keys(local.dmsSources ?? {})) namen.push(dmsSlot(id));
  return namen;
}

/** Anzeigename eines Slots (`handle.name`) — der letzte Pfad-Abschnitt. */
function anzeigeName(pfad: string): string {
  const teile = pfad.replace(/[\\/]+$/, '').split(/[\\/]/);
  return teile[teile.length - 1] || pfad;
}

function pfadFuerSlot(slot: string): string | null {
  const local = runtimeConfig.local;
  if (!local) return null;
  if (slot === SLOT_DATEN_SHARE) return local.datenShare ?? null;
  if (slot === SLOT_PERSOENLICH) return local.persoenlich ?? null;
  if (slot === SLOT_USER_FOLDERS_ROOT) return local.userFoldersRoot ?? null;
  if (slot === SLOT_CSV_SOURCE_DIR) return local.csvSourceDir ?? null;
  if (slot === SLOT_VORLAGEN) return local.vorlagenDir ?? null;
  for (const [id, pfad] of Object.entries(local.dmsSources ?? {})) {
    if (slot === dmsSlot(id)) return pfad;
  }
  return null;
}

/**
 * Synthetischer Handle für einen Slot — oder `null`, wenn nicht konfiguriert.
 * Jeder Aufruf liefert einen frischen Handle; sie sind zustandslos (nur
 * Slot + relativer Pfad) und damit beliebig oft erzeugbar.
 */
export function lokalerSlotHandle(slot: string): FileSystemDirectoryHandle | null {
  const pfad = pfadFuerSlot(slot);
  if (!pfad) return null;
  return wurzelHandle(slot, anzeigeName(pfad)) as unknown as FileSystemDirectoryHandle;
}

/**
 * Ergänzt die gelesene Map um die konfigurierten Slots.
 *
 * Echte (persistierte) Handles gewinnen NICHT — im Lokal-Modus soll konsequent
 * die Brücke gelten, auch wenn in der IDB noch ein echtes Handle aus einer
 * früheren Sitzung liegt. Andernfalls hinge das Verhalten vom IDB-Zustand ab
 * und wäre nicht reproduzierbar.
 */
export function mitLokalenHandles(map: HandleMap): HandleMap {
  const ergebnis: HandleMap = { ...map };
  for (const slot of smbSlotNamen()) {
    const handle = lokalerSlotHandle(slot);
    if (handle) ergebnis[slot] = handle;
  }
  return ergebnis;
}

/**
 * Entfernt synthetische Handles vor dem Persistieren. Ohne diesen Filter wirft
 * `idb.set` `DataCloneError` (siehe Modul-Kommentar).
 */
export function ohneLokaleHandles(map: HandleMap): HandleMap {
  const ergebnis: HandleMap = {};
  for (const [slot, handle] of Object.entries(map)) {
    if (!istLokalerHandle(handle)) ergebnis[slot] = handle;
  }
  return ergebnis;
}

/**
 * IDB-Keys, die EIN Handle direkt halten (statt einer Map) und deshalb nicht
 * über `mitLokalenHandles` laufen. Beide liegen bewusst ausserhalb der
 * `smb-handles`-Map — siehe `infrastructure/types.ts`.
 */
const EINZEL_HANDLE_KEYS: Record<string, string> = {
  'csv-source-dir-handle': SLOT_CSV_SOURCE_DIR,
  'gutachten-vorlagen-dir': SLOT_VORLAGEN,
};

/**
 * Liest einen Einzel-Handle-Key — im Lokal-Modus synthetisch, sonst aus der IDB.
 *
 * Als Leaf-Helper hier und nicht im Plugin, weil `infrastructure/` nicht aus
 * `plugins/` importieren darf (Zyklus). `csv-source-handle.ts` importiert
 * ohnehin schon aus `infrastructure/types`.
 */
export async function leseHandleKey<T>(idb: IDBStore, key: string): Promise<T | null> {
  if (__TEAMFLOW_LOCAL_FS__) {
    const slot = EINZEL_HANDLE_KEYS[key];
    if (slot) {
      const handle = lokalerSlotHandle(slot);
      if (handle) return handle as unknown as T;
    }
  }
  return (await idb.get<T>(key)) ?? null;
}

/**
 * Schreibt einen Einzel-Handle-Key — im Lokal-Modus ein No-op für synthetische
 * Handles (die sind nicht klonbar und werden ohnehin bei jedem Lesen neu gebaut).
 */
export async function schreibeHandleKey(idb: IDBStore, key: string, wert: unknown): Promise<void> {
  if (__TEAMFLOW_LOCAL_FS__ && istLokalerHandle(wert)) return;
  await idb.set(key, wert);
}
