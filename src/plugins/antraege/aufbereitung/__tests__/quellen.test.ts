import { describe, it, expect } from 'vitest';
import { baueKorpus, matchTvAusDateiname, misseKorpus, resolveAnlagenProTv } from '../quellen';
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

describe('misseKorpus', () => {
  it('meldet die Ueberschreitung ueber die SUMME, nicht je Datei', () => {
    // Genau die Luecke, die sonst niemand sieht: `DokumentAufnahme` warnt pro
    // Datei, und `runBaustein` kuerzt nicht. Beide Dateien liegen einzeln unter
    // der Grenze, ihr Korpus darueber.
    const vb = { name: 'VB.pdf', markdown: 'x'.repeat(60) };
    const markt = { name: 'Markt.pdf', markdown: 'y'.repeat(60) };
    expect(misseKorpus(vb.markdown, 100).ueberCap).toBe(false);
    expect(misseKorpus(markt.markdown, 100).ueberCap).toBe(false);

    const korpus = baueKorpus(vb, [markt]);
    const mass = misseKorpus(korpus, 100);
    expect(mass.ueberCap).toBe(true);
    expect(mass.zeichen).toBe(korpus.length);
    expect(mass.cap).toBe(100);
  });

  it('meldet nichts, solange der Korpus passt', () => {
    expect(misseKorpus('kurz', 100)).toEqual({ zeichen: 4, cap: 100, ueberCap: false });
  });
});
