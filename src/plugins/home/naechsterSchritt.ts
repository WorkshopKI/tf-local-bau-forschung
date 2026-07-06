import { getStatusLabel } from '@/core/utils/status-mappings';

/**
 * Handlungs-Formel „Phase → nächster Schritt" für die Home-„Meine Anträge"-
 * Liste. Ersetzt die Status-Badge durch eine Aussage, WAS als Nächstes zu tun
 * ist — abgeleitet aus dem CSV-Roh-Status.
 */
export interface NaechsterSchritt {
  /** Phasen-Label, z.B. „Fachprüfung". */
  phase: string;
  /** Handlungs-Text, z.B. „Gutachten beginnen". Leer, wenn kein spezifischer
   *  Schritt gemappt ist (Fallback = nur Phase / Status-Label). */
  aktion: string;
}

/**
 * Roh-Status → Handlungs-Formel. Bewusst ein reiner **Record-Lookup** (keine
 * `=== 'literal'`-Vergleiche → Pitfall #12 bleibt unberührt; die Zuordnung lebt
 * hier als Daten-Tabelle analog `STATUS_LABELS`).
 *
 * Die Tabelle deckt die auf der Home relevanten offenen Bearbeitungs-Stati ab.
 * Unbekannte / nicht gemappte Stati fallen NIE durch: sie bekommen
 * `{ phase: getStatusLabel(status), aktion: '' }` (nur die Phase, keine
 * erratene Aktion — siehe `naechsterSchritt`).
 */
const SCHRITT_BY_STATUS: Record<string, NaechsterSchritt> = {
  beantragt: { phase: 'Eingang', aktion: 'Vollständigkeit prüfen' },
  bearbeitungsreif: { phase: 'Eingang', aktion: 'Vollständigkeit prüfen' },
  'NL eingegangen': { phase: 'Vollständigkeit', aktion: 'Nachlieferung prüfen' },
  'VN geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'VN techn. geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'techn geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'kaufm geprüft': { phase: 'Fachprüfung', aktion: 'Gutachten beginnen' },
  'Gutachten fertig': { phase: 'Fachprüfung', aktion: 'Gutachten freigeben' },
  bewilligungsreif: { phase: 'Fachprüfung', aktion: 'Bewilligung vorbereiten' },
  ablehnungsreif: { phase: 'Fachprüfung', aktion: 'Ablehnungsbescheid erstellen' },
  'NF gestellt': { phase: 'Nachforderung', aktion: 'Nachforderung nachhalten' },
  'keine weiteren NF': { phase: 'Nachforderung', aktion: 'Nachforderung nachhalten' },
};

/**
 * Leitet die „Phase → Aktion"-Formel aus dem Roh-Status ab.
 *
 * - Gemappter Status → kuratierte `{ phase, aktion }`.
 * - Nicht gemappter, aber gesetzter Status → `{ phase: getStatusLabel(s), aktion: '' }`
 *   (nur Phase, keine erratene Aktion — der Renderer zeigt dann bloß das Label).
 * - Leerer / fehlender Status → `null` (der Renderer zeigt gar keine Formel).
 */
export function naechsterSchritt(status: string | undefined | null): NaechsterSchritt | null {
  const s = typeof status === 'string' ? status.trim() : '';
  if (s.length === 0) return null;
  const mapped = SCHRITT_BY_STATUS[s];
  if (mapped) return mapped;
  return { phase: getStatusLabel(s), aktion: '' };
}
