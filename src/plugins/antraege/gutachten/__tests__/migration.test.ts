import { describe, it, expect } from 'vitest';
import { buildRunFromKurzfassung, loadOrMigrateWorkflowRun } from '../kurzfassung-migration';
import { getWorkflowRun, putWorkflowRun } from '../workflow-store';
import type { KurzfassungRecord } from '../../kurzfassung/types';
import type { IDBStore } from '@/core/services/storage';

const NOW = '2026-06-11T10:00:00.000Z';

function kurzfassung(over: Partial<KurzfassungRecord> = {}): KurzfassungRecord {
  return {
    key: '16EP051840',
    quellenanalyse: 'QA',
    entwurf: '',
    finalerText: 'Kurzfassungstext.',
    checks: [],
    status: 'entwurf',
    erstellt_am: '2026-06-06T09:00:00.000Z',
    modell: 'llama.cpp',
    ...over,
  };
}

/** Minimaler In-Memory-IDBStore (nur get/set/delete genutzt). */
function fakeIdb() {
  const m = new Map<string, unknown>();
  const idb = {
    async get<T>(k: string): Promise<T | null> { return (m.get(k) as T) ?? null; },
    async set(k: string, v: unknown): Promise<void> { m.set(k, v); },
    async delete(k: string): Promise<void> { m.delete(k); },
  } as unknown as IDBStore;
  return { idb, map: m };
}

describe('buildRunFromKurzfassung', () => {
  it('freigegebene Kurzfassung → Schritt A freigegeben (+ Hash), Fokus auf B', () => {
    const rec = kurzfassung({ status: 'freigegeben', freigegeben_am: NOW });
    const run = buildRunFromKurzfassung(rec, NOW);
    expect(run.schritte.A?.status).toBe('freigegeben');
    expect(run.schritte.A?.freigabeHash).toBeTruthy();
    expect(run.aktiverSchritt).toBe('B');
    expect(run.ausKurzfassungUebernommen).toBe(true);
    expect(run.aktenzeichen).toBe('16EP051840');
  });

  it('Entwurf-Kurzfassung → Schritt A entwurf, Fokus auf A, kein Hash', () => {
    const run = buildRunFromKurzfassung(kurzfassung({ status: 'entwurf' }), NOW);
    expect(run.schritte.A?.status).toBe('entwurf');
    expect(run.schritte.A?.freigabeHash).toBeUndefined();
    expect(run.aktiverSchritt).toBe('A');
  });

  it('lässt den Original-Record unverändert (kopiert, nicht mutiert)', () => {
    const rec = kurzfassung({ verlauf: [] });
    const snapshot = JSON.stringify(rec);
    buildRunFromKurzfassung(rec, NOW);
    expect(JSON.stringify(rec)).toBe(snapshot);
  });
});

describe('loadOrMigrateWorkflowRun', () => {
  it('migriert einen Alt-Kurzfassungs-Lauf und lässt das Original lesbar', async () => {
    const { idb, map } = fakeIdb();
    map.set('gutachten-kurzfassung:16EP051840', kurzfassung({ status: 'freigegeben' }));

    const run = await loadOrMigrateWorkflowRun(idb, '16EP051840', NOW);
    expect(run.schritte.A?.status).toBe('freigegeben');
    // Original-Kurzfassung weiterhin vorhanden:
    expect(map.get('gutachten-kurzfassung:16EP051840')).toBeDefined();
    // Migrierter Run wurde persistiert:
    expect(await getWorkflowRun(idb, '16EP051840')).not.toBeNull();
  });

  it('migriert nur EINMAL — ein bestehender Run wird unverändert zurückgegeben', async () => {
    const { idb } = fakeIdb();
    await putWorkflowRun(idb, {
      aktenzeichen: 'AZ', schritte: {}, aktiverSchritt: 'D',
      erstellt_am: NOW, geaendert_am: NOW, schemaVersion: 1,
    });
    const run = await loadOrMigrateWorkflowRun(idb, 'AZ', '2026-07-01T00:00:00.000Z');
    expect(run.aktiverSchritt).toBe('D'); // nicht neu migriert
    expect(run.ausKurzfassungUebernommen).toBeUndefined();
  });

  it('ohne Alt-Lauf → leerer Run bei A', async () => {
    const { idb } = fakeIdb();
    const run = await loadOrMigrateWorkflowRun(idb, 'NEU', NOW);
    expect(run.aktiverSchritt).toBe('A');
    expect(run.schritte).toEqual({});
  });
});
