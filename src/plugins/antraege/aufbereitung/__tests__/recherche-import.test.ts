import { describe, it, expect } from 'vitest';
import { strukturiereImport } from '../recherche-import';
import { AUFBEREITUNG_RECHERCHE_IMPORT_SKILL } from '@/core/services/skills';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { AufbereitungRun } from '../types';

function fakeIdb(): IDBStore {
  const store = new Map<string, unknown>();
  return {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    set: async (k: string, v: unknown) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
    keys: async (p?: string) => [...store.keys()].filter(k => !p || k.startsWith(p)),
  } as unknown as IDBStore;
}
const transportMit = (antwort: string): AITransport => ({ submitConversation: async () => antwort } as unknown as AITransport);
const transportWirft = (): AITransport => ({ submitConversation: async () => { throw new Error('down'); } } as unknown as AITransport);

const deps = (transport: AITransport) => ({ idb: fakeIdb(), transport, skill: AUFBEREITUNG_RECHERCHE_IMPORT_SKILL, antragKey: 'A-1' });

describe('strukturiereImport', () => {
  it('übernimmt einen direkten JSON-Block ohne LLM-Lauf (herkunft json)', async () => {
    const raw = 'Report\n```json\n{ "schemaVersion": 1, "quellen": [], "aussagen": [{ "kategorie": "zielmarkt", "text": "Wachstum" }] }\n```';
    const r = await strukturiereImport(raw); // keine deps → kein LLM nötig
    expect(r.herkunftInhalt).toBe('json');
    expect(r.unstrukturiert).toBe(false);
    expect(r.kern.aussagen[0]?.text).toBe('Wachstum');
  });

  it('strukturiert reinen Text über den internen Lauf (herkunft text)', async () => {
    const llm = '```json\n{ "schemaVersion": 1, "quellen": [{ "url": "https://q.example" }], "aussagen": [{ "kategorie": "wettbewerb", "text": "Anbieter Z" }] }\n```';
    const r = await strukturiereImport('Freitext-Report ohne JSON.', deps(transportMit(llm)));
    expect(r.herkunftInhalt).toBe('text');
    expect(r.unstrukturiert).toBe(false);
    expect(r.kern.aussagen[0]?.kategorie).toBe('wettbewerb');
  });

  it('übernimmt Rohtext, wenn keine deps vorhanden sind', async () => {
    const r = await strukturiereImport('Nur Prosa.');
    expect(r.unstrukturiert).toBe(true);
    expect(r.kern.aussagen).toEqual([]);
  });

  it('übernimmt Rohtext, wenn der interne Lauf scheitert', async () => {
    const r = await strukturiereImport('Nur Prosa.', deps(transportWirft()));
    expect(r.unstrukturiert).toBe(true);
    expect(r.kern.aussagen).toEqual([]);
  });
});

describe('Run-Kompatibilität (alt → neu)', () => {
  it('lädt einen alten Run ohne extern-Feld (optional, additiv)', () => {
    const alt: AufbereitungRun = {
      version: 1, antragKey: 'A-1', erzeugtAm: 't', quellen: [], gliederung: [], tabellen: [], zeitplan: null,
      befunde: [], offenePunkte: [],
    };
    expect(alt.extern).toBeUndefined();
    expect((alt.extern ?? []).length).toBe(0);
  });
});
