/**
 * Build-Time Rollen-Passwort-Gate — Verify-Helper (v2.16).
 *
 * Prueft ein eingegebenes Passwort gegen den in der Build-Time-Config
 * eingebetteten PBKDF2+AES-GCM-Verifier (`runtimeConfig.auth`). Kein IDB, kein
 * SMB, kein Netz — alles inline im Bundle (file://-tauglich). Reuse der
 * crypto.ts-Primitives (gleiche Params wie kurator-config.enc + das Build-Tool
 * scripts/set-app-password.mjs).
 *
 * Sicherheits-Modell: Casual-Access-Gate (verhindert, dass normale MAs den
 * pl-/kurator-Build oeffnen) — konsistent mit dem Single-Team-Trust-Modell
 * (CLAUDE.md). Der Verifier ist offline brute-forcebar (PBKDF2-200k pro Versuch),
 * das ist bewusst akzeptiert.
 */

import { deriveKey, decrypt } from './crypto';
import { runtimeConfig } from '@/config/runtime-config';

export interface AppPasswordResult {
  ok: boolean;
  /** Im Verifier hinterlegte Rolle ('pl' | 'kurator'); nur Verify-Anker. */
  role?: string;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Verifiziert `password` gegen `runtimeConfig.auth`. Liefert `{ok:false}` bei
 * falschem Passwort, fehlendem auth-Block oder korruptem Verifier — alle
 * ununterscheidbar (die UI zeigt schlicht "Passwort falsch").
 */
export async function verifyAppPassword(password: string): Promise<AppPasswordResult> {
  const auth = runtimeConfig.auth;
  if (!auth?.salt || !auth?.verifier) return { ok: false };
  try {
    const key = await deriveKey(password, b64ToBytes(auth.salt));
    const plaintext = await decrypt(b64ToBytes(auth.verifier), key);
    const sentinel = JSON.parse(plaintext) as { v?: number; role?: string };
    if (sentinel.v !== 1) return { ok: false };
    return { ok: true, role: sentinel.role };
  } catch {
    return { ok: false };
  }
}
