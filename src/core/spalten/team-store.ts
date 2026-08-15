/**
 * Persistenz der TEAM-Spalten — dieselbe Definition, andere Reichweite.
 *
 * Ablage: eigene Sidecar `_intern/eigene-spalten.json`. Sidecar-Profil
 * (Pitfall #23): **idempotent-overwrite** mit Backup-Rotation, also der Default
 * von `atomicWrite` (Pitfall #10). Kein Append-Log: die Datei ist ein Zustand
 * („welche Spalten bietet das Team an"), keine Historie.
 *
 * **Schreiben ist self-gated** (`queryPermission`) — wer kein `readwrite` auf
 * den Share hat, läuft als No-op und bekommt `false` zurück, statt an einem
 * `NotAllowedError` zu zerschellen. Das Prädikat `canManageTeamSpalten` steuert
 * nur, ob die Bedienelemente überhaupt erscheinen; der physische Guard ist
 * diese Stelle. Gelesen wird von allen, ohne Recht und ohne Kurator-Sitzung.
 *
 * **Der IDB-Cache ist ein Cache des Share-Standes, kein persönlicher Zustand.**
 * Er existiert für zwei Fälle: Start ohne erreichbaren Share (die Spalten sind
 * dann trotzdem da) und die Projektions-Signatur, die beim Booten schon
 * feststehen muss. Er liegt im generischen `kv`-Store — kein eigener
 * Object-Store, kein DB-Version-Bump (ein Bump triggert unter `file://` mit
 * parallel offenen Varianten ein `onblocked`-Upgrade).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { leseSpaltenListe, nurHerkunft } from './lesen';
import type { EigeneSpalte } from './typen';

export const TEAM_SPALTEN_PATH = '_intern/eigene-spalten.json';
/** Zuletzt gelesener Share-Stand. Cache, nicht Quelle. */
export const TEAM_SPALTEN_CACHE_KEY = 'eigene-spalten:team-cache';

interface TeamSpaltenDatei {
  version: 1;
  updated_at: string;
  spalten: EigeneSpalte[];
}

/**
 * Datei-Inhalt → Definitionen. Tolerant wie die persönliche Seite, zusätzlich
 * auf die Herkunft `team` gefiltert — siehe `nurHerkunft`.
 */
export function leseTeamDatei(raw: unknown): EigeneSpalte[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const o = raw as Record<string, unknown>;
  return nurHerkunft(leseSpaltenListe(o.spalten), 'team');
}

async function cache(idb: IDBStore, spalten: readonly EigeneSpalte[]): Promise<void> {
  await idb.set(TEAM_SPALTEN_CACHE_KEY, spalten).catch(() => { /* Cache ist entbehrlich */ });
}

/**
 * Die Team-Spalten, so gut es geht: Share zuerst, sonst der zuletzt gesehene
 * Stand.
 *
 * **Eine fehlende Datei ist etwas anderes als ein unerreichbarer Share.** Fehlt
 * sie, gibt es schlicht keine Team-Spalten — dann muss der Cache geleert
 * werden, sonst überlebte eine gelöschte Spalte auf jedem Gerät, das sie einmal
 * gesehen hat. Ist der Share weg, bleibt der Cache stehen: er ist das Beste,
 * was wir wissen.
 */
export async function ladeTeamSpalten(idb: IDBStore): Promise<EigeneSpalte[]> {
  const handle = await getDatenShareHandle(idb).catch(() => null);
  if (handle) {
    try {
      const text = await readText(handle, TEAM_SPALTEN_PATH);
      const spalten = text == null ? [] : leseTeamDatei(JSON.parse(text));
      await cache(idb, spalten);
      return spalten;
    } catch (err) {
      console.warn('[eigene-spalten] Team-Sidecar nicht lesbar:', err);
    }
  }
  const gecacht = await idb.get<unknown>(TEAM_SPALTEN_CACHE_KEY).catch(() => null);
  return nurHerkunft(leseSpaltenListe(gecacht), 'team');
}

/**
 * Schreibt die Team-Spalten atomar auf den Share. `false` = nicht geschrieben
 * (kein Share, kein Recht, Fehler) — der Aufrufer sagt das dem Menschen, statt
 * einen Erfolg zu behaupten. Audit-Eintrag legt der Aufrufer (er kennt die
 * Identität).
 */
export async function schreibeTeamSpalten(
  idb: IDBStore, spalten: readonly EigeneSpalte[],
): Promise<boolean> {
  const handle = await getDatenShareHandle(idb).catch(() => null);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  const datei: TeamSpaltenDatei = {
    version: 1,
    updated_at: new Date().toISOString(),
    spalten: nurHerkunft(spalten, 'team'),
  };
  try {
    await atomicWrite(handle, TEAM_SPALTEN_PATH, JSON.stringify(datei, null, 2));
  } catch (err) {
    console.error('[eigene-spalten] Team-Sidecar nicht schreibbar:', err);
    return false;
  }
  await cache(idb, datei.spalten);
  return true;
}
