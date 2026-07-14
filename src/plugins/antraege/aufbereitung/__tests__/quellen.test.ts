import { describe, it, expect } from 'vitest';
import { matchTvAusDateiname, resolveAnlagenProTv } from '../quellen';
import type { IDBStore } from '@/core/services/storage';

/** Minimaler IDB-Fake: nur keys(prefix) + get(key). */
function fakeIdb(docs: Record<string, unknown>): IDBStore {
  return {
    keys: async (prefix: string) => Object.keys(docs).filter(k => k.startsWith(prefix)),
    get: async (key: string) => docs[key] ?? null,
  } as unknown as IDBStore;
}

describe('matchTvAusDateiname', () => {
  const tvs = ['16KN123456', '16KN123457', '16KN123458'];

  it('findet das TV-FKZ im Dateinamen (mit Trennern/Groß-Klein)', () => {
    expect(matchTvAusDateiname('Anlage_5_16kn123457_final.pdf', tvs)).toBe('16KN123457');
    expect(matchTvAusDateiname('16KN 12 34 58 - Arbeitsplan.docx', tvs)).toBe('16KN123458');
  });

  it('ohne erkennbares TV-FKZ → null', () => {
    expect(matchTvAusDateiname('Arbeitsplan_ohne_kennung.pdf', tvs)).toBeNull();
    expect(matchTvAusDateiname('Anlage 5.docx', tvs)).toBeNull();
  });

  it('bei Präfix-Kollision gewinnt das längste passende TV-FKZ', () => {
    const kollision = ['16KN1234', '16KN12345'];
    expect(matchTvAusDateiname('anlage5-16kn12345.pdf', kollision)).toBe('16KN12345');
  });
});

describe('resolveAnlagenProTv', () => {
  const VERBUND = 'ZEP-1';
  const tvs = ['16KN123456', '16KN123457'];
  const mkDoc = (tags: string[], filename: string, markdown: string, created: string) =>
    ({ tags, filename, markdown, created });

  it('gruppiert Anlage-5-Dokumente pro TV; jüngstes gewinnt; Unzuordenbare separat', async () => {
    const idb = fakeIdb({
      'doc:a': mkDoc([VERBUND, 'arbeitsplan'], 'AP_16KN123456.pdf', 'ALT', '2026-01-01'),
      'doc:b': mkDoc([VERBUND, 'arbeitsplan'], 'AP_16KN123456_neu.pdf', 'NEU', '2026-02-01'),
      'doc:c': mkDoc([VERBUND], 'Anlage 5 16KN123457.docx', 'TV2', '2026-01-15'),
      'doc:d': mkDoc([VERBUND, 'arbeitsplan'], 'Arbeitsplan_ohne_fkz.pdf', 'X', '2026-01-20'),
      'doc:e': mkDoc([VERBUND, 'vorhabensbeschreibung'], 'VB_16KN123456.pdf', 'VB', '2026-01-01'),
    });
    const { proTv, unzugeordnet } = await resolveAnlagenProTv(idb, VERBUND, tvs);
    expect(proTv.get('16KN123456')?.markdown).toBe('NEU'); // jüngstes
    expect(proTv.get('16KN123457')?.markdown).toBe('TV2'); // per Dateiname-Regex + Tag
    expect(unzugeordnet).toEqual(['Arbeitsplan_ohne_fkz.pdf']);
    expect(proTv.get('16KN123456')?.quelleName).toBe('AP_16KN123456_neu.pdf');
  });

  it('ignoriert Dokumente anderer Verbünde (nicht mit dem Verbund-Key getaggt)', async () => {
    const idb = fakeIdb({
      'doc:x': mkDoc(['ANDERER-VERBUND', 'arbeitsplan'], 'AP_16KN123456.pdf', 'FREMD', '2026-01-01'),
    });
    const { proTv } = await resolveAnlagenProTv(idb, VERBUND, tvs);
    expect(proTv.size).toBe(0);
  });
});
