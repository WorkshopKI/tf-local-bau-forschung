/**
 * Der Start-Pass (App.tsx → runDataUpdate) importiert automatisch — und zeigte
 * sein Ergebnis bisher nur als 6-Sekunden-Toast. Eine Divergenz-Warnung oder
 * ein Fehler aus GENAU diesem Lauf erreichte damit weder Banner noch Dialog:
 * die Quelle war gestempelt, also kein Kandidat mehr, und der Banner-Report
 * füllt sich nur aus dem Banner-Lauf. Der Start-Bericht wandert deshalb über
 * einen kleinen Store zum Banner — aber nur, wenn er etwas zu sagen hat.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { berichtZeigenswert, useStartBericht } from '../start-bericht';
import type { RefreshReport } from '../auto-refresh';

function report(p: Partial<RefreshReport> = {}): RefreshReport {
  return {
    processed: [], drift: [], errors: [], divergenzen: [], journal: [],
    importTimings: { parseMs: 0, hashDiffMs: 0, mergeMs: 0, snapshotWriteMs: 0 },
    skippedInactiveUnterprogramm: 0, heldRemovals: 0, unknownUnterprogramm: 0, changedAntraege: 0,
    ...p,
  };
}

beforeEach(() => {
  useStartBericht.getState().setBericht(null);
});

describe('berichtZeigenswert', () => {
  it('ein glatter Import ist nichts, was man am Bildschirm halten muss', () => {
    expect(berichtZeigenswert(report({ processed: [{ schemaId: 'a', schemaName: 'A', rowCount: 1, skipped: false }] })))
      .toBe(false);
  });

  it('Divergenz, Drift und Fehler sind zeigenswert', () => {
    expect(berichtZeigenswert(report({ divergenzen: [{ schemaId: 'a' } as RefreshReport['divergenzen'][number]] }))).toBe(true);
    expect(berichtZeigenswert(report({ drift: [{ schemaId: 'a' } as RefreshReport['drift'][number]] }))).toBe(true);
    expect(berichtZeigenswert(report({ errors: [{ schemaId: 'a', schemaName: 'A', message: 'x' }] }))).toBe(true);
  });

  it('auch übergangene Spalten und eine Encoding-Korrektur gehören gesagt', () => {
    expect(berichtZeigenswert(report({
      processed: [{ schemaId: 'a', schemaName: 'A', rowCount: 1, skipped: false, uebergangeneSpalten: ['X'] }],
    }))).toBe(true);
    expect(berichtZeigenswert(report({
      processed: [{ schemaId: 'a', schemaName: 'A', rowCount: 1, skipped: false, korrigiertesEncoding: 'UTF-8' }],
    }))).toBe(true);
  });
});

describe('useStartBericht', () => {
  it('hält den Bericht, bis ihn jemand abholt', () => {
    const r = report({ divergenzen: [{ schemaId: 'a' } as RefreshReport['divergenzen'][number]] });
    useStartBericht.getState().setBericht(r);
    expect(useStartBericht.getState().bericht).toBe(r);
    expect(useStartBericht.getState().abholen()).toBe(r);
    expect(useStartBericht.getState().bericht).toBeNull();
  });

  it('ein Bericht ohne Befund wird gar nicht abgelegt', () => {
    useStartBericht.getState().setBericht(report());
    expect(useStartBericht.getState().bericht).toBeNull();
  });
});
