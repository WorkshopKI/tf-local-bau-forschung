/** Anzeige-Formatierung für Anfrage-Felder (geteilt von Liste/Tabelle/Karten). */

/** ISO-Datum → `TT.MM.JJJJ` (de-DE); leere/ungültige Werte → `—`. */
export function formatAnfrageDatum(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
