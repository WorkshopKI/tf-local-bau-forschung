import { describe, it, expect } from 'vitest';
import {
  kategoriePfad, kategoriePfadLabel, kinderVon, flacheBaumListe,
  erzeugtZyklus, findeZyklus,
} from '@/core/status/kategorien';
import type { StatusKategorie } from '@/core/status/typen';

function kat(
  id: string, elternId: string | null, label: string,
  ebene: 'verbund' | 'tv' = 'tv', reihenfolge = 10,
): StatusKategorie {
  return { id, elternId, label, ebene, reihenfolge, aktiv: true };
}

const BAUM: StatusKategorie[] = [
  kat('tv.komm', null, 'Kommunikation', 'tv', 10),
  kat('tv.ab', null, 'Antragsbearbeitung', 'tv', 20),
  kat('tv.ab.precheck', 'tv.ab', 'pre-check', 'tv', 10),
  kat('tv.ab.ablehnung', 'tv.ab', 'Ablehnung', 'tv', 20),
  kat('vb.komm', null, 'Kommunikation', 'verbund', 10),
];

describe('kategorien — Baum-Mechanik', () => {
  it('liefert den Pfad von der Wurzel bis zur Kategorie', () => {
    expect(kategoriePfad(BAUM, 'tv.ab.precheck').map(k => k.id))
      .toEqual(['tv.ab', 'tv.ab.precheck']);
  });

  it('liefert für unbekannte Ids einen leeren Pfad statt zu werfen', () => {
    expect(kategoriePfad(BAUM, 'gibtsnicht')).toEqual([]);
    expect(kategoriePfadLabel(BAUM, undefined)).toBe('');
  });

  it('setzt das Pfad-Label lesbar zusammen', () => {
    expect(kategoriePfadLabel(BAUM, 'tv.ab.ablehnung')).toBe('Antragsbearbeitung › Ablehnung');
  });

  it('sortiert Kinder nach reihenfolge, dann Label', () => {
    expect(kinderVon(BAUM, 'tv.ab').map(k => k.id))
      .toEqual(['tv.ab.precheck', 'tv.ab.ablehnung']);
  });

  it('trennt die Ebenen — der TV-Baum enthält keine Verbund-Ordner', () => {
    const tv = flacheBaumListe(BAUM, 'tv');
    expect(tv.map(e => e.kategorie.id))
      .toEqual(['tv.komm', 'tv.ab', 'tv.ab.precheck', 'tv.ab.ablehnung']);
    expect(tv.find(e => e.kategorie.id === 'tv.ab.precheck')?.tiefe).toBe(1);
    expect(flacheBaumListe(BAUM, 'verbund').map(e => e.kategorie.id)).toEqual(['vb.komm']);
  });

  it('erkennt Selbstbezug und Ringschluss beim Umhängen', () => {
    expect(erzeugtZyklus(BAUM, 'tv.ab', 'tv.ab')).toBe(true);
    expect(erzeugtZyklus(BAUM, 'tv.ab', 'tv.ab.precheck')).toBe(true);
    expect(erzeugtZyklus(BAUM, 'tv.ab', 'tv.komm')).toBe(false);
    expect(erzeugtZyklus(BAUM, 'tv.ab', null)).toBe(false);
  });

  it('findet einen Ringschluss in kaputten Daten und hängt nicht', () => {
    const kaputt: StatusKategorie[] = [
      kat('a', 'b', 'A'), kat('b', 'a', 'B'),
    ];
    expect(findeZyklus(kaputt)).not.toBeNull();
    expect(findeZyklus(BAUM)).toBeNull();
    // Auch die Pfad-Funktion muss terminieren.
    expect(kategoriePfad(kaputt, 'a').length).toBeLessThanOrEqual(2);
  });

  it('überspringt zyklische Knoten in der Baum-Liste, statt zu hängen', () => {
    const kaputt: StatusKategorie[] = [...BAUM, kat('x', 'y', 'X'), kat('y', 'x', 'Y')];
    const liste = flacheBaumListe(kaputt, 'tv');
    expect(liste.map(e => e.kategorie.id)).not.toContain('x');
    expect(liste.length).toBe(4);
  });
});
