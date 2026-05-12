/**
 * Zentrale Status-Labels und Badge-Variants fuer Vorgang-Status (Bauantrag, Förderantrag).
 *
 * Deckt beide "Welten" ab:
 * - Welt A — Snake-Case Seed-Werte (`eingereicht`, `in_pruefung`, `genehmigt`, ...)
 * - Welt B — CSV-Rohwerte aus dem Forschungsfoerderungs-Quellsystem
 *   (`beantragt`, `VN geprüft`, `NF gestellt`, `bewilligt`, ...)
 *
 * Fuer fachliche Vergleiche (offen / bewilligt / nachforderung / etc.) NICHT diese
 * Maps nutzen — stattdessen die Kategorie-Helper aus `status-canonical.ts`.
 *
 * NICHT fuer Feedback-Status verwenden — die haben eine andere Semantik
 * (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`)
 * und ihre eigenen Maps in `src/components/feedback/constants.ts`.
 *
 * Wenn ein neuer Vorgangstyp dazukommt: hier die Status-Werte ergaenzen UND
 * `status-canonical.ts` um die Kategorie-Zuordnung erweitern.
 */

export type BadgeVariant = 'info' | 'warning' | 'success' | 'error' | 'default';

export const STATUS_LABELS: Record<string, string> = {
  // ── Welt A — Snake-Case Seed-Werte ─────────────────────────────────────
  // Bauantrag
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  nachforderung: 'Nachforderung',
  in_pruefung: 'In Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
  // Forschung
  eingereicht: 'Eingereicht',
  in_begutachtung: 'In Begutachtung',
  nachbesserung: 'Nachbesserung',
  bewilligt: 'Bewilligt',
  abgeschlossen: 'Abgeschlossen',

  // ── Welt B — CSV-Rohwerte aus dem Quellsystem ───────────────────────────
  // Labels gekuerzt, damit die Status-Pille mit einheitlicher Breite ohne
  // Umbruch passt. Vergleich case-sensitive (CSV-Werte sind so).
  beantragt: 'Beantragt',
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
  // ── Welt A ──────────────────────────────────────────────────────────────
  neu: 'info',
  in_bearbeitung: 'warning',
  nachforderung: 'warning',
  in_pruefung: 'info',
  genehmigt: 'success',
  abgelehnt: 'error',
  archiviert: 'default',
  eingereicht: 'info',
  in_begutachtung: 'warning',
  nachbesserung: 'warning',
  bewilligt: 'success',
  abgeschlossen: 'default',

  // ── Welt B — Variants nach fachlicher Kategorie ─────────────────────────
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
  // abgelehnt → error
  Ablehnung: 'error',
  Widerruf: 'error',
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
