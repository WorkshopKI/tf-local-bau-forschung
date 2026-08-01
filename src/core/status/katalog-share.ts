/**
 * Der Status-Katalog als **Team-Datei** auf dem Daten-Share.
 *
 * Bis v2.331 war der Katalog gerätelokal — mit der Folge, dass eine Kuration nur
 * auf dem Rechner wirkte, auf dem sie stattfand: entweder kuratierte niemand oder
 * jeder neu. Seit v2.332 liegt er als Sidecar `_intern/status-katalog.json`
 * neben dem Meilenstein-Plan; die IndexedDB bleibt der lokale Cache.
 *
 * **Das Event-Log wandert ausdrücklich NICHT mit.** Es hält fest, wann *diese
 * Installation* eine Änderung beobachtet hat (`erfasstAm` = Importzeitpunkt auf
 * diesem Gerät, Backfill-Marke je Programm). Zwei Rechner, die an verschiedenen
 * Tagen importieren, schreiben für denselben Vorgang verschiedene Zeitstempel —
 * zusammengeführt ergäbe das eine widersprüchliche Historie. Der Guard
 * `status-event-log-local-only` sichert das ab.
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite mit Backup-Rotation,
 * self-gated über `queryPermission` — ohne Schreibrecht ein No-op statt eines
 * Fehlers. Kein DB-Version-Bump: der bestehende Store `status_katalog` wird zum
 * Cache umgedeutet, nicht ersetzt.
 *
 * Die eigentliche Datei-Mechanik wohnt seit dem Vorgangssystem in
 * `sidecar-datei.ts` und wird mit der Trigger-Tabelle geteilt — zwei Dateien,
 * eine Mechanik.
 */
import type { IDBStore } from '@/core/services/storage';
import type { MappingVersion } from './typen';
import { leseSidecar, schreibeSidecar } from './sidecar-datei';
import { getAktiveVersionsnummer, listeVersionen, setzeAktiv, speichereVersion } from './katalog-store';

export const STATUS_KATALOG_PATH = '_intern/status-katalog.json';

/**
 * Einmalige Sicherung des lokalen Standes VOR der ersten Share-Übernahme. Eine
 * Fassung, die es auf dem Share unter derselben Nummer auch gibt, wird beim
 * Übernehmen überschrieben — ohne diese Kopie wäre lokale Kuration aus der Zeit
 * vor der Umstellung unwiederbringlich.
 */
export const KATALOG_BACKUP_KEY = 'status-katalog:vor-share-uebernahme';

export interface StatusKatalogDatei {
  /** Dateiformat-Version, nicht die Katalog-Fassung. */
  version: 1;
  /** Nummer der team-weit gültigen Fassung. */
  aktiv: number;
  fassungen: MappingVersion[];
  updatedAt: string;
}

/** Grobe Strukturprüfung; Feld-Details prüft `validiereImport` beim JSON-Import. */
export function istKatalogDatei(raw: unknown): raw is StatusKatalogDatei {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (typeof d.aktiv !== 'number' || !Number.isFinite(d.aktiv)) return false;
  if (!Array.isArray(d.fassungen) || d.fassungen.length === 0) return false;
  return d.fassungen.every(f => {
    if (!f || typeof f !== 'object') return false;
    const v = f as Record<string, unknown>;
    return typeof v.version === 'number'
      && Array.isArray(v.felder) && Array.isArray(v.werte) && Array.isArray(v.regeln);
  });
}

/** Liest die Team-Fassung vom Share (`null` wenn fehlend/offline/kaputt). */
export async function leseKatalogVomShare(idb: IDBStore): Promise<StatusKatalogDatei | null> {
  return await leseSidecar(idb, STATUS_KATALOG_PATH, istKatalogDatei);
}

/**
 * Schreibt den lokalen Katalog-Stand als Team-Fassung. Self-gated: ohne
 * readwrite-Berechtigung ein No-op (`false`) statt eines NotAllowedError — der
 * Aufrufer sagt dem Nutzer dann, dass die Fassung nur lokal gilt.
 */
export async function schreibeKatalogAufShare(idb: IDBStore): Promise<boolean> {
  try {
    const fassungen = await listeVersionen(idb);
    const aktiv = await getAktiveVersionsnummer(idb);
    if (fassungen.length === 0 || aktiv == null) return false;
    const datei: StatusKatalogDatei = {
      version: 1,
      aktiv,
      fassungen,
      updatedAt: new Date().toISOString(),
    };
    return await schreibeSidecar(idb, STATUS_KATALOG_PATH, datei);
  } catch (err) {
    console.error('[status] schreibeKatalogAufShare failed:', err);
    return false;
  }
}

/**
 * Übernimmt die Team-Fassung in den lokalen Cache und setzt den Aktiv-Zeiger.
 *
 * Fassungen, die es lokal unter einer Nummer gibt, die der Share nicht kennt,
 * bleiben unangetastet — sie verschwinden nicht, sondern stehen weiter in der
 * Versionsliste. Gleichnummerige werden vom Share überschrieben; genau davor
 * schützt die einmalige Sicherung unter `KATALOG_BACKUP_KEY`.
 *
 * Gibt zurück, ob etwas übernommen wurde.
 */
export async function uebernehmeKatalogVomShare(
  idb: IDBStore, datei: StatusKatalogDatei,
): Promise<boolean> {
  const lokal = await listeVersionen(idb);
  const bereitsGesichert = (await idb.get<unknown>(KATALOG_BACKUP_KEY)) != null;
  if (!bereitsGesichert && lokal.length > 0) {
    await idb.set(KATALOG_BACKUP_KEY, {
      gesichertAm: new Date().toISOString(),
      aktiv: await getAktiveVersionsnummer(idb),
      fassungen: lokal,
    });
  }

  for (const fassung of datei.fassungen) await speichereVersion(idb, fassung);
  const aktivVorhanden = datei.fassungen.some(f => f.version === datei.aktiv);
  await setzeAktiv(idb, aktivVorhanden ? datei.aktiv : datei.fassungen[0]!.version);
  return true;
}

/**
 * Startup-Abgleich: Team-Fassung holen, wenn es eine gibt. Best-effort — ohne
 * Share (offline, kein Handle, keine Datei) bleibt der lokale Stand maßgeblich,
 * damit die App genauso funktioniert wie vor der Umstellung.
 */
export async function synchronisiereKatalogVomShare(idb: IDBStore): Promise<boolean> {
  try {
    const datei = await leseKatalogVomShare(idb);
    if (!datei) return false;
    return await uebernehmeKatalogVomShare(idb, datei);
  } catch (err) {
    console.warn('[status] synchronisiereKatalogVomShare fehlgeschlagen:', err);
    return false;
  }
}
