/**
 * Feld-Zugriff: liest den Wert eines Katalog-Feldes aus einem Antrag- oder
 * Verbund-Record. Kapselt die `quelleKey`-Umleitung (z.B. `verbund_status` liegt
 * im Verbund-Record unter `status`). Zahlen werden zu Strings, leere Werte zu ''.
 *
 * Dazu die Gegenrichtung `feldLabel`: aus der technischen `feldId` den Namen
 * machen, den der Kurator im Felder-Tab vergeben hat (`status` → „TV-Status"),
 * und `kuerzelIndex` als der eine Weg vom Kürzel des Fachsystems (`ABB`) zu
 * seinem Katalog-Feld.
 */
import { normKey } from './normalisierung';
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

/** Kürzel des Fachsystems (`normKey`) → Katalog-Feld. */
export type KuerzelIndex = ReadonlyMap<string, StatusFeldEintrag>;

/**
 * Der Nachschlage-Index vom Kürzel zum Feld, das es trägt.
 *
 * **Erster Treffer gewinnt.** Dasselbe Kürzel kann an zwei Feldern hängen (die
 * vier kanonischen Codes `AAE`/`ABB`/`AZ1`/`VBE` liegen an den kanonischen
 * Datumsfeldern UND als `D_`-Spalte im Seed) — die Anzeige entdoppelt sie, statt
 * beide zu führen (Pitfall #44).
 *
 * Die Schlüssel stehen in `normKey`-Form — **der Aufrufer normalisiert seinen
 * Suchbegriff ebenso**, sonst findet eine NFD-Schreibweise aus der Zuarbeit den
 * NFC-Eintrag nicht. Der Parser normalisiert nur das Kürzel der ZEILE, nicht die
 * Kürzel in den Parametern.
 *
 * Rein; der Aufrufer baut ihn EINMAL und reicht ihn durch, nie je Nachschlag.
 */
export function kuerzelIndex(felder: readonly StatusFeldEintrag[]): KuerzelIndex {
  const m = new Map<string, StatusFeldEintrag>();
  for (const f of felder) {
    if (!f.code) continue;
    const k = normKey(f.code);
    if (k && !m.has(k)) m.set(k, f);
  }
  return m;
}
