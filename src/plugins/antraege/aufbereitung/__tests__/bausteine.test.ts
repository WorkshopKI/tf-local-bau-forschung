import { describe, it, expect } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import {
  getOrComputeBaustein, loescheBausteinCaches, istAufbereitungBausteinFreigeschaltet,
  aspekteCacheKey, steckbriefCacheKey, vbHashFuer, ROHTEXT_MAX,
} from '../bausteine';

/** Minimaler In-Memory-IDB (nur die genutzten Methoden). */
function fakeIdb(): { store: Map<string, unknown>; idb: IDBStore } {
  const store = new Map<string, unknown>();
  const idb = {
    get: async <T>(k: string): Promise<T | null> => (store.has(k) ? (store.get(k) as T) : null),
    set: async (k: string, v: unknown): Promise<void> => { store.set(k, v); },
    delete: async (k: string): Promise<void> => { store.delete(k); },
    keys: async (prefix?: string): Promise<string[]> =>
      [...store.keys()].filter(k => !prefix || k.startsWith(prefix)),
  } as unknown as IDBStore;
  return { store, idb };
}

const skill = { id: 'x', systemPrompt: 'sys', maxTokens: 512 } as unknown as SkillRecord;
const transportMit = (antwort: string): AITransport =>
  ({ submitConversation: async () => antwort } as unknown as AITransport);
const transportWirft = (): AITransport =>
  ({ submitConversation: async () => { throw new Error('down'); } } as unknown as AITransport);
/** Gibt je Submit die nächste Antwort der Sequenz zurück (letzte wird wiederholt); zählt die Läufe. */
function transportSequenz(antworten: string[]): { transport: AITransport; laeufe: () => number } {
  let i = 0;
  const transport = {
    submitConversation: async (): Promise<string> => antworten[Math.min(i++, antworten.length - 1)]!,
  } as unknown as AITransport;
  return { transport, laeufe: () => i };
}

describe('getOrComputeBaustein', () => {
  const key = aspekteCacheKey('A', 'h1');

  it('Cache-Hit bei passendem VB-Hash → ok ohne Lauf', async () => {
    const { idb, store } = fakeIdb();
    store.set(key, { vbHash: 'h1', daten: { wert: 7 } });
    let liefLauf = false;
    const transport = { submitConversation: async () => { liefLauf = true; return 'x'; } } as unknown as AITransport;
    const res = await getOrComputeBaustein<{ wert: number }>(idb, transport, skill, key, 'h1', () => 'p', () => ({ wert: 0 }));
    expect(res.status).toBe('ok');
    expect(res.daten).toEqual({ wert: 7 });
    expect(liefLauf).toBe(false);
  });

  it('Miss + parse ok → ok + cachet das Ergebnis', async () => {
    const { idb, store } = fakeIdb();
    const res = await getOrComputeBaustein<{ n: number }>(idb, transportMit('roh'), skill, key, 'h1', () => 'p', () => ({ n: 3 }));
    expect(res.status).toBe('ok');
    expect(res.daten).toEqual({ n: 3 });
    expect(store.get(key)).toEqual({ vbHash: 'h1', daten: { n: 3 } });
  });

  it('Miss + parse null → degradiert mit Rohtext, NICHT gecacht', async () => {
    const { idb, store } = fakeIdb();
    const res = await getOrComputeBaustein<unknown>(idb, transportMit('kaputt'), skill, key, 'h1', () => 'p', () => null);
    expect(res.status).toBe('degradiert');
    expect(res.rohtext).toBe('kaputt');
    expect(store.has(key)).toBe(false);
  });

  it('Transport wirft → fehler, NICHT gecacht', async () => {
    const { idb, store } = fakeIdb();
    const res = await getOrComputeBaustein<unknown>(idb, transportWirft(), skill, key, 'h1', () => 'p', () => ({}));
    expect(res.status).toBe('fehler');
    expect(store.has(key)).toBe(false);
  });

  it('force überspringt den Cache-Read und rechnet neu', async () => {
    const { idb, store } = fakeIdb();
    store.set(key, { vbHash: 'h1', daten: { alt: true } });
    const res = await getOrComputeBaustein<{ neu: boolean }>(
      idb, transportMit('roh'), skill, key, 'h1', () => 'p', () => ({ neu: true }), { force: true },
    );
    expect(res.daten).toEqual({ neu: true });
    expect(store.get(key)).toEqual({ vbHash: 'h1', daten: { neu: true } });
  });

  it('Parser, der wirft, degradiert (kein Throw nach außen)', async () => {
    const { idb } = fakeIdb();
    const res = await getOrComputeBaustein<unknown>(idb, transportMit('x'), skill, key, 'h1', () => 'p', () => { throw new Error('parse'); });
    expect(res.status).toBe('degradiert');
  });

  it('ohne verdaechtig: null → sofort degradiert, KEIN Retry (nur ein Lauf)', async () => {
    const { idb } = fakeIdb();
    const seq = transportSequenz(['leer', 'leer']);
    const res = await getOrComputeBaustein<unknown>(idb, seq.transport, skill, key, 'h1', () => 'p', () => null);
    expect(res.status).toBe('degradiert');
    expect(seq.laeufe()).toBe(1);       // kein Retry ohne opts.verdaechtig
    expect(res.retryAnzahl).toBeUndefined();
  });

  it('verdaechtig: auffälliges Erstergebnis → Retry → zweiter Lauf ok → ok + retryAnzahl, gecacht', async () => {
    const { idb, store } = fakeIdb();
    const seq = transportSequenz(['leer', 'voll']);
    const res = await getOrComputeBaustein<{ n: number }>(
      idb, seq.transport, skill, key, 'h1', () => 'p',
      (raw) => (raw === 'leer' ? { n: 0 } : { n: 1 }),
      { verdaechtig: { pruefe: (d) => d.n === 0, grund: 'keine Zuordnung' } },
    );
    expect(res.status).toBe('ok');
    expect(res.daten).toEqual({ n: 1 });
    expect(res.retryAnzahl).toBe(1);
    expect(seq.laeufe()).toBe(2);
    expect(store.get(key)).toEqual({ vbHash: 'h1', daten: { n: 1 } });
  });

  it('verdaechtig: beide Läufe verdächtig → degradiert mit Begründung + retryAnzahl, NICHT gecacht', async () => {
    const { idb, store } = fakeIdb();
    const seq = transportSequenz(['leer', 'leer']);
    const res = await getOrComputeBaustein<{ n: number }>(
      idb, seq.transport, skill, key, 'h1', () => 'p', () => ({ n: 0 }),
      { verdaechtig: { pruefe: (d) => d.n === 0, grund: 'Modell hat keine Sektion zugeordnet' } },
    );
    expect(res.status).toBe('degradiert');
    expect(res.begruendung).toBe('Modell hat keine Sektion zugeordnet');
    expect(res.retryAnzahl).toBe(1);
    expect(res.rohtext).toBe('leer');
    expect(store.has(key)).toBe(false);
  });

  it('verdaechtig: null-Parse in beiden Läufen → degradiert „Antwort nicht parsebar"', async () => {
    const { idb } = fakeIdb();
    const res = await getOrComputeBaustein<{ n: number }>(
      idb, transportMit('kaputt'), skill, key, 'h1', () => 'p', () => null,
      { verdaechtig: { pruefe: () => false, grund: 'egal' } },
    );
    expect(res.status).toBe('degradiert');
    expect(res.begruendung).toBe('Antwort nicht parsebar');
    expect(res.retryAnzahl).toBe(1);
  });

  it('kappt den mitgespeicherten Rohtext auf ROHTEXT_MAX', async () => {
    const { idb } = fakeIdb();
    const riesig = 'x'.repeat(ROHTEXT_MAX + 100);
    const res = await getOrComputeBaustein<unknown>(idb, transportMit(riesig), skill, key, 'h1', () => 'p', () => null);
    expect(res.rohtext?.length).toBe(ROHTEXT_MAX);
  });
});

describe('loescheBausteinCaches', () => {
  it('löscht beide Baustein-Präfixe (alle VB-Hashes), lässt andere Keys unberührt', async () => {
    const { idb, store } = fakeIdb();
    store.set(aspekteCacheKey('A', 'h1'), 1);
    store.set(aspekteCacheKey('A', 'h2'), 1);
    store.set(steckbriefCacheKey('A', 'h1'), 1);
    store.set('aufbereitung:A', 1);            // deterministischer Run — bleibt
    store.set(aspekteCacheKey('B', 'h1'), 1);  // anderer Antrag — bleibt
    await loescheBausteinCaches(idb, 'A');
    expect(store.has(aspekteCacheKey('A', 'h1'))).toBe(false);
    expect(store.has(aspekteCacheKey('A', 'h2'))).toBe(false);
    expect(store.has(steckbriefCacheKey('A', 'h1'))).toBe(false);
    expect(store.has('aufbereitung:A')).toBe(true);
    expect(store.has(aspekteCacheKey('B', 'h1'))).toBe(true);
  });
});

describe('istAufbereitungBausteinFreigeschaltet', () => {
  const aktiverSkill = { aktiv: true } as unknown as SkillRecord;
  const gesperrt = { aktiv: false } as unknown as SkillRecord;
  const ohneFlag = {} as unknown as SkillRecord;

  it('dev: jeder geladene Skill läuft (ignoriert aktiv)', () => {
    expect(istAufbereitungBausteinFreigeschaltet(gesperrt, true)).toBe(true);
    expect(istAufbereitungBausteinFreigeschaltet(null, true)).toBe(false);
  });

  it('prod: respektiert aktiv !== false', () => {
    expect(istAufbereitungBausteinFreigeschaltet(aktiverSkill, false)).toBe(true);
    expect(istAufbereitungBausteinFreigeschaltet(ohneFlag, false)).toBe(true);
    expect(istAufbereitungBausteinFreigeschaltet(gesperrt, false)).toBe(false);
  });
});

describe('Cache-Keys + VB-Hash', () => {
  it('Baustein-Keys sind pro Antrag + VB-Hash getrennt und vom deterministischen Run verschieden', () => {
    expect(aspekteCacheKey('A', 'h1')).toBe('aufbereitung:A:aspekte:h1');
    expect(steckbriefCacheKey('A', 'h1')).toBe('aufbereitung:A:steckbrief:h1');
    expect(vbHashFuer('gleich')).toBe(vbHashFuer('gleich'));
    expect(vbHashFuer('a')).not.toBe(vbHashFuer('b'));
  });
});
