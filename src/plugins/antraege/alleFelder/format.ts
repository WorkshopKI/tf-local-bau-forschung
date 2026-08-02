/** Kleine Formatter für Glance + Partner-Tabelle (geteilt, pur/testbar). */
import { formatDatumsWert } from '@/core/services/csv';

/**
 * Parst einen „Euroish"-Rohwert (Number oder String wie `"280.000"`,
 * `"1.543.436 €"`, `"280000"`) zu einer Ganzzahl. Tausenderpunkte/Währungs-
 * symbole werden ignoriert; Dezimalstellen entfallen (Förder-EUR sind ganzzahlig).
 * `null`, wenn keine Ziffern enthalten sind.
 */
export function parseEuroish(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  return Number.parseInt(digits, 10);
}

/** Formatiert einen EUR-Betrag deutsch: `1.543.436 €`. */
export function formatEuro(n: number): string {
  return `${n.toLocaleString('de-DE')} €`;
}

/**
 * Formatiert einen Datums-Rohwert tolerant. Die Formatierung selbst liegt in
 * `formatDatumsWert` (eine Kette für die ganze App); hier bleibt nur die
 * `unknown`-Annahme und das `null` für „nichts anzuzeigen".
 */
export function formatDateish(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length === 0 ? null : formatDatumsWert(t);
}
