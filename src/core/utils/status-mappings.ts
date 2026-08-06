/**
 * Badge-**Variante** (Pillenfarbe) fuer einen rohen Antrags-Status: CSV-Rohwerte
 * aus dem C16-Quellsystem (`beantragt`, `VN geprüft`, `NF gestellt`,
 * `bewilligt`, ...). Unbekanntes faellt auf `'default'` zurueck.
 *
 * **Die Beschriftung steht NICHT mehr hier** (v3.15). `STATUS_LABELS` und
 * `getStatusLabel` sind entfallen; wie ein Status heisst, beantwortet
 * `status-wert-labels.ts` aus dem Code-Katalog (`statusKurzLabel` fuer enge
 * Flaechen, `statusLabel` fuer Tooltip/Export/Prompt). Bis dahin fuehrten drei
 * Module ihre eigene Kurzform desselben Werts — eine davon mit Tippfehler, eine
 * unter einer Schreibweise, die im Bestand nicht vorkommt. Der Konventionstest
 * `status-kurzlabel-single-source` haelt die Datei kuenftig frei davon.
 *
 * Fuer fachliche Vergleiche (offen / bewilligt / nachforderung / etc.) NICHT
 * diese Map nutzen — stattdessen die Kategorie-Helper aus `status-canonical.ts`.
 *
 * NICHT fuer Feedback-Status verwenden — die haben eine andere Semantik
 * (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`)
 * und ihre eigenen Maps in `src/components/feedback/constants.ts`.
 */

export type BadgeVariant = 'info' | 'warning' | 'success' | 'error' | 'default';

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

export function getStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'default';
}
