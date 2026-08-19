/**
 * Die Tag-Verwaltung: Umbenennen erreicht die DATENSÄTZE, und die Registry
 * bleibt die Sprache der Nutzer.
 *
 * Beide Regeln sind v4.116 entstanden, weil sie vorher nicht galten:
 * `renameTag` änderte nur den Registry-Eintrag (das nächste „Neu zählen" holte
 * den alten Namen aus den Dokumenten zurück), und `recountTags` schwemmte die
 * maschinell gesetzten Tags — Verbund-Kennung und Dokumenttyp — gleichberechtigt
 * neben echte Schlagwörter, wo sie zum Umbenennen und Löschen angeboten wurden.
 * Beides hätte die Zuordnung zwischen Antrag und Dokument zerrissen.
 */
import { describe, it, expect } from 'vitest';
import { TagService, benenneTagInDokumentenUm, leseTagBestand } from '@/core/services/tags';
import { relationTagAusTags } from '@/core/components/dokumentAufnahmeFkz';
import type { StorageService } from '@/core/services/storage';

/** Minimaler `StorageService`-Ersatz: nur der `idb`-Teil, den `tags.ts` nutzt. */
function fakeStorage(inhalt: Record<string, unknown>): StorageService {
  const daten = new Map(Object.entries(inhalt));
  return {
    idb: {
      keys: async (praefix: string) => [...daten.keys()].filter(k => k.startsWith(praefix)),
      get: async (key: string) => daten.get(key) ?? null,
      set: async (key: string, wert: unknown) => { daten.set(key, wert); },
      delete: async (key: string) => { daten.delete(key); },
    },
    fs: null,
    _daten: daten,
  } as unknown as StorageService & { _daten: Map<string, unknown> };
}

describe('relationTagAusTags', () => {
  it('erkennt die Signatur der Aufnahme `[relationTag, typ]`', () => {
    expect(relationTagAusTags(['ZKN103113', 'vorhabensbeschreibung'])).toBe('ZKN103113');
    expect(relationTagAusTags(['16KN123456', 'stellungnahme'])).toBe('16KN123456');
  });

  it('schweigt, sobald jemand eigene Schlagwörter ergänzt hat', () => {
    // Konservativ: lieber ein technischer Tag in der Liste als ein echtes
    // Schlagwort, das niemand mehr umbenennen kann.
    expect(relationTagAusTags(['ZKN103113', 'vorhabensbeschreibung', 'batterie'])).toBeNull();
    expect(relationTagAusTags(['batterie'])).toBeNull();
    expect(relationTagAusTags([])).toBeNull();
  });

  it('kürt keinen Dokumenttyp zur Kennung', () => {
    expect(relationTagAusTags(['vorhabensbeschreibung', 'stellungnahme'])).toBeNull();
  });
});

describe('TagService.recountTags', () => {
  it('nimmt neue Schlagwörter auf und zählt sie', () => {
    const s = new TagService();
    s.recountTags(['batterie', 'batterie', 'wasserstoff']);
    expect(s.getAllTags()).toEqual([
      { name: 'batterie', count: 2 },
      { name: 'wasserstoff', count: 1 },
    ]);
  });

  it('nimmt maschinelle Tags weder auf noch behält sie sie', () => {
    const s = new TagService();
    // Ein Altbestand, den ein früheres „Neu zählen" eingeschwemmt hat.
    s.addTag('zkn103113');
    s.recountTags(
      ['zkn103113', 'vorhabensbeschreibung', 'batterie'],
      new Set(['zkn103113', 'vorhabensbeschreibung']),
    );
    expect(s.getAllTags().map(t => t.name)).toEqual(['batterie']);
  });
});

describe('TagService.renameTag', () => {
  it('führt zusammen, statt denselben Namen zweimal zu führen', () => {
    const s = new TagService();
    s.recountTags(['alt', 'alt', 'neu']);
    s.renameTag('alt', 'Neu');
    expect(s.getAllTags()).toEqual([{ name: 'neu', count: 3 }]);
  });

  it('lässt einen unbekannten oder leeren Namen unberührt', () => {
    const s = new TagService();
    s.recountTags(['alt']);
    s.renameTag('gibtsnicht', 'egal');
    s.renameTag('alt', '   ');
    expect(s.getAllTags()).toEqual([{ name: 'alt', count: 1 }]);
  });
});

describe('benenneTagInDokumentenUm', () => {
  it('schreibt den neuen Namen in jeden betroffenen Datensatz', async () => {
    const storage = fakeStorage({
      'doc:1': { id: '1', tags: ['ZKN103113', 'Vorhabensbeschreibung'] },
      'doc:2': { id: '2', tags: ['batterie'] },
      'vorgang:9': { tags: ['batterie', 'wasserstoff'] },
    });
    const n = await benenneTagInDokumentenUm(storage, 'batterie', 'Akku');
    expect(n).toBe(2);
    expect(await storage.idb.get('doc:2')).toEqual({ id: '2', tags: ['akku'] });
    expect(await storage.idb.get('vorgang:9')).toEqual({ tags: ['akku', 'wasserstoff'] });
    // Unbeteiligte Datensätze bleiben, wie sie waren.
    expect(await storage.idb.get('doc:1')).toEqual({ id: '1', tags: ['ZKN103113', 'Vorhabensbeschreibung'] });
  });

  it('vergleicht ohne Rücksicht auf Groß-/Kleinschreibung und dedupliziert', async () => {
    const storage = fakeStorage({ 'doc:1': { tags: ['Batterie', 'akku'] } });
    await benenneTagInDokumentenUm(storage, 'batterie', 'Akku');
    expect(await storage.idb.get('doc:1')).toEqual({ tags: ['akku'] });
  });

  it('tut nichts bei leerem oder gleichem Namen', async () => {
    const storage = fakeStorage({ 'doc:1': { tags: ['batterie'] } });
    expect(await benenneTagInDokumentenUm(storage, 'batterie', 'batterie')).toBe(0);
    expect(await benenneTagInDokumentenUm(storage, 'batterie', '  ')).toBe(0);
  });
});

describe('leseTagBestand', () => {
  it('trennt Schlagwörter von maschinell gesetzten Tags', async () => {
    const storage = fakeStorage({
      'doc:1': { tags: ['ZKN103113', 'vorhabensbeschreibung'] },
      'doc:2': { tags: ['ZKN103113', 'stellungnahme'] },
      'doc:3': { tags: ['batterie', 'wasserstoff'] },
    });
    const { namen, technische } = await leseTagBestand(storage);
    expect(namen).toHaveLength(6);
    expect([...technische].sort()).toEqual(['stellungnahme', 'vorhabensbeschreibung', 'zkn103113']);
  });

  it('überspringt Datensätze ohne (oder mit kaputten) Tags', async () => {
    const storage = fakeStorage({
      'doc:1': { tags: null },
      'doc:2': {},
      'doc:3': { tags: ['batterie', 42] },
    });
    const { namen } = await leseTagBestand(storage);
    expect(namen).toEqual(['batterie']);
  });
});
