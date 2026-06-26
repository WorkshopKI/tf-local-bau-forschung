/**
 * Modul „Anfragen" — geteilte Modul-Einstellungen auf dem Daten-Share.
 *
 * Sidecar `_intern/anfragen-settings.json` — Schreib-Profil **idempotent-overwrite**
 * (`atomicWrite` mit Backup-Rotation; kleine Single-Source-of-Truth-Datei, Pitfall
 * #10/#23). Team-weit: der Kurator setzt z.B. die ZIM-FAQ-Assistent-URL einmal,
 * alle lesen sie.
 *
 * Auflösungsreihenfolge der URL: **Share-Override → IDB-Cache (Mirror, offline) →
 * Build-Config/Code-Default** (`getAnfragenDashboardUrl`). Der Sidecar ist Mirror,
 * nicht Master — fehlt er / ist der Share offline, bleibt die App über den Fallback
 * funktional (Anti-Pattern „Sidecar als SoT ohne Cache").
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { getAnfragenDashboardUrl } from '@/config/feature-flags';

/** Sidecar-Pfad (genau ein Export pro Sidecar, hier im Plugin-Service). */
export const ANFRAGEN_SETTINGS_PATH = '_intern/anfragen-settings.json';
/** IDB-Mirror-Key (per-Variante-DB), damit Konsumenten offline weiterlaufen. */
const CACHE_KEY = 'anfragen-settings';

export interface AnfragenSettings {
  /** Schema-Version — bump bei Breaking-Change, Reader prüft. */
  version: 1;
  /** ISO-Datum des letzten Schreibens. */
  updatedAt?: string;
  /** Override-URL des externen ZIM-FAQ-Assistent-Artifacts. Leer/fehlt = Build-Default. */
  dashboardUrl?: string;
}

/** Tolerantes Mapping unbekannter Eingaben auf das Schema (kein throw). */
function normalize(raw: unknown): AnfragenSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.dashboardUrl === 'string' ? o.dashboardUrl.trim() : '';
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
    dashboardUrl: url || undefined,
  };
}

/** Liest den Sidecar vom Share. `null` wenn fehlt/offline/kaputt (kein throw). */
export async function readAnfragenSettingsFromShare(idb: IDBStore): Promise<AnfragenSettings | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  const raw = await readText(handle, ANFRAGEN_SETTINGS_PATH);
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Letzter erfolgreich gelesener/geschriebener Stand aus dem IDB-Mirror. */
export async function getCachedAnfragenSettings(idb: IDBStore): Promise<AnfragenSettings | null> {
  return normalize(await idb.get(CACHE_KEY));
}

async function cacheAnfragenSettings(idb: IDBStore, s: AnfragenSettings): Promise<void> {
  await idb.set(CACHE_KEY, s);
}

/**
 * Schreibt die Settings team-weit auf den Share (atomicWrite + Audit) und
 * aktualisiert den lokalen IDB-Mirror. Aufrufer MUSS vorher online +
 * schreibberechtigt sein (`requireOnline()` + `canWriteDatenShare()`).
 */
export async function writeAnfragenSettingsToShare(
  idb: IDBStore,
  patch: Partial<Omit<AnfragenSettings, 'version' | 'updatedAt'>>,
  user: string,
): Promise<AnfragenSettings> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) throw new Error('Kein Daten-Share verbunden.');
  const current = (await readAnfragenSettingsFromShare(idb)) ?? { version: 1 as const };
  const merged = normalize({ ...current, ...patch, updatedAt: new Date().toISOString() })!;
  await atomicWrite(handle, ANFRAGEN_SETTINGS_PATH, JSON.stringify(merged, null, 2));
  await cacheAnfragenSettings(idb, merged);
  await logAudit(idb, {
    action: 'anfragen_settings_updated',
    user,
    details: { dashboardUrl: merged.dashboardUrl ?? null },
  });
  return merged;
}

/**
 * Aktuell wirksame ZIM-FAQ-Assistent-URL: Share-Override → IDB-Cache →
 * Build-Config/Code-Default. Liest den Share best-effort frisch und spiegelt
 * einen Treffer in den Cache (offline-Resilienz für spätere Aufrufe).
 */
export async function resolveAnfragenDashboardUrl(idb: IDBStore): Promise<string> {
  const fromShare = await readAnfragenSettingsFromShare(idb);
  if (fromShare) {
    await cacheAnfragenSettings(idb, fromShare);
    if (fromShare.dashboardUrl) return fromShare.dashboardUrl;
  } else {
    const cached = await getCachedAnfragenSettings(idb);
    if (cached?.dashboardUrl) return cached.dashboardUrl;
  }
  return getAnfragenDashboardUrl();
}
