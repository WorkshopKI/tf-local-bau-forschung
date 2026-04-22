/**
 * kurator-config.enc Handling (Phase 1a + v1.9).
 *
 * File-Layout (Sektion 10.3): [16B salt][12B IV][N+16B ciphertext||tag]
 *
 * v1.9: Datei liegt jetzt im Daten-Share-Root unter `_intern/kurator-config.enc`
 * (nicht mehr in `programm-test/admin/admin-config.enc`). Beim Lesen wird als
 * Fallback der Legacy-Pfad geprüft, bis die Migration gelaufen ist. Writes
 * erfolgen ausschließlich an die neue Position.
 */

import {
  deriveKey,
  decrypt as cryptoDecrypt,
  encrypt as cryptoEncrypt,
  randomBytes,
  SALT_BYTES,
  packKuratorConfigBlob,
  unpackKuratorConfigBlob,
  machineFingerprint,
} from './crypto';
import { atomicWrite, readBinary, readText, fileExists } from './atomic-write';
import { getInternHandle, getProgrammHandle, getSmbHandle } from './smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { KURATOR_CONFIG_PATH, LEGACY_KURATOR_CONFIG_PATH, KURATOR_NAME_LOCAL_IDB_KEY } from './types';
import type { KuratorConfigPlain } from './types';

async function parentHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const parent = await getSmbHandle(idb);
  return parent ?? null;
}

async function programmHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const parent = await parentHandle(idb);
  if (!parent) return null;
  try {
    return await getProgrammHandle(parent);
  } catch {
    return null;
  }
}

/** Liest Binary mit Fallback von neuem auf Legacy-Pfad. */
async function readKuratorConfigBlob(idb: IDBStore): Promise<Uint8Array | null> {
  const parent = await parentHandle(idb);
  if (!parent) return null;
  const viaNew = await readBinary(parent, KURATOR_CONFIG_PATH);
  if (viaNew) return viaNew;
  const programm = await programmHandle(idb);
  if (!programm) return null;
  return readBinary(programm, LEGACY_KURATOR_CONFIG_PATH);
}

export async function isKuratorConfigured(idb: IDBStore): Promise<boolean> {
  const parent = await parentHandle(idb);
  if (!parent) return false;
  if (await fileExists(parent, KURATOR_CONFIG_PATH)) return true;
  const programm = await programmHandle(idb);
  if (!programm) return false;
  return fileExists(programm, LEGACY_KURATOR_CONFIG_PATH);
}

/** Erstellt kurator-config.enc mit frischem Salt/IV + schreibt kurator-name-{fp}.txt. */
export async function setupKuratorConfig(
  idb: IDBStore,
  kuratorName: string,
  password: string,
): Promise<void> {
  const parent = await parentHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  const plain: KuratorConfigPlain = { version: 1, kuratorName, created: new Date().toISOString() };
  const ivAndCt = await cryptoEncrypt(JSON.stringify(plain), key);
  const blob = packKuratorConfigBlob(salt, ivAndCt);
  await atomicWrite(parent, KURATOR_CONFIG_PATH, blob);
  await writeKuratorName(idb, kuratorName);
}

/**
 * Prüft Passwort durch Decrypt-Versuch. Gibt den im File hinterlegten
 * kuratorName zurück oder null bei falschem Passwort / fehlendem Config.
 *
 * Kompat-Fallback: Alte Configs enthalten `adminName` statt `kuratorName`;
 * wird beim Einlesen auf das neue Feld gemappt. Zusätzlich wird der
 * Legacy-Pfad `admin/admin-config.enc` als Fallback gelesen.
 */
export async function verifyPassword(
  idb: IDBStore,
  password: string,
): Promise<KuratorConfigPlain | null> {
  const blob = await readKuratorConfigBlob(idb);
  if (!blob) return null;
  try {
    const { salt, ivAndCt } = unpackKuratorConfigBlob(blob);
    const key = await deriveKey(password, salt);
    const plaintext = await cryptoDecrypt(ivAndCt, key);
    const parsed = JSON.parse(plaintext) as KuratorConfigPlain & { adminName?: string };
    const kuratorName = parsed.kuratorName ?? parsed.adminName ?? '';
    return { version: 1, kuratorName, created: parsed.created };
  } catch {
    return null;
  }
}

/**
 * Entschlüsselt mit oldPassword, reverschlüsselt mit newPassword und frischem
 * Salt/IV. Schreibt die neue Datei an den v1.9-Pfad (Legacy-Datei bleibt vorerst
 * bis zur Migration).
 */
export async function changeKuratorPassword(
  idb: IDBStore,
  oldPassword: string,
  newPassword: string,
): Promise<boolean> {
  const existing = await verifyPassword(idb, oldPassword);
  if (!existing) return false;
  const parent = await parentHandle(idb);
  if (!parent) return false;
  const newSalt = randomBytes(SALT_BYTES);
  const newKey = await deriveKey(newPassword, newSalt);
  const ivAndCt = await cryptoEncrypt(JSON.stringify(existing), newKey);
  const blob = packKuratorConfigBlob(newSalt, ivAndCt);
  await atomicWrite(parent, KURATOR_CONFIG_PATH, blob);
  return true;
}

/** Rechnerspezifischer Kurator-Name im `_intern/kurator-name-{fp}.txt`. */
function kuratorNameFilename(fingerprint: string): string {
  return `kurator-name-${fingerprint}.txt`;
}

export async function writeKuratorName(idb: IDBStore, kuratorName: string): Promise<void> {
  const parent = await parentHandle(idb);
  if (!parent) return;
  const intern = await getInternHandle(parent);
  const fp = await machineFingerprint();
  await atomicWrite(intern, kuratorNameFilename(fp), kuratorName, { skipBackup: true });
  await idb.set(KURATOR_NAME_LOCAL_IDB_KEY, kuratorName);
}

/** Priorisiert die rechnerspezifische Datei (neu + legacy), dann IDB-Cache. */
export async function readKuratorName(idb: IDBStore): Promise<string | null> {
  const parent = await parentHandle(idb);
  if (parent) {
    const fp = await machineFingerprint();
    // Neue Position: _intern/kurator-name-{fp}.txt
    const intern = await parent.getDirectoryHandle('_intern').catch(() => null);
    if (intern) {
      const viaNew = await readText(intern, kuratorNameFilename(fp));
      if (viaNew && viaNew.trim()) {
        const name = viaNew.trim();
        await idb.set(KURATOR_NAME_LOCAL_IDB_KEY, name);
        return name;
      }
    }
    // Legacy-Position: programm-test/admin/admin-name-{fp}.txt
    const programm = await programmHandle(idb);
    if (programm) {
      const adminDir = await programm.getDirectoryHandle('admin').catch(() => null);
      if (adminDir) {
        const viaLegacy = await readText(adminDir, `admin-name-${fp}.txt`);
        if (viaLegacy && viaLegacy.trim()) {
          const name = viaLegacy.trim();
          await idb.set(KURATOR_NAME_LOCAL_IDB_KEY, name);
          return name;
        }
      }
    }
  }
  const cached = await idb.get<string>(KURATOR_NAME_LOCAL_IDB_KEY);
  return cached ?? null;
}
