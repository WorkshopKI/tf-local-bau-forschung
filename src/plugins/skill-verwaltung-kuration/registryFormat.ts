/**
 * Geteilte Anzeige-Helfer der Skill-Verwaltung — genutzt von Karten-,
 * Listen- und Tabellen-Modus beider Tabs sowie den Spalten-Definitionen.
 */

/** ISO-Timestamp → `dd.mm.yyyy`. Ungültige Eingabe wird unverändert durchgereicht. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Erste bis zu drei nicht-leeren Zeilen des Prompts als Anriss (Karten-Vorschau). */
export function promptAnriss(template: string): string {
  const lines = template.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
  return lines.join('\n') + (template.trim() ? ' …' : '');
}
