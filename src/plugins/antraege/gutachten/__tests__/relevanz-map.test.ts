import { describe, it, expect } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { SEED_RELEVANZ_MAP_SKILL } from '@/core/services/skills';
import { hashText } from '../runner';
import {
  parseVbHeadings,
  buildRelevanzPrompt,
  parseRelevanzMap,
  assembleVbRelevant,
  relevanzMapCacheKey,
  vbBrauchtRelevanzMap,
  getOrComputeRelevanzMap,
  RELEVANZ_MAP_MIN_CHARS,
  type RelevanzAbschnitt,
} from '../relevanz-map';

const ABSCHNITTE: RelevanzAbschnitt[] = [
  { id: 'B', label: 'Hintergrund' },
  { id: 'C', label: 'Technische Risiken' },
];

function fakeIdb(seed: Record<string, unknown> = {}): { idb: IDBStore; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>(Object.entries(seed));
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
  } as unknown as IDBStore;
  return { idb, kv };
}

function fakeTransport(reply: string | (() => Promise<string>)): AITransport {
  const fn = typeof reply === 'function' ? reply : async () => reply;
  return {
    name: 'fake',
    ping: async () => true,
    submitMessage: async () => fn(),
    submitConversation: async () => fn(),
  } as unknown as AITransport;
}

describe('parseVbHeadings — H2/H3, Spans, Intro', () => {
  it('führt den Vorspann als h-intro und nummeriert H2/H3 in Dokumentreihenfolge', () => {
    const md = 'Vorspann-Text.\n\n## Erstes\nA-Body\n\n### Unter\nB-Body\n\n## Zweites\nC-Body';
    const hs = parseVbHeadings(md);
    expect(hs.map(h => h.id)).toEqual(['h-intro', 'h0', 'h1', 'h2']);
    expect(hs.map(h => h.heading)).toEqual(['(Einleitung)', 'Erstes', 'Unter', 'Zweites']);
  });

  it('Spans sind wortgetreu (slice == Originalausschnitt) und decken den ganzen Text ab', () => {
    const md = '## Erstes\nA-Body\n\n## Zweites\nC-Body';
    const hs = parseVbHeadings(md);
    expect(md.slice(hs[0]!.start, hs[0]!.end)).toBe('## Erstes\nA-Body\n\n');
    expect(md.slice(hs[1]!.start, hs[1]!.end)).toBe('## Zweites\nC-Body');
    expect(hs[1]!.end).toBe(md.length);
  });

  it('ohne Heading: ganzes Dokument als eine h-intro-Sektion', () => {
    const hs = parseVbHeadings('Nur Fließtext ohne Überschrift.');
    expect(hs).toHaveLength(1);
    expect(hs[0]!).toMatchObject({ id: 'h-intro', start: 0 });
  });

  it('leeres/whitespace-Dokument → keine Sektionen', () => {
    expect(parseVbHeadings('   \n  ')).toEqual([]);
  });

  it('# (H1) zählt nicht — nur H2/H3', () => {
    const hs = parseVbHeadings('# Titel\nText\n\n## Echt\nBody');
    // H1 fällt in den Vorspann, ## ist h0.
    expect(hs.map(h => h.id)).toEqual(['h-intro', 'h0']);
    expect(hs[1]!.heading).toBe('Echt');
  });
});

describe('buildRelevanzPrompt — enthält Headings, Abschnitte, VB', () => {
  it('listet IDs, Gutachten-Teile und die volle VB', () => {
    const md = '## Eins\nBody-eins';
    const hs = parseVbHeadings(md);
    const p = buildRelevanzPrompt(hs, md, ABSCHNITTE);
    expect(p).toContain('[h0] Eins');
    expect(p).toContain('- B: Hintergrund');
    expect(p).toContain('- C: Technische Risiken');
    expect(p).toContain('Body-eins');
    expect(p).toMatch(/fasse nichts zusammen/i);
  });
});

describe('parseRelevanzMap — tolerant', () => {
  const KNOWN = ['h-intro', 'h0', 'h1', 'h2'];

  it('extrahiert bekannte IDs je Teil', () => {
    const raw = 'B: h0, h2\nC: [h1]';
    expect(parseRelevanzMap(raw, KNOWN)).toEqual({ B: ['h0', 'h2'], C: ['h1'] });
  });

  it('verwirft unbekannte + doppelte IDs, normalisiert „Teil B" → B', () => {
    const raw = 'Teil B: h0, h0, h99, h1';
    expect(parseRelevanzMap(raw, KNOWN)).toEqual({ B: ['h0', 'h1'] });
  });

  it('akzeptiert h-intro', () => {
    expect(parseRelevanzMap('B: h-intro, h0', KNOWN)).toEqual({ B: ['h-intro', 'h0'] });
  });

  it('Müll / fehlende IDs → leer, kein Throw', () => {
    expect(parseRelevanzMap('völliger Unsinn ohne Doppelpunkt', KNOWN)).toEqual({});
    expect(parseRelevanzMap('', KNOWN)).toEqual({});
    expect(parseRelevanzMap('B: nur Text ohne IDs', KNOWN)).toEqual({});
  });
});

describe('assembleVbRelevant — wortgetreu, Dokumentreihenfolge, Budget', () => {
  const md = '## Eins\nEins-Body\n\n## Zwei\nZwei-Body\n\n## Drei\nDrei-Body';
  const hs = parseVbHeadings(md);

  it('fügt die getaggten Sektionen wortgetreu in Dokumentreihenfolge zusammen (nicht in Map-Reihenfolge)', () => {
    const out = assembleVbRelevant({ B: ['h2', 'h0'] }, hs, md, 'B', 10_000);
    // h0 vor h2, obwohl die Map h2 zuerst nennt.
    expect(out).toBe('## Eins\nEins-Body\n\n## Drei\nDrei-Body');
  });

  it('respektiert das Zeichen-Budget (stoppt vor Überschreitung)', () => {
    const out = assembleVbRelevant({ B: ['h0', 'h1', 'h2'] }, hs, md, 'B', 20);
    expect(out).toBe('## Eins\nEins-Body');
  });

  it('Abschnitt nicht in der Map → Leerstring (Caller fällt auf Volltext zurück)', () => {
    expect(assembleVbRelevant({ B: ['h0'] }, hs, md, 'C', 10_000)).toBe('');
    expect(assembleVbRelevant({}, hs, md, 'B', 10_000)).toBe('');
  });
});

describe('relevanzMapCacheKey + vbBrauchtRelevanzMap', () => {
  it('Cache-Key ist stabil und antrag+hash-spezifisch', () => {
    expect(relevanzMapCacheKey('AZ-1', 'abc')).toBe('relevanz-map:AZ-1:abc');
  });
  it('Schwelle: unter MIN → false, darüber → true', () => {
    expect(vbBrauchtRelevanzMap('x'.repeat(RELEVANZ_MAP_MIN_CHARS))).toBe(false);
    expect(vbBrauchtRelevanzMap('x'.repeat(RELEVANZ_MAP_MIN_CHARS + 1))).toBe(true);
  });
});

describe('getOrComputeRelevanzMap — Cache + Fallback', () => {
  const md = '## Eins\nEins-Body\n\n## Zwei\nZwei-Body';

  it('Cache-Hit bei passendem VB-Hash → kein LLM-Lauf', async () => {
    const key = relevanzMapCacheKey('AZ', hashText(md));
    const { idb } = fakeIdb({ [key]: { vbHash: hashText(md), map: { B: ['h0'] } } });
    let called = 0;
    const transport = fakeTransport(async () => { called++; return 'B: h1'; });
    const res = await getOrComputeRelevanzMap(idb, transport, SEED_RELEVANZ_MAP_SKILL, 'AZ', md, ABSCHNITTE);
    expect(res.map).toEqual({ B: ['h0'] });
    expect(called).toBe(0);
  });

  it('Cache-Miss → berechnet, parst und schreibt in den kv-Store', async () => {
    const { idb, kv } = fakeIdb();
    const transport = fakeTransport('B: h0\nC: h1');
    const res = await getOrComputeRelevanzMap(idb, transport, SEED_RELEVANZ_MAP_SKILL, 'AZ', md, ABSCHNITTE);
    expect(res.map).toEqual({ B: ['h0'], C: ['h1'] });
    expect(kv.get(relevanzMapCacheKey('AZ', hashText(md)))).toEqual({ vbHash: hashText(md), map: { B: ['h0'], C: ['h1'] } });
  });

  it('leere Map (Parse-Fehler) → nicht gecacht (nächster Lauf darf neu versuchen)', async () => {
    const { idb, kv } = fakeIdb();
    const transport = fakeTransport('völliger Unsinn');
    const res = await getOrComputeRelevanzMap(idb, transport, SEED_RELEVANZ_MAP_SKILL, 'AZ', md, ABSCHNITTE);
    expect(res.map).toEqual({});
    expect(kv.size).toBe(0);
  });

  it('Transport-Fehler → leere Map, kein Throw (Volltext-Fallback beim Caller)', async () => {
    const { idb } = fakeIdb();
    const transport = fakeTransport(async () => { throw new Error('KI weg'); });
    const res = await getOrComputeRelevanzMap(idb, transport, SEED_RELEVANZ_MAP_SKILL, 'AZ', md, ABSCHNITTE);
    expect(res.map).toEqual({});
    expect(res.headings.map(h => h.id)).toEqual(['h0', 'h1']);
  });

  it('veralteter Cache (VB-Hash passt nicht) → Neuberechnung', async () => {
    const staleKey = relevanzMapCacheKey('AZ', 'alter-hash');
    const { idb } = fakeIdb({ [staleKey]: { vbHash: 'alter-hash', map: { B: ['h9'] } } });
    const transport = fakeTransport('B: h0');
    const res = await getOrComputeRelevanzMap(idb, transport, SEED_RELEVANZ_MAP_SKILL, 'AZ', md, ABSCHNITTE);
    expect(res.map).toEqual({ B: ['h0'] });
  });
});
