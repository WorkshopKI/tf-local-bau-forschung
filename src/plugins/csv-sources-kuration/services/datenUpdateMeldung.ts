/**
 * Was ein Datenaktualisierungs-Lauf gemeldet bekommt — als reine Funktion.
 *
 * Zwei Türen (Fußzeilen-Ampel „● CSV" und Einstellungen → Speicher) bauten
 * ihre Meldung je selbst aus `processed`, und beide sagten „Bereits aktuell."
 * für drei sehr verschiedene Lagen:
 *
 * 1. **Es lief gar kein Lauf.** Ist das Daten-Mutations-Gate belegt (Start-Pass,
 *    Banner-Lauf, Watcher — jeweils über Minuten), kehrt `runDataUpdate` sofort
 *    mit dem unberührten Initial-Objekt zurück: kein Report, kein Fehler, exakt
 *    die Form von „geprüft, nichts gefunden". Besonders folgenreich am
 *    Force-Knopf: der parallele Lauf nutzt gerade den Fast-Path, den
 *    `forceRecheck` umgehen soll — die Diagnose findet nie statt, und niemand
 *    holt sie nach.
 * 2. **Der Lauf hat Quellen abgewiesen.** `report.drift` (Spalten-Drift) und
 *    `report.errors` blieben ungelesen; der Dialog zeigte daneben weiter „Neue
 *    Exporte verfügbar", der Punkt blieb rot.
 * 3. **Der Snapshot kam unvollständig.** `SyncResult.incomplete` gibt es seit
 *    v4.18.0, gelesen hat es niemand — der Toast meldete Erfolg samt neuem
 *    Stand, während die lokale Version bewusst nicht vorrückte.
 *
 * Die Regel steht deshalb hier, einmal, und ist ohne React prüfbar.
 */

import type { DataUpdateResult } from './data-update';

export interface MeldungOptionen {
  /** „Erzwungen neu prüfen" — die Meldung nennt das, sonst liest sie sich wie ein Normal-Lauf. */
  erzwungen?: boolean;
}

export function beschreibeDatenUpdate(r: DataUpdateResult, opts: MeldungOptionen = {}): string {
  if (r.nichtGelaufen === 'gate-belegt') {
    return 'Kein Lauf gestartet — ein anderer Vorgang aktualisiert die Daten gerade. '
      + 'Gleich noch einmal versuchen.';
  }

  const teile: string[] = [];
  if (r.snapshotSynced) {
    teile.push(r.snapshotUnvollstaendig
      ? 'Datenbestand teilweise aktualisiert — ein Teil liess sich nicht laden und wird beim nächsten Lauf nachgeholt'
      : 'Datenbestand aktualisiert');
  } else if (r.snapshotUnvollstaendig) {
    teile.push('Datenbestand liess sich nicht vollständig laden — wird beim nächsten Lauf nachgeholt');
  }

  const importiert = r.csvReport?.processed.filter(p => !p.skipped).length ?? 0;
  if (importiert > 0) {
    teile.push(opts.erzwungen
      ? `Erzwungen: ${importiert} CSV-Quelle(n) re-importiert`
      : `${importiert} CSV-Quelle(n) importiert`);
  }

  const blockiert = r.csvReport?.drift.length ?? 0;
  if (blockiert > 0) {
    teile.push(`${blockiert} Quelle(n) mit Spalten-Drift übersprungen — Details im Banner`);
  }

  const fehler = r.csvReport?.errors.length ?? 0;
  if (fehler > 0) teile.push(`${fehler} Quelle(n) mit Fehler — Details im Banner`);

  if (r.lockBusy) {
    teile.push(`CSV-Import übersprungen — ${r.lockBusy.blockingKurator} aktualisiert gerade`);
  }

  if (teile.length > 0) return teile.join(' · ');
  return opts.erzwungen
    ? 'Erzwungen geprüft — keine inhaltlichen Änderungen gefunden.'
    : 'Bereits aktuell.';
}
