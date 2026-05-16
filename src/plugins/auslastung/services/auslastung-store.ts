/**
 * auslastung.json — Load/Save auf den SMB-Share.
 *
 * Schreibt ueber `atomicWrite` (Phase-1a-Infrastruktur) auf den Daten-Share-
 * Handle aus dem `smb-handles`-IDB-Map. NICHT ueber `storage.fs` —
 * StorageService.fs ist ein Legacy-FileServerStore aus dem alten Onboarding,
 * der oft nicht gesetzt ist wenn der User den v1.9-Welcome-Flow benutzt hat.
 *
 * Concurrent-Writes-Strategie: Last-Write-Wins + atomicWrite (TMP + Rename
 * + Backup-Rotation, 1 Generation). In der Praxis schreibt nur die PL aktiv;
 * MAs schreiben nur ihre eigene `manuelleTechnologien`-Liste + ihre
 * Selbsteintragungen.
 */
import type { StorageService } from '@/core/services/storage';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import {
  AUSLASTUNG_JSON_PATH,
  AUSLASTUNG_JSON_PATH_LEGACY,
  emptyAuslastungData,
  type AuslastungData,
} from '../types';

async function readJsonAt(
  handle: FileSystemDirectoryHandle,
  path: string,
): Promise<Partial<AuslastungData> | null> {
  const text = await readText(handle, path);
  if (text == null) return null;
  try { return JSON.parse(text) as Partial<AuslastungData>; }
  catch (err) {
    console.warn(`[auslastung-store] JSON-Parse fehlgeschlagen fuer ${path}:`, err);
    return null;
  }
}

/**
 * Liest die Datei oder gibt ein leeres Default zurueck.
 *
 * Liest zuerst den aktuellen Pfad (`_intern/auslastung.json`). Wenn der
 * nicht existiert, Fallback auf den Legacy-Pfad (`_intern/auslastung/data.json`)
 * fuer pre-Mai-2026-Installationen. Beim naechsten Save wird der neue Pfad
 * geschrieben; die Legacy-Datei bleibt liegen (kein Delete-API).
 */
export async function loadAuslastungData(storage: StorageService): Promise<AuslastungData> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) {
    console.warn('[auslastung-store] kein Daten-Share-Handle — leere Daten zurueckgegeben');
    return emptyAuslastungData();
  }
  try {
    const data = await readJsonAt(handle, AUSLASTUNG_JSON_PATH);
    if (data) return normalizeAuslastungData(data);
    const legacy = await readJsonAt(handle, AUSLASTUNG_JSON_PATH_LEGACY);
    if (legacy) {
      console.info(
        '[auslastung-store] Legacy-Pfad gelesen (%s) — wird beim naechsten Save auf %s migriert.',
        AUSLASTUNG_JSON_PATH_LEGACY, AUSLASTUNG_JSON_PATH,
      );
      return normalizeAuslastungData(legacy);
    }
    return emptyAuslastungData();
  } catch (err) {
    console.warn('[auslastung-store] Load fehlgeschlagen, leere Daten zurueckgegeben:', err);
    return emptyAuslastungData();
  }
}

/** Schreibt die Datei via atomicWrite. Wirft falls Daten-Share nicht verbunden. */
export async function saveAuslastungData(
  storage: StorageService,
  data: AuslastungData,
): Promise<AuslastungData> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');
  const next: AuslastungData = { ...data, updatedAt: new Date().toISOString() };
  const json = JSON.stringify(next, null, 2);
  await atomicWrite(handle, AUSLASTUNG_JSON_PATH, json);
  return next;
}

/**
 * Stellt sicher dass alle Pflicht-Felder gesetzt sind. Migriert Alt-Datenstaende
 * (fehlende Felder werden mit Defaults gefuellt).
 */
function normalizeAuslastungData(raw: Partial<AuslastungData> | null | undefined): AuslastungData {
  const empty = emptyAuslastungData();
  if (!raw || typeof raw !== 'object') return empty;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : empty.updatedAt,
    config: { ...empty.config, ...(raw.config ?? {}) },
    mitarbeiter: raw.mitarbeiter && typeof raw.mitarbeiter === 'object' ? raw.mitarbeiter : {},
    klassifizierungen: Array.isArray(raw.klassifizierungen) ? raw.klassifizierungen : [],
    zuweisungen: Array.isArray(raw.zuweisungen) ? raw.zuweisungen : [],
  };
}
