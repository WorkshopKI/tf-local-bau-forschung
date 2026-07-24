/**
 * Feld-Zugriff: liest den Wert eines Katalog-Feldes aus einem Antrag- oder
 * Verbund-Record. Kapselt die `quelleKey`-Umleitung (z.B. `verbund_status` liegt
 * im Verbund-Record unter `status`). Zahlen werden zu Strings, leere Werte zu ''.
 */
import type { StatusFeldEintrag } from './typen';

/** Tatsächlicher Record-Key eines Feldes (Default: `feldId`). */
export function recordKey(feld: StatusFeldEintrag): string {
  return feld.quelleKey ?? feld.feldId;
}

/** Liest den Feldwert aus einem Record; leer/undefiniert → ''. */
export function leseFeldWert(rec: Record<string, unknown>, feld: StatusFeldEintrag): string {
  const v = rec[recordKey(feld)];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}
