/**
 * Presence-Heartbeat-Writer.
 *
 * Schreibt `ZAH/online-status.json` in den persoenlichen Ordner. Schreib-Profil
 * „Atomic ohne Backup" (CLAUDE.md Pitfall #23): verlusttoleranter Single-Value,
 * der alle ~45 s ueberschrieben wird — `.backup`-Rotation waere reiner Churn.
 */
import { atomicWrite } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_ONLINE_STATUS_FILE } from '@/core/services/infrastructure/types';
import type { OnlineHeartbeat } from './types';

export async function writeHeartbeat(
  persHandle: FileSystemDirectoryHandle,
  hb: OnlineHeartbeat,
): Promise<void> {
  await atomicWrite(
    persHandle,
    PERSOENLICH_ONLINE_STATUS_FILE,
    JSON.stringify(hb, null, 2),
    { skipBackup: true },
  );
}
