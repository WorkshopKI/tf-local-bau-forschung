import { describe, it, expect, vi } from 'vitest';
import { runBatch, type BatchDeps, type AbschnittErgebnis, type ErzeugeArgs } from '../runner';
import type { BatchJob, BatchAbschnitte } from '../types';

function makeJob(azs: string[], abschnitte: BatchAbschnitte = 'nur_a'): BatchJob {
  return {
    id: 'j1', erstellt_am: '2026-06-12T00:00:00.000Z', abschnitte,
    eintraege: azs.map(az => ({ aktenzeichen: az, fkz: az, titel: az, status: 'wartet' as const })),
    aktiverIndex: 0, jobStatus: 'laeuft', schemaVersion: 1,
  };
}

interface Opts {
  erzeuge?: BatchDeps['erzeugeAbschnitt'];
  transport?: () => Promise<boolean>;
  signal?: AbortSignal;
}
function deps(o: Opts = {}): { deps: BatchDeps; persisted: BatchJob[] } {
  const persisted: BatchJob[] = [];
  const d: BatchDeps = {
    transportVerfuegbar: o.transport ?? (async () => true),
    erzeugeAbschnitt: o.erzeuge ?? (async (): Promise<AbschnittErgebnis> => ({ erzeugt: true, uebersprungen: false, hinweise: 0 })),
    persistJob: async j => { persisted.push(j); },
    onUpdate: () => {},
    signal: o.signal ?? new AbortController().signal,
  };
  return { deps: d, persisted };
}

describe('runBatch', () => {
  it('alle erfolgreich → jeder Eintrag fertig, jobStatus fertig', async () => {
    const { deps: d } = deps();
    const job = await runBatch(makeJob(['V1', 'V2']), d);
    expect(job.jobStatus).toBe('fertig');
    expect(job.eintraege.map(e => e.status)).toEqual(['fertig', 'fertig']);
    expect(job.eintraege[0]!.checkKurz).toBe('1× erzeugt ✓');
  });

  it('alle Schritte vorhanden (erzeugeAbschnitt skippt) → Eintrag uebersprungen', async () => {
    const { deps: d } = deps({ erzeuge: async () => ({ erzeugt: false, uebersprungen: true, hinweise: 0 }) });
    const job = await runBatch(makeJob(['V1']), d);
    expect(job.eintraege[0]!.status).toBe('uebersprungen');
    expect(job.eintraege[0]!.grund).toBe('bereits Gutachten-Stand');
  });

  it('Fehlerisolation: Fehler bei V1 (Transport bleibt da) → V1 fehler, V2 fertig', async () => {
    const erzeuge = vi.fn(async ({ aktenzeichen }: { aktenzeichen: string }): Promise<AbschnittErgebnis> => {
      if (aktenzeichen === 'V1') throw new Error('LLM kaputt');
      return { erzeugt: true, uebersprungen: false, hinweise: 0 };
    });
    const { deps: d } = deps({ erzeuge });
    const job = await runBatch(makeJob(['V1', 'V2']), d);
    expect(job.eintraege[0]!.status).toBe('fehler');
    expect(job.eintraege[0]!.fehlerText).toContain('LLM kaputt');
    expect(job.eintraege[1]!.status).toBe('fertig');
    expect(job.jobStatus).toBe('fertig');
  });

  it('Transport-Verlust → pausiert (nicht abgebrochen), aktiverIndex bleibt; Fortsetzen läuft weiter', async () => {
    let verfuegbar = true;
    const transport = async (): Promise<boolean> => verfuegbar;
    // V1 läuft, vor V2 fällt der Transport aus.
    const erzeuge = vi.fn(async (): Promise<AbschnittErgebnis> => ({ erzeugt: true, uebersprungen: false, hinweise: 0 }));
    const { deps: d } = deps({ transport, erzeuge });
    let job = makeJob(['V1', 'V2']);
    // nach V1 Transport weg
    const erzeugeMitAusfall = vi.fn(async (a: { aktenzeichen: string }): Promise<AbschnittErgebnis> => {
      if (a.aktenzeichen === 'V1') verfuegbar = false; // nach V1 verschwindet der Transport
      return { erzeugt: true, uebersprungen: false, hinweise: 0 };
    });
    job = await runBatch(job, { ...d, erzeugeAbschnitt: erzeugeMitAusfall });
    expect(job.jobStatus).toBe('pausiert');
    expect(job.aktiverIndex).toBe(1);
    expect(job.eintraege[0]!.status).toBe('fertig');
    expect(job.eintraege[1]!.status).toBe('wartet');

    // Fortsetzen
    verfuegbar = true;
    const job2 = await runBatch(job, { ...d, erzeugeAbschnitt: erzeuge });
    expect(job2.jobStatus).toBe('fertig');
    expect(job2.eintraege[1]!.status).toBe('fertig');
  });

  it('Wiederaufnahme idempotent: bereits terminale Einträge werden übersprungen', async () => {
    const erzeuge = vi.fn(async (_a: ErzeugeArgs): Promise<AbschnittErgebnis> => ({ erzeugt: true, uebersprungen: false, hinweise: 0 }));
    const { deps: d } = deps({ erzeuge });
    const job = makeJob(['V1', 'V2']);
    job.eintraege[0]!.status = 'fertig'; // V1 schon erledigt
    const out = await runBatch(job, d);
    expect(out.eintraege[1]!.status).toBe('fertig');
    // erzeugeAbschnitt nur für V2 gerufen, nicht für V1
    expect(erzeuge).toHaveBeenCalledTimes(1);
    expect(erzeuge.mock.calls[0]![0].aktenzeichen).toBe('V2');
  });

  it('Abbruch-Signal → jobStatus abgebrochen', async () => {
    const ac = new AbortController();
    ac.abort();
    const { deps: d } = deps({ signal: ac.signal });
    const job = await runBatch(makeJob(['V1', 'V2']), d);
    expect(job.jobStatus).toBe('abgebrochen');
  });

  it('a_bis_g: 7 Abschnitte je Antrag → checkKurz zählt erzeugte + letzte Hinweise', async () => {
    const erzeuge = vi.fn(async ({ stepId }: { stepId: string }): Promise<AbschnittErgebnis> => ({
      erzeugt: true, uebersprungen: false, hinweise: stepId === 'G' ? 2 : 0,
    }));
    const { deps: d } = deps({ erzeuge });
    const job = await runBatch(makeJob(['V1'], 'a_bis_g'), d);
    expect(erzeuge).toHaveBeenCalledTimes(7);
    expect(job.eintraege[0]!.checkKurz).toBe('7× erzeugt ✓ (2 Hinweise G)');
  });

  it('deps.order steuert die generierten Schritte (Reihenfolge datengetrieben)', async () => {
    const steps: string[] = [];
    const erzeuge = vi.fn(async ({ stepId }: ErzeugeArgs): Promise<AbschnittErgebnis> => {
      steps.push(stepId);
      return { erzeugt: true, uebersprungen: false, hinweise: 0 };
    });
    const { deps: d } = deps({ erzeuge });
    // Nur 3 Schritte in abweichender Reihenfolge statt der Default-7.
    await runBatch(makeJob(['V1'], 'a_bis_g'), { ...d, order: ['B', 'A', 'C'] });
    expect(steps).toEqual(['B', 'A', 'C']);
  });

  it('nur_a mit deps.order generiert nur den ERSTEN Schritt der Order', async () => {
    const steps: string[] = [];
    const erzeuge = vi.fn(async ({ stepId }: ErzeugeArgs): Promise<AbschnittErgebnis> => {
      steps.push(stepId);
      return { erzeugt: true, uebersprungen: false, hinweise: 0 };
    });
    const { deps: d } = deps({ erzeuge });
    await runBatch(makeJob(['V1'], 'nur_a'), { ...d, order: ['B', 'A', 'C'] });
    expect(steps).toEqual(['B']);
  });
});
