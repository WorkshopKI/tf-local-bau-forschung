/**
 * Änderungserkennung für den Original-Mailtext gegenüber dem Stand, aus dem die
 * aktuelle Anonymisierung entstanden ist. `hashText` ist ein synchroner
 * Non-Crypto-Hash (FNV-1a) — ausschließlich zur Erkennung, ob sich der Text seit
 * dem Anonymisieren geändert hat; KEINE Sicherheitszusage. Der Hash lebt als
 * `Anfrage.anonBasisHash` rein lokal neben Mapping/anonymer Fassung (kein Transport).
 */
import { statusErreicht } from './status';
import type { Anfrage } from './types';

/** Stabiler synchroner 32-bit-Hash (FNV-1a) als Hex-String. Kein Krypto-Zweck. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * True, wenn der Originaltext seit der Anonymisierung geändert wurde → anonyme
 * Fassung & Mapping sind veraltet, der Export muss bis zur Re-Anonymisierung
 * gesperrt bleiben. Bestandsschutz: Alt-Records ohne `anonBasisHash` (vor diesem
 * Feature anonymisiert) gelten NIE als veraltet.
 */
export function istOriginalStale(anfrage: Anfrage, aktuellerText: string): boolean {
  if (!statusErreicht(anfrage.status, 'anonymisiert')) return false;
  if (anfrage.anonBasisHash == null) return false;
  return anfrage.anonBasisHash !== hashText(aktuellerText);
}
