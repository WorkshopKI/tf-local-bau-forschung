/**
 * De-Anonymisierungs-Passwort-Handling (v2.5).
 *
 * Schaltet die Klartext-Anzeige der TIB-Kuerzel (statt MA01..MAxx) frei.
 * Verfuegbar nur in den dev/pl-Varianten — diese liegen auf einem
 * geschuetzten SMB-Bereich, der ohnehin nur PL/Dev-Rollen zugaenglich ist.
 * Das Passwort selbst liegt verschluesselt auf dem Daten-Share unter
 * `_intern/deanon-config.enc` (analog zu `kurator-config.enc`, selbes
 * AES-GCM-Format). EIN Passwort fuer alle PL-User des Teams.
 *
 * File-Layout (kompatibel zu pack/unpackKuratorConfigBlob):
 *   [16B salt][12B IV][N+16B ciphertext||tag]
 */

import {
  deriveKey,
  decrypt as cryptoDecrypt,
  encrypt as cryptoEncrypt,
  randomBytes,
  SALT_BYTES,
  packKuratorConfigBlob,
  unpackKuratorConfigBlob,
} from './crypto';
import { atomicWrite, readBinary, fileExists } from './atomic-write';
import { getSmbHandle } from './smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { DEANON_CONFIG_PATH, type DeAnonConfigPlain } from './types';

async function parentHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const parent = await getSmbHandle(idb);
  return parent ?? null;
}

export async function isDeAnonConfigured(idb: IDBStore): Promise<boolean> {
  const parent = await parentHandle(idb);
  if (!parent) return false;
  return fileExists(parent, DEANON_CONFIG_PATH);
}

/** Erstellt `_intern/deanon-config.enc` mit frischem Salt/IV. */
export async function setupDeAnonConfig(idb: IDBStore, password: string): Promise<void> {
  const parent = await parentHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfuegbar');
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  const plain: DeAnonConfigPlain = { version: 1, created: new Date().toISOString() };
  const ivAndCt = await cryptoEncrypt(JSON.stringify(plain), key);
  const blob = packKuratorConfigBlob(salt, ivAndCt);
  await atomicWrite(parent, DEANON_CONFIG_PATH, blob);
}

/** Prueft das Passwort durch Decrypt-Versuch. Returns DeAnonConfigPlain oder
 *  null bei falschem Passwort / fehlender Datei. */
export async function verifyDeAnonPassword(
  idb: IDBStore,
  password: string,
): Promise<DeAnonConfigPlain | null> {
  const parent = await parentHandle(idb);
  if (!parent) return null;
  const blob = await readBinary(parent, DEANON_CONFIG_PATH);
  if (!blob) return null;
  try {
    const { salt, ivAndCt } = unpackKuratorConfigBlob(blob);
    const key = await deriveKey(password, salt);
    const plaintext = await cryptoDecrypt(ivAndCt, key);
    return JSON.parse(plaintext) as DeAnonConfigPlain;
  } catch {
    return null;
  }
}

/** Entschluesselt mit oldPassword, reverschluesselt mit newPassword + neuem Salt. */
export async function changeDeAnonPassword(
  idb: IDBStore,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  const existing = await verifyDeAnonPassword(idb, oldPassword);
  if (!existing) return false;
  const parent = await parentHandle(idb);
  if (!parent) return false;
  const newSalt = randomBytes(SALT_BYTES);
  const newKey = await deriveKey(newPassword, newSalt);
  const ivAndCt = await cryptoEncrypt(JSON.stringify(existing), newKey);
  const blob = packKuratorConfigBlob(newSalt, ivAndCt);
  await atomicWrite(parent, DEANON_CONFIG_PATH, blob);
  return true;
}
