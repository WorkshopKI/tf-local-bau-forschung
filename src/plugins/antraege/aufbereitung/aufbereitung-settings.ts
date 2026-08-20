/**
 * Antrag-Aufbereitung — geteilte Modul-Einstellungen auf dem Daten-Share (Paket 5).
 *
 * Sidecar `_intern/aufbereitung-settings.json` — Schreib-Profil **idempotent-overwrite**
 * (`atomicWrite` + Backup-Rotation; kleine Single-Source-of-Truth-Datei, Pitfall #10/#23).
 * Muster: `plugins/anfragen/settings.ts`. Team-weit: der Kurator setzt die Deep-Research-
 * Ziel-URLs + den Marktzugang-Schalter einmal, alle lesen sie.
 *
 * Auflösung: **Share-Override → IDB-Cache (Mirror, offline) → Build-Config/Code-Default**
 * (`getAufbereitungDrUrls`). Der `marktzugangAktiv`-Schalter ist Default AUS (identifizierend,
 * DSGVO) — ohne Sidecar-Eintrag bleibt der Marktzugang-Abschnitt im Recherche-Tab unsichtbar.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite, readTextLage } from '@/core/services/infrastructure/atomic-write';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { getAufbereitungDrUrls, type AufbereitungDrUrls } from '@/config/feature-flags';

export const AUFBEREITUNG_SETTINGS_PATH = '_intern/aufbereitung-settings.json';
const CACHE_KEY = 'aufbereitung-settings';

export interface AufbereitungSettings {
  version: 1;
  updatedAt?: string;
  /** Override-URLs der externen DR-Dienste. Leer/fehlt = Build-/Code-Default. */
  chatgptUrl?: string;
  claudeUrl?: string;
  mistralUrl?: string;
  /** „Marktzugang des KMU" (identifizierendes Template) freigeschaltet? Default AUS. */
  marktzugangAktiv?: boolean;
}

/** Effektiv wirksame Einstellungen (Overrides bereits gegen die Defaults aufgelöst). */
export interface EffektiveAufbereitungSettings {
  drUrls: AufbereitungDrUrls;
  marktzugangAktiv: boolean;
}

function trimOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Tolerantes Mapping unbekannter Eingaben auf das Schema (kein throw). */
function normalize(raw: unknown): AufbereitungSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
    chatgptUrl: trimOrUndef(o.chatgptUrl),
    claudeUrl: trimOrUndef(o.claudeUrl),
    mistralUrl: trimOrUndef(o.mistralUrl),
    marktzugangAktiv: o.marktzugangAktiv === true,
  };
}

/**
 * Die Settings vom Share — mit der LAGE der Datei.
 *
 * `readText` macht aus „liegt nicht da" und „liegt da, ließ sich aber nicht
 * lesen" beides `null`; `atomic-write.ts` schreibt die Regel dazu ausdrücklich
 * hin: wer anschließend SCHREIBT, nimmt `readTextLage`. Genau das tat der
 * Schreibpfad hier nicht — ein SMB-Aussetzer oder kaputtes JSON las sich als
 * „nichts konfiguriert", und ein Klick auf „Speichern" schrieb diesen leeren
 * Stand team-weit fest (v4.124, Pitfall #10/#23).
 */
export async function leseAufbereitungSettingsLage(
  idb: IDBStore,
): Promise<{ status: 'ok'; settings: AufbereitungSettings | null } | { status: 'unlesbar' }> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return { status: 'ok', settings: null };
  const lage = await readTextLage(handle, AUFBEREITUNG_SETTINGS_PATH);
  if (lage.status === 'unlesbar') return { status: 'unlesbar' };
  if (lage.status === 'leer') return { status: 'ok', settings: null };
  try {
    return { status: 'ok', settings: normalize(JSON.parse(lage.text)) };
  } catch {
    // Da IST etwas, es ist nur kaputt — kein „nichts konfiguriert".
    return { status: 'unlesbar' };
  }
}

/** Fehlertolerante Hülle für reine LESER (Formular-Vorbelegung, Anzeige). */
export async function readAufbereitungSettingsFromShare(idb: IDBStore): Promise<AufbereitungSettings | null> {
  const lage = await leseAufbereitungSettingsLage(idb);
  return lage.status === 'ok' ? lage.settings : null;
}

export async function getCachedAufbereitungSettings(idb: IDBStore): Promise<AufbereitungSettings | null> {
  return normalize(await idb.get(CACHE_KEY));
}

async function cacheAufbereitungSettings(idb: IDBStore, s: AufbereitungSettings): Promise<void> {
  await idb.set(CACHE_KEY, s);
}

/**
 * Schreibt die Settings team-weit auf den Share (atomicWrite + Audit) + IDB-Mirror.
 * Aufrufer MUSS vorher online + schreibberechtigt sein (`requireOnline()` + `canWriteDatenShare()`).
 */
export async function writeAufbereitungSettingsToShare(
  idb: IDBStore,
  patch: Partial<Omit<AufbereitungSettings, 'version' | 'updatedAt'>>,
  user: string,
): Promise<AufbereitungSettings> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) throw new Error('Kein Daten-Share verbunden.');
  // Read-Modify-Write NUR auf einer belegten Lage: bei `unlesbar` würde der
  // Merge auf einem leeren Stand aufsetzen und die vorhandenen Werte team-weit
  // überschreiben.
  const lage = await leseAufbereitungSettingsLage(idb);
  if (lage.status === 'unlesbar') {
    throw new Error(
      'Die Einstellungen auf dem Share ließen sich nicht lesen — nicht überschrieben. '
      + 'Bitte die Verbindung prüfen und erneut versuchen.',
    );
  }
  const current = lage.settings ?? { version: 1 as const };
  const merged = normalize({ ...current, ...patch, updatedAt: new Date().toISOString() })!;
  await atomicWrite(handle, AUFBEREITUNG_SETTINGS_PATH, JSON.stringify(merged, null, 2));
  await cacheAufbereitungSettings(idb, merged);
  await logAudit(idb, {
    action: 'aufbereitung_settings_updated',
    user,
    details: { marktzugangAktiv: merged.marktzugangAktiv ?? false },
  });
  return merged;
}

/** Rohe (nicht aufgelöste) Settings: Share-Override → IDB-Cache → null. */
export async function resolveRohAufbereitungSettings(idb: IDBStore): Promise<AufbereitungSettings | null> {
  const fromShare = await readAufbereitungSettingsFromShare(idb);
  if (fromShare) {
    await cacheAufbereitungSettings(idb, fromShare);
    return fromShare;
  }
  return getCachedAufbereitungSettings(idb);
}

/** Effektiv wirksame Einstellungen: Share-Override → IDB-Cache → Build-/Code-Default. */
export async function resolveAufbereitungSettings(idb: IDBStore): Promise<EffektiveAufbereitungSettings> {
  const defaults = getAufbereitungDrUrls();
  const s = await resolveRohAufbereitungSettings(idb);
  return {
    drUrls: {
      chatgpt: s?.chatgptUrl || defaults.chatgpt,
      claude: s?.claudeUrl || defaults.claude,
      mistral: s?.mistralUrl || defaults.mistral,
    },
    marktzugangAktiv: s?.marktzugangAktiv === true,
  };
}
