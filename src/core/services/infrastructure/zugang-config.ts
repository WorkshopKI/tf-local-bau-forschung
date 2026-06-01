/**
 * Zugangsdatei-Handling fuer die MA-Login-Wall (v2.11).
 *
 * Datei `_intern/auslastung-zugang.enc` (JSON-Huelle) liegt auf dem Daten-Share,
 * neben `kurator-config.enc` / `deanon-config.enc`. Pro Eintrag eigenes Salt +
 * AES-GCM-verschluesseltes Kuerzel (selbe Krypto wie kurator-config —
 * WIEDERVERWENDET, nicht neu geschrieben). KEIN Klartext-Kuerzel/Passwort/Hint.
 *
 * Schreib-Profil (Pitfall #23): idempotent-overwrite → `atomicWrite` MIT Backup.
 * Die ganze Datei wird pro Mutation neu geschrieben (read-modify-write innerhalb
 * EINES Calls, um das Concurrent-Writer-Fenster klein zu halten — in der Praxis
 * schreibt nur die PL, selten).
 *
 * DevTools-Konsole (bewusst akzeptiert, eng gefasstes Bedrohungsmodell):
 *  - Ein User kann sein EIGENES Kuerzel im sessionStorage sehen (kennt er ohnehin).
 *  - Ein User sieht Code + verschluesselte Datei — die Blobs sind ohne Passwort nutzlos.
 *  - Ein User kann NICHT das Kuerzel eines Kollegen bekommen (nur verschluesselt,
 *    braucht dessen Passwort). Es gibt KEINE setKuerzel()-Funktion.
 *  - Offline-Brute-Force ist theoretisch moeglich, aber ausserhalb des
 *    Bedrohungsmodells (kein GPU-Innentaeter-Schutz noetig).
 */
import {
  deriveKey,
  decrypt as cryptoDecrypt,
  encrypt as cryptoEncrypt,
  randomBytes,
  SALT_BYTES,
} from './crypto';
import { atomicWrite, readText, fileExists } from './atomic-write';
import { getDatenShareHandle } from './smb-handle';
import { ZUGANG_CONFIG_PATH, type ZugangsEintrag, type ZugangsFile } from './types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { ZugangWorkerRequest, ZugangWorkerResponse } from './zugang-worker';

// ─── Base64-Helfer (kleine Blobs: Salt 16B, IV+CT ~30B) ────────────────────
function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}
function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function parentHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  return (await getDatenShareHandle(idb)) ?? null;
}

export function emptyZugangFile(): ZugangsFile {
  return { version: 1, updatedAt: new Date().toISOString(), eintraege: [] };
}

function isValidEintrag(e: unknown): e is ZugangsEintrag {
  return typeof e === 'object' && e != null
    && typeof (e as ZugangsEintrag).salt === 'string'
    && typeof (e as ZugangsEintrag).verschluesseltesKuerzel === 'string'
    && typeof (e as ZugangsEintrag).anonId === 'string';
}

function parseZugang(text: string): ZugangsFile {
  const raw = JSON.parse(text) as Partial<ZugangsFile>;
  const eintraege = Array.isArray(raw?.eintraege) ? raw.eintraege.filter(isValidEintrag) : [];
  return {
    version: 1,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    eintraege,
  };
}

/** Liest die Zugangsdatei. Datei fehlt → `null` (Signal: Fallback aufs alte
 *  Kuerzelfeld, KEIN Login erzwungen). Parse-Fehler → leere Datei. */
export async function loadZugangFile(idb: IDBStore): Promise<ZugangsFile | null> {
  const parent = await parentHandle(idb);
  if (!parent) return null;
  const text = await readText(parent, ZUGANG_CONFIG_PATH);
  if (text == null) return null;
  try {
    return parseZugang(text);
  } catch {
    console.warn('[zugang-config] JSON-Parse fehlgeschlagen — leere Datei angenommen.');
    return emptyZugangFile();
  }
}

/** True, wenn `_intern/auslastung-zugang.enc` existiert (→ Login erzwingen). */
export async function isZugangConfigured(idb: IDBStore): Promise<boolean> {
  const parent = await parentHandle(idb);
  if (!parent) return false;
  return fileExists(parent, ZUGANG_CONFIG_PATH);
}

/**
 * Fuegt einen Zugang hinzu oder ersetzt den bestehenden Eintrag desselben
 * `anonId` (→ „Passwort neu generieren": altes Passwort wird ungueltig). Das
 * Kuerzel wird vor dem Verschluesseln NFC-normalisiert (Pitfall #22) — der
 * Caller liefert es bereits uppercase aus der AnonymMap (`toReal`).
 *
 * Wirft, wenn der Daten-Share nicht (schreibend) verbunden ist.
 */
export async function addOrReplaceEintrag(
  idb: IDBStore,
  anonId: string,
  kuerzel: string,
  passwort: string,
): Promise<ZugangsFile> {
  const parent = await parentHandle(idb);
  if (!parent) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');
  const current = (await loadZugangFile(idb)) ?? emptyZugangFile();
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(passwort, salt);
  const ivAndCt = await cryptoEncrypt(kuerzel.normalize('NFC'), key);
  const eintrag: ZugangsEintrag = {
    salt: bytesToB64(salt),
    verschluesseltesKuerzel: bytesToB64(ivAndCt),
    anonId,
  };
  const eintraege = current.eintraege.filter(e => e.anonId !== anonId);
  eintraege.push(eintrag);
  const next: ZugangsFile = { version: 1, updatedAt: new Date().toISOString(), eintraege };
  await atomicWrite(parent, ZUGANG_CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

/**
 * Batch-Variante: erzeugt/ersetzt mehrere Eintraege in EINEM read-modify-write
 * (Pitfall #16/#20 — EIN Save statt N). Fuer den PL-„Passwoerter fuer alle"-Flow.
 */
export async function addOrReplaceManyEintraege(
  idb: IDBStore,
  items: Array<{ anonId: string; kuerzel: string; passwort: string }>,
): Promise<ZugangsFile> {
  const parent = await parentHandle(idb);
  if (!parent) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');
  const current = (await loadZugangFile(idb)) ?? emptyZugangFile();
  const byAnon = new Map(current.eintraege.map(e => [e.anonId, e]));
  for (const it of items) {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(it.passwort, salt);
    const ivAndCt = await cryptoEncrypt(it.kuerzel.normalize('NFC'), key);
    byAnon.set(it.anonId, {
      salt: bytesToB64(salt),
      verschluesseltesKuerzel: bytesToB64(ivAndCt),
      anonId: it.anonId,
    });
  }
  const next: ZugangsFile = { version: 1, updatedAt: new Date().toISOString(), eintraege: [...byAnon.values()] };
  await atomicWrite(parent, ZUGANG_CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

/** Entfernt den Eintrag eines `anonId` (Widerruf). No-op wenn nicht vorhanden. */
export async function removeEintrag(idb: IDBStore, anonId: string): Promise<ZugangsFile> {
  const parent = await parentHandle(idb);
  if (!parent) throw new Error('Daten-Share nicht verbunden.');
  const current = (await loadZugangFile(idb)) ?? emptyZugangFile();
  const eintraege = current.eintraege.filter(e => e.anonId !== anonId);
  const next: ZugangsFile = { version: 1, updatedAt: new Date().toISOString(), eintraege };
  await atomicWrite(parent, ZUGANG_CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

export interface ZugangTreffer {
  kuerzel: string;
  anonId: string;
}

/**
 * Probiert `passwort` gegen ALLE Eintraege durch (kein Hint). Erster
 * erfolgreicher Decrypt → `{ kuerzel, anonId }`, sonst `null`. Laeuft im Web
 * Worker (Spinner-Smoothness); bei Worker-Fehler Fallback auf Main-Thread.
 */
export async function verifyPasswortAgainstAll(
  passwort: string,
  eintraege: ZugangsEintrag[],
): Promise<ZugangTreffer | null> {
  if (eintraege.length === 0) return null;
  try {
    return await verifyViaWorker(passwort, eintraege);
  } catch (err) {
    console.warn('[zugang-config] Worker-Pfad fehlgeschlagen — Main-Thread-Fallback.', err);
    return verifyOnMainThread(passwort, eintraege);
  }
}

async function verifyViaWorker(passwort: string, eintraege: ZugangsEintrag[]): Promise<ZugangTreffer | null> {
  // Dynamischer `?worker&inline`-Import (wie pdf-extract.ts): unter Vitest
  // scheitert das Resolven → der try/catch in verifyPasswortAgainstAll faellt
  // auf den Main-Thread zurueck. In der single-file-Build inlinet Vite den
  // Worker als Blob.
  const mod = await import('./zugang-worker?worker&inline');
  const ZugangWorker = mod.default;
  return new Promise<ZugangTreffer | null>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new ZugangWorker();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    worker.onmessage = (e: MessageEvent<ZugangWorkerResponse>): void => {
      const data = e.data;
      worker.terminate();
      resolve(data.ok ? { kuerzel: data.kuerzel, anonId: data.anonId } : null);
    };
    worker.onerror = (e): void => {
      worker.terminate();
      reject(e instanceof ErrorEvent ? e.error ?? new Error(e.message) : new Error('Worker-Fehler'));
    };
    const req: ZugangWorkerRequest = { passwort, eintraege };
    worker.postMessage(req);
  });
}

async function verifyOnMainThread(passwort: string, eintraege: ZugangsEintrag[]): Promise<ZugangTreffer | null> {
  for (const e of eintraege) {
    try {
      const key = await deriveKey(passwort, b64ToBytes(e.salt));
      const kuerzel = await cryptoDecrypt(b64ToBytes(e.verschluesseltesKuerzel), key);
      return { kuerzel: kuerzel.normalize('NFC'), anonId: e.anonId };
    } catch {
      // Falsches Passwort fuer diesen Eintrag — weiter.
    }
  }
  return null;
}
