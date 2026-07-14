/**
 * Anzeige-Helfer für den Daten-Update-Pfad (`runDataUpdate`). Ausgelagert aus
 * App.tsx, damit auch der zusammengefasste „Datenbestand aktualisieren"-Banner
 * (`DataUpdateBanners`) dieselben Labels/Toast-Texte nutzt (DRY — eine Quelle für
 * die phasen-basierten Fortschritts- und Abschluss-Texte).
 */

import type { DataUpdatePhase, DataUpdateResult } from './data-update';

/**
 * Stabiles, phasen-basiertes Label fürs Daten-Update. Die Fraction kommt separat
 * aus `p.fraction` in den Fortschrittsbalken (im onPhase-Callback gedrosselt in
 * den Store geschrieben — kein Re-Render-Sturm).
 */
export function phaseToastLabel(p: DataUpdatePhase): string {
  switch (p.phase) {
    case 'snapshot':   return 'Datenbestand wird aktualisiert…';
    case 'csv-check':  return 'Neue CSV-Exporte werden geprüft…';
    case 'csv-import': return p.label ? `CSV-Import: ${p.label}…` : 'CSV-Daten werden importiert…';
    case 'publishing': return 'Daten lokal aktuell — Datenbestand wird für das Team veröffentlicht…';
  }
}

/**
 * Abschluss-Toast: Snapshot-Stand bevorzugt, sonst CSV-Import-Hinweis; `null` =
 * nichts aktualisiert (Toast/Meldung wird dann ausgeblendet).
 */
export function completionToast(r: DataUpdateResult): string | null {
  const info = r.snapshotInfo[0];
  if (info) {
    const stamp = new Date(info.createdAt).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return `${info.programmName}: Antragsdaten aktualisiert (Stand: ${stamp})`;
  }
  if (r.csvReport && r.csvReport.processed.some(p => !p.skipped)) {
    return 'Antragsdaten aus CSV aktualisiert';
  }
  return null;
}
