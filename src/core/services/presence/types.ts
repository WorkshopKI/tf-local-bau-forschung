/**
 * Presence („Online"-Status) — Datenmodell.
 *
 * Serverless (`file://`, kein Backend): jeder Client schreibt periodisch eine
 * Heartbeat-Datei in seinen persoenlichen Ordner; die PL sammelt sie ueber den
 * User-Folders-Root ein. Kein Echtzeit-Presence — „online" heisst „Heartbeat
 * juenger als das Stale-Fenster". Schreib-Profil + Sammel-Pfad: CLAUDE.md
 * Pitfall #23 (Atomic ohne Backup) + #24 (Personal-Folder-Flow).
 */

/** Persistierter Heartbeat (`ZAH/online-status.json`). */
export interface OnlineHeartbeat {
  version: 1;
  /** Effektives Bearbeiter-Kuerzel (useMeinKuerzel), falls gesetzt. */
  kuerzel?: string;
  /** Profil-Anzeigename (UserProfile.name, Pflichtfeld → i.d.R. gesetzt). */
  name?: string;
  /** Stabile geraete-/browser-lokale ID (IDB) — immer gesetzt. */
  deviceId: string;
  /** ISO-Zeitstempel des letzten Heartbeats. */
  lastActive: string;
  /** App-Version des schreibenden Clients (Diagnose). */
  appVersion: string;
  /** Build-Variante des schreibenden Clients (Diagnose). */
  variant: string;
}

/** Aufbereiteter Eintrag fuer die „Online"-Liste (Collector-Output). */
export interface OnlineUser {
  /** Anzeigename: kuerzel ?? name ?? `Gerät <id6>`. */
  display: string;
  kuerzel?: string;
  deviceId: string;
  lastActive: string;
  /** ms seit lastActive (relativ zum Sammel-Zeitpunkt). */
  ageMs: number;
  /** ageMs in [0, ONLINE_STALE_WINDOW_MS). */
  online: boolean;
}

/** Heartbeat juenger als dieses Fenster ⇒ „online". 5 Min ≈ 6× Schreibintervall. */
export const ONLINE_STALE_WINDOW_MS = 5 * 60_000;
