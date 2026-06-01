/**
 * Web Worker fuer die MA-Login-Entschluesselung (v2.11).
 *
 * Probiert ein eingegebenes Passwort gegen ALLE Eintraege der Zugangsdatei
 * (PBKDF2-200k pro Eintrag) im Hintergrund, damit der Login-Spinner im
 * Main-Thread fluessig animiert. Early-Exit beim ersten Treffer.
 *
 * file://-Kompat: wird via `?worker&inline` als IIFE-Blob gebuendelt
 * (vite.config.ts `worker.format:'iife'`) — die crypto-Importe landen IM Blob,
 * kein Runtime-ESM. `crypto.subtle` ist im Worker verfuegbar (file:// ist ein
 * Secure Context, der Blob-Worker erbt ihn). Main-Thread-Fallback in
 * `zugang-config.ts` falls die Worker-Konstruktion scheitert (z.B. Vitest).
 *
 * Sicherheit: der Worker bekommt das Passwort nur fluechtig im Message-Payload;
 * zurueck geht NUR das entschluesselte Kuerzel (+ anonId), nie Passwort/Key.
 */
import { deriveKey, decrypt } from './crypto';

export interface ZugangWorkerRequest {
  passwort: string;
  eintraege: Array<{ salt: string; verschluesseltesKuerzel: string; anonId: string }>;
}

export type ZugangWorkerResponse =
  | { ok: true; kuerzel: string; anonId: string }
  | { ok: false };

/** Worker-Global ohne WebWorker-lib-Abhaengigkeit (lib-agnostisch). */
const workerScope = self as unknown as {
  postMessage(msg: ZugangWorkerResponse): void;
  onmessage: ((e: MessageEvent<ZugangWorkerRequest>) => void) | null;
};

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function handle(req: ZugangWorkerRequest): Promise<void> {
  for (const eintrag of req.eintraege) {
    try {
      const key = await deriveKey(req.passwort, b64ToBytes(eintrag.salt));
      const kuerzel = await decrypt(b64ToBytes(eintrag.verschluesseltesKuerzel), key);
      // NFC-normalisieren: der Login-Wert muss exakt den Keys in der AnonymMap /
      // kuerzel-map entsprechen (Pitfall #22), sonst findet resolveAnonIdForUser
      // den MA nicht.
      workerScope.postMessage({ ok: true, kuerzel: kuerzel.normalize('NFC'), anonId: eintrag.anonId });
      return;
    } catch {
      // Falsches Passwort fuer diesen Eintrag — naechsten probieren.
    }
  }
  workerScope.postMessage({ ok: false });
}

workerScope.onmessage = (e: MessageEvent<ZugangWorkerRequest>): void => {
  void handle(e.data);
};
