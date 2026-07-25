/**
 * Feld-Zugriff: liest den Wert eines Katalog-Feldes aus einem Antrag- oder
 * Verbund-Record. Kapselt die `quelleKey`-Umleitung (z.B. `verbund_status` liegt
 * im Verbund-Record unter `status`). Zahlen werden zu Strings, leere Werte zu ''.
 *
 * Dazu die Gegenrichtung `feldLabel`: aus der technischen `feldId` den Namen
 * machen, den der Kurator im Felder-Tab vergeben hat (`status` → „TV-Status").
 */
import type { MappingVersion, StatusFeldEintrag } from './typen';

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

/**
 * Anzeigename eines Katalog-Feldes. Fallback ist die `feldId` selbst — auch bei
 * leer geräumtem Label, sonst stünde in der Spalte gar nichts und die Zeile
 * wäre nicht mehr zuzuordnen.
 */
export function feldLabel(version: MappingVersion, feldId: string): string {
  return version.felder.find(f => f.feldId === feldId)?.label?.trim() || feldId;
}
