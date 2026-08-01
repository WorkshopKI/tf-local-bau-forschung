/**
 * Die Trigger-Tabelle als **Team-Datei** neben dem Status-Katalog:
 * `_intern/status-trigger.json`.
 *
 * Eigene Datei, gleiche Mechanik (`sidecar-datei.ts`) — die Begründung für den
 * Schnitt steht dort. Kurz: sie ist reine Fremddaten ohne Kuration und wiegt
 * mehr als der ganze Katalog; sie je Katalog-Fassung mitzuschleppen speicherte
 * zehnmal dasselbe und machte jedes Speichern über SMB dreimal so schwer.
 *
 * **Keine Fassungs-Historie, sondern ein Zähler.** Eine Trigger-Tabelle hat
 * keine Zwischenstände, die man vergleichen wollte: sie wird beim Import
 * vollständig ersetzt (was dabei wegfällt, hat der Diff vorher gezeigt). Der
 * Zähler sagt nur, wie oft importiert wurde — genug für „Stand v3, importiert am
 * 01.08.2026 von MUE".
 *
 * IndexedDB ist der lokale Cache: ohne Share (offline, kein Handle) arbeitet die
 * App mit dem zuletzt gesehenen Stand weiter und zeigt dessen Herkunft an.
 */
import type { IDBStore } from '@/core/services/storage';
import type { TriggerZeile } from './typen';
import { leseSidecar, schreibeSidecar } from './sidecar-datei';

export const STATUS_TRIGGER_PATH = '_intern/status-trigger.json';

/** kv-Key des lokalen Caches. */
export const TRIGGER_CACHE_KEY = 'status-trigger:cache';

export interface TriggerDatei {
  /** Dateiformat-Version, nicht der Import-Stand. */
  format: 1;
  /** Import-Zähler; steigt mit jedem übernommenen Blatt. */
  version: number;
  importiertAm: string;
  /** Kürzel des Importierenden (`useMeinKuerzel`), `null` wenn unbekannt. */
  importiertVon: string | null;
  trigger: TriggerZeile[];
}

/** Woher der aktuell geladene Stand kommt — wird in der Oberfläche angezeigt. */
export type TriggerHerkunft = 'share' | 'cache' | 'leer';

export interface TriggerStand {
  datei: TriggerDatei | null;
  herkunft: TriggerHerkunft;
}

/** Grobe Strukturprüfung; die Zeilen selbst kommen aus dem eigenen Parser. */
export function istTriggerDatei(raw: unknown): raw is TriggerDatei {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  return d.format === 1
    && typeof d.version === 'number' && Number.isFinite(d.version)
    && Array.isArray(d.trigger);
}

/**
 * Lädt den Trigger-Stand: Share zuerst, sonst der lokale Cache, sonst leer.
 *
 * Die Herkunft wird **mitgeliefert und angezeigt** — ein stiller Rückfall auf
 * einen alten Cache wäre genau die Art von Unehrlichkeit, die das
 * Vorgangssystem vermeiden soll. Ein vom Share geholter Stand aktualisiert den
 * Cache gleich mit.
 */
export async function ladeTrigger(idb: IDBStore): Promise<TriggerStand> {
  try {
    const vomShare = await leseSidecar(idb, STATUS_TRIGGER_PATH, istTriggerDatei);
    if (vomShare) {
      await idb.set(TRIGGER_CACHE_KEY, vomShare);
      return { datei: vomShare, herkunft: 'share' };
    }
  } catch (err) {
    console.warn('[status] ladeTrigger: Share nicht lesbar:', err);
  }
  const cache = await idb.get<unknown>(TRIGGER_CACHE_KEY);
  if (istTriggerDatei(cache)) return { datei: cache, herkunft: 'cache' };
  return { datei: null, herkunft: 'leer' };
}

/**
 * Schreibt eine importierte Tabelle: erst lokal in den Cache, dann für das Team
 * auf den Share. Diese Reihenfolge ist Absicht — schlägt der Share-Write fehl
 * (offline, kein Schreibrecht), ist die Arbeit trotzdem nicht verloren, sie gilt
 * nur noch nicht team-weit.
 *
 * Gibt zurück, ob die Veröffentlichung geklappt hat.
 */
export async function speichereTrigger(
  idb: IDBStore,
  zeilen: readonly TriggerZeile[],
  autor: string | null,
  bisherigeVersion: number,
  zeitstempel: string,
): Promise<{ datei: TriggerDatei; aufShare: boolean }> {
  const datei: TriggerDatei = {
    format: 1,
    version: bisherigeVersion + 1,
    importiertAm: zeitstempel,
    importiertVon: autor,
    trigger: zeilen.map(z => ({ ...z })),
  };
  await idb.set(TRIGGER_CACHE_KEY, datei);
  const aufShare = await schreibeSidecar(idb, STATUS_TRIGGER_PATH, datei);
  return { datei, aufShare };
}

/** Trigger-Zeilen eines Kürzels, in Folge-Reihenfolge. Rein. */
export function triggerFuerKuerzel(
  trigger: readonly TriggerZeile[], kuerzel: string,
): TriggerZeile[] {
  const gesucht = kuerzel.normalize('NFC').trim().toLowerCase();
  return trigger
    .filter(t => t.kuerzel.normalize('NFC').trim().toLowerCase() === gesucht)
    .sort((a, b) => a.folge - b.folge);
}
