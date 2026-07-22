import { describe, it, expect } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { leseGecachteBausteine } from '../baustein-rehydrierung';
import {
  aspekteCacheKey, getOrComputeBaustein, glossarCacheKey,
  steckbriefCacheKey, verwertungCacheKey, vbHashFuer, zahlenCacheKey,
} from '../bausteine';
import { recherchePromptCacheKey } from '../recherche-prompt';

/** Minimaler In-Memory-IDB (nur die genutzten Methoden) — Muster aus `bausteine.test.ts`. */
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

const ALLE_KEYS = (antragKey: string, vbHash: string) => ({
  aspekte: aspekteCacheKey(antragKey, vbHash),
  steckbrief: steckbriefCacheKey(antragKey, vbHash),
  zahlen: zahlenCacheKey(antragKey, vbHash),
  glossar: glossarCacheKey(antragKey, vbHash),
  verwertung: verwertungCacheKey(antragKey, vbHash),
  recherchePrompt: recherchePromptCacheKey(antragKey, vbHash),
});

describe('leseGecachteBausteine', () => {
  it('liest alle sechs Bausteine zurueck', async () => {
    const { idb, store } = fakeIdb();
    const keys = ALLE_KEYS('A', 'h1');
    for (const [name, key] of Object.entries(keys)) {
      store.set(key, { vbHash: 'h1', daten: { woher: name } });
    }

    const b = await leseGecachteBausteine(idb, 'A', 'h1');
    expect(b.aspekte).toEqual({ woher: 'aspekte' });
    expect(b.steckbrief).toEqual({ woher: 'steckbrief' });
    expect(b.zahlen).toEqual({ woher: 'zahlen' });
    expect(b.glossar).toEqual({ woher: 'glossar' });
    expect(b.verwertung).toEqual({ woher: 'verwertung' });
    expect(b.recherchePrompt).toEqual({ woher: 'recherchePrompt' });
  });

  /** Ein degradierter Lauf wird nicht gecacht — Teil-Treffer ist der Normalfall. */
  it('Teil-Treffer: die uebrigen bleiben null', async () => {
    const { idb, store } = fakeIdb();
    store.set(ALLE_KEYS('A', 'h1').steckbrief, { vbHash: 'h1', daten: { x: 1 } });

    const b = await leseGecachteBausteine(idb, 'A', 'h1');
    expect(b.steckbrief).toEqual({ x: 1 });
    expect(b.aspekte).toBeNull();
    expect(b.zahlen).toBeNull();
    expect(b.glossar).toBeNull();
    expect(b.verwertung).toBeNull();
    expect(b.recherchePrompt).toBeNull();
  });

  it('geaenderter Korpus liefert nichts statt Veraltetem', async () => {
    const { idb, store } = fakeIdb();
    for (const key of Object.values(ALLE_KEYS('A', 'h1'))) store.set(key, { vbHash: 'h1', daten: { x: 1 } });

    const b = await leseGecachteBausteine(idb, 'A', 'h2');
    expect(Object.values(b).every(v => v === null)).toBe(true);
  });

  it('fremder Antrag wird nicht mitgelesen', async () => {
    const { idb, store } = fakeIdb();
    store.set(ALLE_KEYS('B', 'h1').steckbrief, { vbHash: 'h1', daten: { x: 1 } });

    expect((await leseGecachteBausteine(idb, 'A', 'h1')).steckbrief).toBeNull();
  });

  it('leerer Store: sechs nulls statt Wurf', async () => {
    const { idb } = fakeIdb();
    const b = await leseGecachteBausteine(idb, 'A', 'h1');
    expect(Object.values(b).every(v => v === null)).toBe(true);
  });

  it('werfender Store: sechs nulls statt Wurf', async () => {
    const idb = { get: async () => { throw new Error('idb kaputt'); } } as unknown as IDBStore;
    const b = await leseGecachteBausteine(idb, 'A', 'h1');
    expect(Object.values(b).every(v => v === null)).toBe(true);
  });
});

/**
 * Der eigentliche Regressionsschutz: Schreib- und Lesepfad muessen denselben Key
 * treffen. Laufen sie auseinander, ist die Rehydrierung eine stille Attrappe — die
 * Ergebnisse liegen im Store und werden trotzdem nie wieder gefunden.
 */
describe('Kopplung Schreiben ↔ Lesen', () => {
  const skill = { id: 'x', systemPrompt: 'sys', maxTokens: 512 } as unknown as SkillRecord;

  it('was getOrComputeBaustein schreibt, findet leseGecachteBausteine wieder', async () => {
    const { idb } = fakeIdb();
    const korpus = '# VB\n\nInhalt des Korpus.';
    const vbHash = vbHashFuer(korpus);
    let laeufe = 0;
    const transport = {
      submitConversation: async (): Promise<string> => { laeufe += 1; return 'roh'; },
    } as unknown as AITransport;

    const geschrieben = await getOrComputeBaustein<{ n: number }>(
      idb, transport, skill, steckbriefCacheKey('A', vbHash), vbHash, () => 'p', () => ({ n: 42 }),
    );
    expect(geschrieben.status).toBe('ok');
    expect(laeufe).toBe(1);

    const b = await leseGecachteBausteine(idb, 'A', vbHash);
    expect(b.steckbrief).toEqual({ n: 42 });
    expect(laeufe).toBe(1); // kein zweiter LLM-Lauf fuer das Zurueckholen
  });
});
