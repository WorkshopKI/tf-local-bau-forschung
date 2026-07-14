import { describe, it, expect } from 'vitest';
import { groupRegelnByKategorie } from '../regelGruppen';
import type { QualitaetsRegel } from '@/core/services/skills';

function regel(over: Partial<QualitaetsRegel> & { id: string; typ: string }): QualitaetsRegel {
  return {
    name: over.id,
    params: {},
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: 't',
    geaendert_am: 't',
    ...over,
  };
}

describe('groupRegelnByKategorie', () => {
  const regeln = [
    regel({ id: 'satz', typ: 'satzanzahl' }),                                    // umfang
    regel({ id: 'zeichen', typ: 'zeichen_max' }),                                // umfang
    regel({ id: 'satzlaenge', typ: 'satzlaenge_max' }),                          // sprache
    regel({ id: 'anfang', typ: 'pflicht_anfang' }),                             // struktur
    regel({ id: 'quellen', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich' }), // inhalt
    regel({ id: 'form', typ: 'nf_keine_platzhalter_reste' }),                    // form
  ];

  it('gruppiert nach effektiver Kategorie in stabiler KATEGORIE_ORDER', () => {
    const g = groupRegelnByKategorie(regeln, []);
    expect(g.map(x => x.kategorie)).toEqual(['umfang', 'sprache', 'struktur', 'inhalt', 'form']);
    expect(g.map(x => x.label)).toEqual(['Umfang', 'Sprache', 'Struktur', 'Inhalt & Quellen', 'Vollständigkeit & Form']);
  });

  it('nur nicht-leere Gruppen', () => {
    const g = groupRegelnByKategorie([regel({ id: 'satz', typ: 'satzanzahl' })], []);
    expect(g).toHaveLength(1);
    expect(g[0]!.kategorie).toBe('umfang');
  });

  it('zählt zugeordnete (angehakte) Regeln pro Gruppe', () => {
    const g = groupRegelnByKategorie(regeln, ['satz', 'anfang']);
    const umfang = g.find(x => x.kategorie === 'umfang')!;
    const struktur = g.find(x => x.kategorie === 'struktur')!;
    const sprache = g.find(x => x.kategorie === 'sprache')!;
    expect(umfang.zugeordnet).toBe(1); // nur 'satz' von {satz, zeichen}
    expect(umfang.gesamt).toBe(2);
    expect(struktur.zugeordnet).toBe(1);
    expect(sprache.zugeordnet).toBe(0);
  });

  it('unbekannte Kategorie (explizite Regel-kategorie) stabil ans Ende', () => {
    const mit = [...regeln, regel({ id: 'x', typ: 'irgendwas', kategorie: 'spezial' })];
    const g = groupRegelnByKategorie(mit, []);
    const letzte = g[g.length - 1]!;
    expect(letzte.kategorie).toBe('spezial');
    expect(letzte.label).toBe('spezial'); // kein Label → Fallback auf Key
  });

  it('leere Bibliothek → keine Gruppen', () => {
    expect(groupRegelnByKategorie([], [])).toEqual([]);
  });
});
