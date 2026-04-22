/**
 * Web-Crypto-Primitives für Kurator-Passwort (Phase 1a, Modul B).
 * Keine externen Libs. AES-GCM 256 + PBKDF2-SHA-256 (200k).
 */

export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;
export const PBKDF2_ITERATIONS = 200_000;

export function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt plaintext → [12B IV][ciphertext+tag]. IV ist intern; Salt wird separat gespeichert. */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<Uint8Array> {
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return out;
}

/** Decrypt [12B IV][ciphertext+tag]. Wirft OperationError bei falschem Key. */
export async function decrypt(blob: Uint8Array, key: CryptoKey): Promise<string> {
  if (blob.byteLength < IV_BYTES + GCM_TAG_BYTES) throw new Error('decrypt: blob too short');
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return new TextDecoder().decode(pt);
}

/** kurator-config File-Layout: [16B salt][12B IV][N+16B ciphertext||tag] */
export function packKuratorConfigBlob(salt: Uint8Array, ivAndCt: Uint8Array): Uint8Array {
  const out = new Uint8Array(SALT_BYTES + ivAndCt.byteLength);
  out.set(salt, 0);
  out.set(ivAndCt, SALT_BYTES);
  return out;
}

export function unpackKuratorConfigBlob(blob: Uint8Array): { salt: Uint8Array; ivAndCt: Uint8Array } {
  if (blob.byteLength < SALT_BYTES + IV_BYTES + GCM_TAG_BYTES) throw new Error('kurator-config blob too short');
  return {
    salt: blob.slice(0, SALT_BYTES),
    ivAndCt: blob.slice(SALT_BYTES),
  };
}

/** Grober Rechner-Fingerprint (8 Hex-Chars). Nur Disambiguierung, keine Security. */
export async function machineFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    String((navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? 0),
    `${screen.width}x${screen.height}`,
  ];
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return Array.from(new Uint8Array(hash))
    .slice(0, 4)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
