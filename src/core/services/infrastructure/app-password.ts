/**
 * Build-Time Passwort-Gate — Verify-Helper (v2.16, Modul-Slots seit v3.0).
 *
 * Prueft ein eingegebenes Passwort gegen einen in der Build-Time-Config
 * eingebetteten PBKDF2+AES-GCM-Verifier. Kein IDB, kein SMB, kein Netz — alles
 * inline im Bundle (file://-tauglich). Reuse der crypto.ts-Primitives (gleiche
 * Params wie das Build-Tool scripts/set-app-password.mjs).
 *
 * Zwei Ebenen, gleiche Krypto:
 *   - `runtimeConfig.auth`            — die App-Wall beim Start (ganze App).
 *   - `runtimeConfig.moduleAuth[slot]` — ein einzelnes Modul (Auslastung/Kurator).
 *
 * Sicherheits-Modell: Casual-Access-Gate (verhindert, dass die falsche Zielgruppe
 * eine Oberflaeche versehentlich benutzt) — konsistent mit dem Single-Team-Trust-
 * Modell (CLAUDE.md). Der Verifier ist offline brute-forcebar (PBKDF2-200k pro
 * Versuch), das ist bewusst akzeptiert. Es ist eine SICHTBARKEITSSPERRE, keine
 * Verschluesselung: der Modul-Code liegt weiter im Bundle, und die Daten auf dem
 * Share bleiben fuer jeden mit SMB-Zugriff lesbar.
 */

import { deriveKey, decrypt } from './crypto';
import {
  runtimeConfig,
  MODUL_SLOTS,
  type ModulSlot,
  type TeamflowModuleAuth,
  type TeamflowModuleAuthEntry,
} from '@/config/runtime-config';

export interface AppPasswordResult {
  ok: boolean;
  /** Im Verifier hinterlegte Rolle ('pl' | 'dev' | ein ModulSlot); nur Verify-Anker. */
  role?: string;
  /** Welche Ebene hat getroffen? `'base'` = App-Wall, sonst der Modul-Slot. */
  slot?: 'base' | ModulSlot;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Verifiziert gegen EINEN konkreten Eintrag — rein, ohne `runtimeConfig`.
 *
 * Bewusst als eigene Funktion (Muster `registry-zugang.ts`): Vitest verdrahtet
 * `__TEAMFLOW_CONFIG__` fest, ueber die echte Config waere das nicht testbar.
 *
 * `erwarteteRolle` NUR fuer Modul-Slots setzen — siehe `verifyGegenEbenen`.
 */
export async function verifyGegenEintrag(
  entry: { salt: string; verifier: string } | undefined | null,
  password: string,
  erwarteteRolle?: string,
): Promise<AppPasswordResult> {
  if (!entry?.salt || !entry?.verifier) return { ok: false };
  try {
    const key = await deriveKey(password, b64ToBytes(entry.salt));
    const plaintext = await decrypt(b64ToBytes(entry.verifier), key);
    const sentinel = JSON.parse(plaintext) as { v?: number; role?: string };
    if (sentinel.v !== 1) return { ok: false };
    if (erwarteteRolle !== undefined && sentinel.role !== erwarteteRolle) return { ok: false };
    return { ok: true, role: sentinel.role };
  } catch {
    return { ok: false };
  }
}

/**
 * Verifiziert gegen das Schloss EINES Moduls.
 *
 * Hier greift die Rollenpruefung: der Sentinel traegt den Slot-Namen, damit ein
 * Kurator-Passwort nicht versehentlich das Auslastungs-Modul oeffnet, falls die
 * beiden Eintraege je verwechselt werden.
 */
export async function verifyModulPassword(slot: ModulSlot, password: string): Promise<boolean> {
  const entry: TeamflowModuleAuthEntry | undefined = runtimeConfig.moduleAuth?.[slot];
  const r = await verifyGegenEintrag(entry, password, slot);
  return r.ok;
}

/**
 * Probiert Basis-Passwort, dann jeden Modul-Slot — rein, ohne `runtimeConfig`.
 *
 * An dieser Funktion haengt, WELCHES Modul eine Anmeldung oeffnet; sie ist
 * deshalb bewusst von der Config getrennt (Muster `verifyGegenEintrag`): Vitest
 * verdrahtet `__TEAMFLOW_CONFIG__` fest auf eine Config ohne `moduleAuth`, ueber
 * die echte waere der interessante Fall nicht testbar.
 *
 * **Die Basis wird OHNE Rollenpruefung geprueft, und das ist Absicht:** `dev` und
 * `pl` teilen sich denselben Verifier (dokumentiert in
 * scripts/set-app-password.mjs), dessen Sentinel `role: "pl"` traegt. Wuerde hier
 * die Rolle erzwungen, naehme `zah-dev.html` sein eigenes Passwort nicht mehr an.
 * Die Modul-Slots pruefen sie dagegen sehr wohl (`verifyModulPassword`).
 *
 * Reihenfolge = Basis, dann `MODUL_SLOTS`: der haeufige Fall (normales
 * Team-Passwort) kostet damit genau EINE PBKDF2-Ableitung; ein Fehlversuch kostet
 * eine pro konfiguriertem Slot (200k Iterationen, auf Citrix spuerbar — die UI
 * zeigt waehrenddessen „Anmelden…" via useAsyncAction).
 *
 * Folge fuer die Passwortvergabe: der ERSTE Treffer gewinnt. Ein Passwort, das
 * zweimal vergeben wurde, oeffnet still nur die vordere Ebene.
 */
export async function verifyGegenEbenen(
  auth: { salt: string; verifier: string } | null | undefined,
  moduleAuth: TeamflowModuleAuth | null | undefined,
  password: string,
): Promise<AppPasswordResult> {
  const basis = await verifyGegenEintrag(auth, password);
  if (basis.ok) return { ...basis, slot: 'base' };

  for (const slot of MODUL_SLOTS) {
    const eintrag = moduleAuth?.[slot];
    if (!eintrag) continue;
    if ((await verifyGegenEintrag(eintrag, password, slot)).ok) return { ok: true, role: slot, slot };
  }
  return { ok: false };
}

/** `verifyGegenEbenen` gegen die echte Build-Config — was die Start-Wall aufruft. */
export async function verifyAnyPassword(password: string): Promise<AppPasswordResult> {
  return verifyGegenEbenen(runtimeConfig.auth, runtimeConfig.moduleAuth, password);
}
