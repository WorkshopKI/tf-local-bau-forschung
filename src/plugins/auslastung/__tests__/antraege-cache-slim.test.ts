/**
 * Slim-Cache-Store-Tests (v2.63): der Auslastungs-Cache hält nur noch die
 * Slim-Projektion + Stream-Artefakte (deskriptorenByAz, ztKlartexteByAz,
 * embeddableAz, xtec/adv-Az-Sets) — KEINE vollen Antrag-Records mehr.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import { putProgramm, putAntraege, putAntraegeListView } from '@/core/services/csv/idb-csv';
import { toAntragListItem } from '@/core/services/csv/list-view';
import type { Antrag, Programm } from '@/core/services/csv/types';
import type { StorageService } from '@/core/services/storage';
import {
  warmupAntraegeCache,
  invalidateAntraegeCache,
  useCacheStoreForTests,
} from '../hooks/useAntraegeCache';

const PID = 'p1';

function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-06-10T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function antrag(az: string, fields: Record<string, unknown>): Antrag {
  return {
    aktenzeichen: az,
    programm_id: PID,
    _field_sources: {},
    _updated_at: '2026-06-10T00:00:00.000Z',
    ...fields,
  } as Antrag;
}

async function setup(): Promise<StorageService> {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const idb = new IDBStore();
  await idb.open();
  await putProgramm(idb, makeProgramm());
  const antraege = [
    antrag('A1', {
      titel: 'KI-Projekt',
      verbund_titel: 'KI-Verbund',
      projektbeschreibung_text: 'Lange Beschreibung über künstliche Intelligenz und Bildverarbeitung.',
      techn_1: 'Bildverarbeitung',
      tib_kuerz: 'mue',
      vb_phase: 3,
      d_xtec: '2026-01-15',
    }),
    // A2 bewusst OHNE Titel/Beschreibung → nicht embeddable (isEmbeddableAntrag).
    antrag('A2', { vb_phase: 4, d_adv: '15.02.2026' }),
  ];
  await putAntraege(idb, antraege);
  await putAntraegeListView(idb, antraege.map(toAntragListItem));
  return { idb } as StorageService;
}

beforeEach(() => {
  invalidateAntraegeCache();
});

describe('useAntraegeCache — Slim + Stream-Artefakte (v2.63)', () => {
  it('refresh hält Slim-Records (ohne Projektbeschreibung) + Artefakte aus den vollen Records', async () => {
    const storage = await setup();
    await warmupAntraegeCache(storage, PID);

    const state = readStore();
    expect(state.loaded).toBe(true);
    expect(state.aggregatesLoaded).toBe(true);
    expect(state.antraege).toHaveLength(2);
    // Slim: schwere Texte sind NICHT retained …
    const a1 = state.antraege.find(a => a.aktenzeichen === 'A1');
    expect((a1 as unknown as Record<string, unknown>).projektbeschreibung_text).toBeUndefined();
    // … aber die v2-Slim-Felder sind da.
    expect(state.antraege.find(a => a.aktenzeichen === 'A1')?.d_xtec).toBe('2026-01-15');
    // Stream-Artefakte aus den vollen Records:
    expect(state.deskriptorenByAz.get('A1')).toContain('bildverarbeitung');
    expect(state.embeddableAz).toContain('A1');     // hat Titel + Beschreibung
    expect(state.embeddableAz).not.toContain('A2'); // ohne Texte → nicht embeddable
    expect(state.xtecAzSet.has('A1')).toBe(true);
    expect(state.advAzSet.has('A2')).toBe(true);    // dt. Datumsformat zählt
  });

  it('invalidate setzt Slim + Artefakte zurück', async () => {
    const storage = await setup();
    await warmupAntraegeCache(storage, PID);
    expect(readStore().antraege).toHaveLength(2);

    invalidateAntraegeCache();
    const state = readStore();
    expect(state.loaded).toBe(false);
    expect(state.aggregatesLoaded).toBe(false);
    expect(state.antraege).toHaveLength(0);
    expect(state.deskriptorenByAz.size).toBe(0);
    expect(state.embeddableAz).toHaveLength(0);
  });
});

function readStore(): ReturnType<typeof useCacheStoreForTests.getState> {
  return useCacheStoreForTests.getState();
}
