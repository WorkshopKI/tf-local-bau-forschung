/**
 * Nutzer-Identität für die Skill-Signal-Dateien.
 *
 * Es gibt kein hartes Auth-Kürzel — Honor-System (5–30 vertraute Nutzer). Die
 * reine `getUserId`-Funktion bevorzugt das bestehende Kürzel (von S2/S3 aus
 * `useMeinKuerzel()` injiziert, Pitfall #27) und fällt auf eine stabile, in der
 * IDB persistierte per-Installation-ID zurück, wenn kein Kürzel vorliegt.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { machineFingerprint } from '@/core/services/infrastructure/crypto';

/** IDB-`kv`-Key der stabilen per-Installation-ID (Pitfall #29 — kein neuer Store). */
export const INSTALL_ID_KEY = 'skill-feedback:install-id';

/** Sentinel des Übersichts-Filters (kein echter Nutzer). */
const ALLE_SENTINEL = 'alle';

/**
 * Stabile Nutzer-ID (rein, injizierbar). NFC-normalisiert (Pitfall #22) wegen
 * Umlaut-Kürzeln. Leeres / Übersichts-Kürzel (`'alle'`) → `installId`-Fallback.
 */
export function getUserId(kuerzel: string | undefined, installId: string): string {
  const k = (kuerzel ?? '').normalize('NFC').trim();
  if (k && k.toLowerCase() !== ALLE_SENTINEL) return k;
  return installId;
}

/** 8 zufällige Hex-Zeichen (für die Eindeutigkeit der Installations-ID). */
function randomSuffix(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Liefert die stabile per-Installation-ID aus der IDB; erzeugt sie beim ersten
 * Aufruf (Rechner-Fingerprint + Zufallssuffix) und persistiert sie. Stabil über
 * Sessions, eindeutig pro Installation auch bei identischer Hardware.
 */
export async function resolveInstallId(idb: IDBStore): Promise<string> {
  const cached = await idb.get<string>(INSTALL_ID_KEY);
  if (typeof cached === 'string' && cached.length > 0) return cached;
  const fp = await machineFingerprint();
  const id = `inst-${fp}-${randomSuffix()}`;
  await idb.set(INSTALL_ID_KEY, id);
  return id;
}
