import { describe, it, expect } from 'vitest';
import { ZAH_PHASEN_REIHENFOLGE } from '@/core/status/zah-phasen';
import {
  AB_DASHBOARD_RELEVANZ, baueSeedCodeFelder, ebeneVonCode, SEED_CODE_TABELLE,
} from '@/core/status/seed-codes';
import { ZUARBEIT_CODES } from '@/core/status/seed-codes.data';
import { LEERE_SEED_KATEGORIEN, SEED_KATEGORIEN } from '@/core/status/seed-kategorien';
import { findeZyklus, flacheBaumListe, NICHT_ZUGEORDNET_ID } from '@/core/status/kategorien';
import { ROLLEN } from '@/core/status/rollen';

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

  it('gibt jedem Code eine Bezeichnung aus der Zuarbeit', () => {
    for (const f of FELDER) {
      expect(f.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('trägt nur bekannte Rollen und schreibt die abgelöste Zuständigkeit nicht mehr', () => {
    for (const f of FELDER) {
      expect(f.rollen).toBeDefined();
      for (const r of f.rollen!) expect(ROLLEN).toContain(r);
      expect(f.zustaendigkeit).toBeUndefined();
    }
  });

  it('kuriert ausschließlich Codes, die die Zuarbeit führt', () => {
    // Sonst erschiene der Eintrag namenlos — bzw. würde stillschweigend
    // verworfen. Beides ist schlechter als ein roter Test.
    const bekannt = new Set(ZUARBEIT_CODES.map(z => z.code));
    const unbekannt: string[] = [];
    for (const { codes } of SEED_CODE_TABELLE) {
      for (const c of codes) if (!bekannt.has(c)) unbekannt.push(c);
    }
    expect(unbekannt, `Kuration kennt Codes, die die Zuarbeit nicht führt: ${unbekannt.join(', ')}`)
      .toEqual([]);
  });

  it('nimmt jeden Code der Zuarbeit auf — Uneinsortiertes in den Sammelordner', () => {
    expect(FELDER.length).toBe(ZUARBEIT_CODES.length);
    const einsortiert = new Set(SEED_CODE_TABELLE.flatMap(t => t.codes));
    for (const f of FELDER) {
      if (einsortiert.has(f.code!)) continue;
      expect(f.kategorieId).toBe(NICHT_ZUGEORDNET_ID[f.ebene]);
    }
  });

  it('vergibt die ZAH-Phase sparsam — nur wo die Zuordnung fachlich klar ist', () => {
    const mitPhase = FELDER.filter(f => f.zahPhaseId != null);
    expect(mitPhase.length).toBeGreaterThan(0);
    // Der Großteil der 505 Kürzel trägt bewusst keine: eine geratene Zuordnung
    // wäre schlechter als keine.
    expect(mitPhase.length).toBeLessThan(FELDER.length / 4);
  });

  it('setzt nur gültige ZAH-Phasen', () => {
    for (const f of FELDER) {
      if (f.zahPhaseId == null) continue;
      expect(ZAH_PHASEN_REIHENFOLGE).toContain(f.zahPhaseId);
    }
  });

  it('ist deterministisch — zwei Aufrufe liefern dasselbe', () => {
    expect(JSON.stringify(baueSeedCodeFelder())).toBe(JSON.stringify(FELDER));
  });

  it('lässt die eingeklappten Ordner bewusst leer', () => {
    // Die Sammelordner sind ausgenommen: seit die Zuarbeit alle 505 Codes
    // liefert, landet dort alles, was die Bildschirmfotos nicht zeigten.
    const belegt = new Set(FELDER.map(f => f.kategorieId));
    const sammel = new Set(Object.values(NICHT_ZUGEORDNET_ID));
    for (const id of LEERE_SEED_KATEGORIEN) {
      if (sammel.has(id)) continue;
      expect(belegt.has(id), `${id} sollte leer ausgeliefert werden`).toBe(false);
    }
  });
});

describe('AB_DASHBOARD_RELEVANZ', () => {
  /**
   * Der Relevanz-Vorschlag ist aus der AB-Mappe transkribiert, nicht aus dem
   * Katalog abgeleitet — ein Tippfehler darin wäre stumm: die Aktion setzte
   * schlicht ein Häkchen weniger. Deshalb der Abgleich gegen die Zuarbeit.
   */
  it('nennt nur Codes, die die Zuarbeit führt', () => {
    const bekannt = new Set(ZUARBEIT_CODES.map(z => z.code));
    const fehlend = AB_DASHBOARD_RELEVANZ.filter(c => !bekannt.has(c));
    expect(fehlend, `Nicht in der Zuarbeit: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('trifft für jeden Code genau ein Auslieferungs-Feld', () => {
    for (const code of AB_DASHBOARD_RELEVANZ) {
      expect(FELDER.filter(f => f.code === code), code).toHaveLength(1);
    }
  });

  it('führt jeden Code nur einmal', () => {
    expect(new Set(AB_DASHBOARD_RELEVANZ).size).toBe(AB_DASHBOARD_RELEVANZ.length);
  });
});
