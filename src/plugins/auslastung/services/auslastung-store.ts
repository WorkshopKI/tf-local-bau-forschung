/**
 * auslastung.json — Load/Save auf den SMB-Share.
 *
 * Concurrent-Writes-Strategie: Last-Write-Wins. In der Praxis schreibt nur
 * die PL aktiv; MAs schreiben nur ihre eigene `manuelleTechnologien`-Liste
 * + ihre Selbsteintragungen.
 *
 * Schreib-Pfad ist via `FileServerStore.writeJSON` (interner createWritable)
 * — kein atomicWrite, da die Datei klein bleibt (max wenige 100 KB) und ein
 * Crash maximal die letzten paar Sekunden Schreibarbeit verliert.
 */
import type { StorageService } from '@/core/services/storage';
import {
  AUSLASTUNG_JSON_PATH,
  emptyAuslastungData,
  type AuslastungData,
} from '../types';

/** Liest die Datei oder gibt ein leeres Default zurueck. */
export async function loadAuslastungData(storage: StorageService): Promise<AuslastungData> {
  if (!storage.fs) return emptyAuslastungData();
  try {
    const exists = await storage.fs.exists(AUSLASTUNG_JSON_PATH);
    if (!exists) return emptyAuslastungData();
    const data = await storage.fs.readJSON<Partial<AuslastungData>>(AUSLASTUNG_JSON_PATH);
    return normalizeAuslastungData(data);
  } catch (err) {
    console.warn('[auslastung-store] readJSON failed, returning empty:', err);
    return emptyAuslastungData();
  }
}

/** Schreibt die Datei. Setzt `updatedAt`. Wirft falls fs read-only oder nicht verbunden. */
export async function saveAuslastungData(
  storage: StorageService,
  data: AuslastungData,
): Promise<AuslastungData> {
  if (!storage.fs) throw new Error('Daten-Share nicht verbunden');
  if (storage.fs.isReadOnly()) throw new Error('Daten-Share ist read-only');
  const next: AuslastungData = { ...data, updatedAt: new Date().toISOString() };
  await storage.fs.writeJSON(AUSLASTUNG_JSON_PATH, next);
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
