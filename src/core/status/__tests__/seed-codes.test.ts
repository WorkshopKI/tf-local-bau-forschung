import { describe, it, expect } from 'vitest';
import { baueSeedCodeFelder, ebeneVonCode, SEED_CODE_TABELLE } from '@/core/status/seed-codes';
import { LEERE_SEED_KATEGORIEN, SEED_KATEGORIEN } from '@/core/status/seed-kategorien';
import { findeZyklus, flacheBaumListe } from '@/core/status/kategorien';

const FELDER = baueSeedCodeFelder();
const KATEGORIE_IDS = new Set(SEED_KATEGORIEN.map(k => k.id));

describe('Seed-Kategoriebaum', () => {
  it('ist zyklenfrei und jeder Elternknoten existiert', () => {
    expect(findeZyklus(SEED_KATEGORIEN)).toBeNull();
    for (const k of SEED_KATEGORIEN) {
      if (k.elternId !== null) expect(KATEGORIE_IDS.has(k.elternId)).toBe(true);
    }
  });

  it('hat eindeutige Ids', () => {
    expect(KATEGORIE_IDS.size).toBe(SEED_KATEGORIEN.length);
  });

  it('trennt Verbund- und TV-Baum vollständig', () => {
    const vb = flacheBaumListe(SEED_KATEGORIEN, 'verbund');
    const tv = flacheBaumListe(SEED_KATEGORIEN, 'tv');
    expect(vb.length + tv.length).toBe(SEED_KATEGORIEN.length);
    expect(vb.every(e => e.kategorie.id.startsWith('vb.'))).toBe(true);
    expect(tv.every(e => e.kategorie.id.startsWith('tv.'))).toBe(true);
  });

  it('führt die pre-check-Gruppe unter Antragsbearbeitung', () => {
    const tv = flacheBaumListe(SEED_KATEGORIEN, 'tv');
    const precheck = tv.find(e => e.kategorie.id === 'tv.antragsbearbeitung.precheck');
    expect(precheck?.tiefe).toBe(1);
  });
});

describe('Seed-Code-Katalog', () => {
  it('ordnet jeden Code einer existierenden Kategorie zu', () => {
    for (const { kategorieId } of SEED_CODE_TABELLE) {
      expect(KATEGORIE_IDS.has(kategorieId)).toBe(true);
    }
    for (const f of FELDER) {
      expect(f.kategorieId).toBeDefined();
      expect(KATEGORIE_IDS.has(f.kategorieId!)).toBe(true);
    }
  });

  it('vergibt keine doppelten Codes und keine doppelten Spalten', () => {
    const codes = FELDER.map(f => f.code);
    expect(new Set(codes).size).toBe(codes.length);
    const spalten = FELDER.map(f => f.feldId);
    expect(new Set(spalten).size).toBe(spalten.length);
  });

  it('leitet die Ebene aus dem X-Präfix ab — passend zur Kategorie', () => {
    const kategorieEbene = new Map(SEED_KATEGORIEN.map(k => [k.id, k.ebene]));
    for (const f of FELDER) {
      expect(f.ebene).toBe(ebeneVonCode(f.code!));
      expect(f.ebene).toBe(kategorieEbene.get(f.kategorieId!));
    }
  });

  it('liest ALLE Codes aus dem TV-Record — auch die Verbund-Codes', () => {
    // Die X-Spalten stehen auf jeder TV-Zeile, nicht im Verbund-Record.
    for (const f of FELDER) expect(f.herkunft).toBe('tv-record');
  });

  it('setzt den Typ nach dem Spalten-Präfix', () => {
    for (const f of FELDER) {
      expect(f.typ).toBe(f.feldId.startsWith('T_') ? 'text' : 'datum');
    }
  });

  it('gibt jedem Code Label und Zuständigkeit', () => {
    for (const f of FELDER) {
      expect(f.label.trim().length).toBeGreaterThan(0);
      expect(['ab', 'fb', 'beide']).toContain(f.zustaendigkeit);
    }
  });

  it('vergibt Rang nur zusammen mit einer Spine-Phase', () => {
    for (const f of FELDER) {
      if (f.rang !== undefined) expect(f.spinePhase).toBeDefined();
      if (f.terminal) expect(f.rang).toBeDefined();
    }
  });

  it('hält die Rang-Vergabe sparsam — der Großteil trägt nicht zur Ableitung bei', () => {
    const mitRang = FELDER.filter(f => (f.rang ?? 0) > 0);
    expect(mitRang.length).toBeGreaterThan(0);
    expect(mitRang.length).toBeLessThan(FELDER.length / 4);
  });

  it('markiert genau die endgültigen Ausgänge als terminal', () => {
    const terminal = FELDER.filter(f => f.terminal).map(f => f.code).sort();
    expect(terminal).toEqual(['AAR', 'ABLD', 'ABLZ', 'RZZ', 'XVE']);
  });

  it('ist deterministisch — zwei Aufrufe liefern dasselbe', () => {
    expect(JSON.stringify(baueSeedCodeFelder())).toBe(JSON.stringify(FELDER));
  });

  it('lässt die eingeklappten Ordner bewusst leer', () => {
    const belegt = new Set(FELDER.map(f => f.kategorieId));
    for (const id of LEERE_SEED_KATEGORIEN) expect(belegt.has(id)).toBe(false);
  });
});
