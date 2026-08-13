/**
 * „Bereits aktuell." darf nur dastehen, wenn wirklich geprüft wurde und wirklich
 * nichts war. Drei Lagen sahen bisher gleich aus (siehe Modul-Kopf von
 * `datenUpdateMeldung.ts`): gar kein Lauf, abgewiesene Quellen, unvollständig
 * geladener Snapshot.
 */
import { describe, it, expect } from 'vitest';
import { beschreibeDatenUpdate } from '../datenUpdateMeldung';
import type { DataUpdateResult } from '../data-update';
import type { RefreshReport } from '../auto-refresh';

function ergebnis(p: Partial<DataUpdateResult> = {}): DataUpdateResult {
  return { snapshotSynced: false, snapshotInfo: [], totalMs: 12, ...p };
}
function report(p: Partial<RefreshReport> = {}): RefreshReport {
  return {
    processed: [], drift: [], errors: [], checkedAt: '2026-08-13T00:00:00.000Z', ...p,
  } as RefreshReport;
}

describe('beschreibeDatenUpdate', () => {
  it('nennt den belegten Gate-Fall beim Namen statt „Bereits aktuell."', () => {
    const m = beschreibeDatenUpdate(ergebnis({ nichtGelaufen: 'gate-belegt' }));
    expect(m).toMatch(/Kein Lauf gestartet/);
    expect(m).not.toMatch(/Bereits aktuell/);
  });

  it('der belegte Gate-Fall gilt auch für den Force-Knopf', () => {
    // Dort ist er am folgenreichsten: der Force soll gerade den Fast-Path
    // umgehen, den der parallele Lauf benutzt.
    const m = beschreibeDatenUpdate(ergebnis({ nichtGelaufen: 'gate-belegt' }), { erzwungen: true });
    expect(m).toMatch(/Kein Lauf gestartet/);
    expect(m).not.toMatch(/keine inhaltlichen Änderungen/);
  });

  it('meldet blockierte Quellen, statt sie zu verschweigen', () => {
    const m = beschreibeDatenUpdate(ergebnis({
      csvReport: report({ drift: [{ schemaId: 'a' }, { schemaId: 'b' }, { schemaId: 'c' }] as RefreshReport['drift'] }),
    }));
    expect(m).toBe('3 Quelle(n) mit Spalten-Drift übersprungen — Details im Banner');
  });

  it('meldet Fehler-Quellen', () => {
    const m = beschreibeDatenUpdate(ergebnis({
      csvReport: report({ errors: [{ schemaId: 'a', message: 'kaputt' }] as RefreshReport['errors'] }),
    }));
    expect(m).toMatch(/1 Quelle\(n\) mit Fehler/);
  });

  it('nennt Importe UND Blockaden nebeneinander', () => {
    const m = beschreibeDatenUpdate(ergebnis({
      csvReport: report({
        processed: [{ schemaId: 'a', skipped: false }] as RefreshReport['processed'],
        drift: [{ schemaId: 'b' }, { schemaId: 'c' }] as RefreshReport['drift'],
      }),
    }));
    expect(m).toMatch(/1 CSV-Quelle\(n\) importiert/);
    expect(m).toMatch(/2 Quelle\(n\) mit Spalten-Drift/);
  });

  it('sagt, wenn der Snapshot unvollständig geladen wurde', () => {
    const m = beschreibeDatenUpdate(ergebnis({ snapshotSynced: true, snapshotUnvollstaendig: true }));
    expect(m).toMatch(/nachgeholt/);
  });

  it('bleibt bei „Bereits aktuell.", wenn wirklich nichts war', () => {
    expect(beschreibeDatenUpdate(ergebnis())).toBe('Bereits aktuell.');
  });

  it('und beim Force-Knopf bei seiner eigenen Formulierung', () => {
    expect(beschreibeDatenUpdate(ergebnis(), { erzwungen: true }))
      .toBe('Erzwungen geprüft — keine inhaltlichen Änderungen gefunden.');
  });
});
