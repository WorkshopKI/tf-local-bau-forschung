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
import { normKey } from './normalisierung';
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
 * Zeilen aus einer Fassung VOR der Programm-Dimension (v2.380) tragen kein
 * `programm`. Sie bekommen hier `''` — das matcht nie einen Antrag, und die
 * Referenzdaten-Sektion zählt sie und bittet um einen neuen Import.
 *
 * Bewusst kein Ersatzwert: „gehört zu Programm 76" wäre geraten, und der Bestand
 * ist genau deshalb falsch, weil ihm ein Programm zugeschrieben wurde, das er
 * nicht hat.
 */
export function heileTriggerDatei(datei: TriggerDatei): TriggerDatei {
  if (datei.trigger.every(z => typeof z.programm === 'string')) return datei;
  return {
    ...datei,
    trigger: datei.trigger.map(z => ({ ...z, programm: typeof z.programm === 'string' ? z.programm : '' })),
  };
}

/** Wie viele Zeilen ohne Programm-Angabe geführt werden (Alt-Import). */
export function zeilenOhneProgramm(trigger: readonly TriggerZeile[]): number {
  return trigger.filter(z => !z.programm.trim()).length;
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
      return { datei: heileTriggerDatei(vomShare), herkunft: 'share' };
    }
  } catch (err) {
    console.warn('[status] ladeTrigger: Share nicht lesbar:', err);
  }
  const cache = await idb.get<unknown>(TRIGGER_CACHE_KEY);
  if (istTriggerDatei(cache)) return { datei: heileTriggerDatei(cache), herkunft: 'cache' };
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
  const gesucht = normKey(kuerzel);
  return trigger
    .filter(t => normKey(t.kuerzel) === gesucht)
    .sort((a, b) => a.folge - b.folge);
}

/**
 * Die Zeilen EINES Programms. Rein.
 *
 * `null`/leeres Programm liefert eine leere Liste — nie die ganze Tabelle. Ein
 * Antrag, dessen Programm wir nicht kennen, bekommt lieber gar keine Trigger als
 * die eines fremden Programms; die Oberfläche sagt dann, welcher der beiden
 * Fälle vorliegt.
 */
export function triggerFuerProgramm(
  trigger: readonly TriggerZeile[], programm: string | null,
): TriggerZeile[] {
  const gesucht = normKey(programm ?? '');
  if (!gesucht) return [];
  return trigger.filter(t => normKey(t.programm) === gesucht);
}

/** Welche Programme die Tabelle führt, aufsteigend (numerisch, wo möglich). */
export function programmeInTrigger(trigger: readonly TriggerZeile[]): string[] {
  const gesehen = new Map<string, string>();
  for (const t of trigger) {
    const p = t.programm.trim();
    if (p && !gesehen.has(normKey(p))) gesehen.set(normKey(p), p);
  }
  return [...gesehen.values()].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}
