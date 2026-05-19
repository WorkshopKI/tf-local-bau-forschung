/**
 * PersonalStorage Sync-Logik (v2.0).
 *
 * Strategie:
 *   - Lesen: pers. Laufwerk -> IDB-Cache -> Defaults (Kaskade)
 *   - Schreiben: IDB sofort, Laufwerk async best-effort
 *   - Konflikt-Resolution: `updatedAt`-Timestamp, neuerer gewinnt (Last-Writer-Wins)
 *
 * Pattern angelehnt an snapshot-sync.ts (Day-Throttle entfaellt, weil
 * Personal-Storage on-demand schreibt und nicht pollt).
 */

import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import {
  PERSOENLICH_EINSTELLUNGEN_FILE,
  PERSOENLICH_PROFILE_FILE,
} from '@/core/services/infrastructure/types';
import type { UserProfile } from '@/core/types/config';
import type { PersonalEinstellungen } from './types';

export const DEFAULT_EINSTELLUNGEN: PersonalEinstellungen = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  filterPresets: [],
  viewPreferences: {},
  lastSyncTimestamp: null,
};

export function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

export async function readEinstellungenFromShare(
  handle: FileSystemDirectoryHandle,
): Promise<PersonalEinstellungen | null> {
  const txt = await readText(handle, PERSOENLICH_EINSTELLUNGEN_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt) as PersonalEinstellungen;
    if (parsed && typeof parsed === 'object' && parsed.version === 1) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function writeEinstellungenToShare(
  handle: FileSystemDirectoryHandle,
  data: PersonalEinstellungen,
): Promise<void> {
  await atomicWrite(handle, PERSOENLICH_EINSTELLUNGEN_FILE, JSON.stringify(data, null, 2));
}

export async function readProfileFromShare(
  handle: FileSystemDirectoryHandle,
): Promise<UserProfile | null> {
  const txt = await readText(handle, PERSOENLICH_PROFILE_FILE);
  if (!txt) return null;
  try {
    return JSON.parse(txt) as UserProfile;
  } catch {
    return null;
  }
}

export async function writeProfileToShare(
  handle: FileSystemDirectoryHandle,
  profile: UserProfile,
): Promise<void> {
  await atomicWrite(handle, PERSOENLICH_PROFILE_FILE, JSON.stringify(profile, null, 2));
}
