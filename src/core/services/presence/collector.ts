/**
 * Presence-Collector (PL-Seite).
 *
 * Liest `ZAH/online-status.json` aus allen User-Ordnern unter dem
 * User-Folders-Root und berechnet je User „online?" (Heartbeat juenger als das
 * Stale-Fenster). Iterations-Muster gespiegelt von `collectUserProfiles`
 * (auslastung/services/profil-einsammeln.ts): `entry.name` (User-Ordner) ist
 * selbst der User-Home-Root, daher liest `readText(userDir, …)` direkt die
 * relative `ZAH/online-status.json`.
 *
 * Error-tolerant pro User-Ordner. `now`-Param macht die Stale-Logik
 * pure-testbar (kein `Date.now()` im Test noetig).
 */
import { readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_ONLINE_STATUS_FILE } from '@/core/services/infrastructure/types';
import { ONLINE_STALE_WINDOW_MS, type OnlineHeartbeat, type OnlineUser } from './types';

export function isValidHeartbeat(raw: unknown): raw is OnlineHeartbeat {
  if (!raw || typeof raw !== 'object') return false;
  const h = raw as Record<string, unknown>;
  return h.version === 1
    && typeof h.deviceId === 'string'
    && typeof h.lastActive === 'string';
}

function toOnlineUser(hb: OnlineHeartbeat, now: number): OnlineUser {
  const ageMs = now - Date.parse(hb.lastActive);
  return {
    display: hb.kuerzel || hb.name || `Gerät ${hb.deviceId.slice(0, 6)}`,
    kuerzel: hb.kuerzel,
    deviceId: hb.deviceId,
    lastActive: hb.lastActive,
    ageMs,
    online: ageMs >= 0 && ageMs < ONLINE_STALE_WINDOW_MS,
  };
}

export async function collectHeartbeats(
  root: FileSystemDirectoryHandle,
  now: number = Date.now(),
): Promise<OnlineUser[]> {
  const out: OnlineUser[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const txt = await readText(userDir, PERSOENLICH_ONLINE_STATUS_FILE);
      if (!txt) continue;
      const parsed: unknown = JSON.parse(txt);
      if (!isValidHeartbeat(parsed)) continue;
      out.push(toOnlineUser(parsed, now));
    } catch {
      // User-Ordner ohne ZAH/online-status.json oder kaputtes JSON → ueberspringen.
    }
  }
  return out;
}
