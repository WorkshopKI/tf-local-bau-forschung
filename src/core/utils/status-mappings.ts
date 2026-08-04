/**
 * Zentrale Status-Labels und Badge-Variants fuer die **Anzeige** eines rohen
 * Antrags-Status: CSV-Rohwerte aus dem C16-Quellsystem (`beantragt`,
 * `VN geprüft`, `NF gestellt`, `bewilligt`, ...). Unbekanntes faellt auf den
 * Rohwert bzw. `'default'` zurueck.
 *
 * Fuer fachliche Vergleiche (offen / bewilligt / nachforderung / etc.) NICHT diese
 * Maps nutzen — stattdessen die Kategorie-Helper aus `status-canonical.ts`.
 *
 * NICHT fuer Feedback-Status verwenden — die haben eine andere Semantik
 * (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`)
 * und ihre eigenen Maps in `src/components/feedback/constants.ts`.
 */

export type BadgeVariant = 'info' | 'warning' | 'success' | 'error' | 'default';

export const STATUS_LABELS: Record<string, string> = {
  // Labels gekuerzt, damit die Status-Pille mit einheitlicher Breite ohne
  // Umbruch passt. Vergleich case-sensitive (CSV-Werte sind so).
  beantragt: 'Beantragt',
  bewilligt: 'Bewilligt',
  bearbeitungsreif: 'Bearbeitungsreif',
  'NL eingegangen': 'NL eingegangen',
  'VN geprüft': 'VN geprüft',
  'VN techn. geprüft': 'VN techn. gepr.',
  'techn geprüft': 'techn. geprüft',
  'kaufm geprüft': 'kaufm. geprüft',
  'Gutachten fertig': 'Gutachten fertig',
  bewilligungsreif: 'Bewilligungsreif',
  'Bewilligungsentwurf VDI/VDE-IT': 'Bewilligungsentwurf',
  ablehnungsreif: 'Ablehnungsreif',
  Ablehnung: 'Ablehnung',
  Widerruf: 'Widerruf',
  'Anhörung zum Widerruf': 'Anhörung Widerruf',
  Rücknahmeempfehlung: 'Rücknahmeempf.',
  'Stellungnahme zur Rücknahmeempf.': 'Stelln. Rücknahme',
  'Widerspruch zur Ablehnung': 'Widerspruch Abl.',
  'NF gestellt': 'NF gestellt',
  'keine weiteren NF': 'keine weiteren NF',
  Schlussvermerk: 'Schlussvermerk',
  beendet: 'Beendet',
  'abgelehnt/zurückgezogen': 'abgel./zurückgez.',
  abgebrochen: 'Abgebrochen',
  Irrläufer: 'Irrläufer',
  unvollständig: 'Unvollständig',
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Variants nach fachlicher Kategorie.
  bewilligt: 'success',
  // offen → info
  beantragt: 'info',
  bearbeitungsreif: 'info',
  'NL eingegangen': 'info',
  // in_pruefung → info (Arbeit laeuft)
  'VN geprüft': 'info',
  'VN techn. geprüft': 'info',
  'techn geprüft': 'info',
  'kaufm geprüft': 'info',
  'Gutachten fertig': 'info',
  // entscheidung → info (steht zur Entscheidung an)
  bewilligungsreif: 'info',
  'Bewilligungsentwurf VDI/VDE-IT': 'info',
  ablehnungsreif: 'info',
  'Anhörung zum Widerruf': 'info',
  Rücknahmeempfehlung: 'info',
  'Stellungnahme zur Rücknahmeempf.': 'info',
  'Widerspruch zur Ablehnung': 'info',
  // nachforderung → warning
  'NF gestellt': 'warning',
  'keine weiteren NF': 'warning',
  // entscheidung (in-Process-Negativ, noch nicht final) → info
  // Foerderantraege haben keinen final-abgelehnt-Status; Ablehnung/Widerruf
  // sind aktive Verfahren, finalisiert ueber `abgelehnt/zurueckgezogen`.
  Ablehnung: 'info',
  Widerruf: 'info',
  // abgeschlossen → default
  Schlussvermerk: 'default',
  beendet: 'default',
  'abgelehnt/zurückgezogen': 'default',
  abgebrochen: 'default',
  // sonstige → default
  Irrläufer: 'default',
  unvollständig: 'default',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'default';
}
