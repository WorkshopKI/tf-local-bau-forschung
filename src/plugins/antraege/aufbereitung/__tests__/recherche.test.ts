import { describe, it, expect } from 'vitest';
import { baueRechercheAnfragen } from '../recherche';
import type { SteckbriefDaten } from '../steckbrief';

function steckbrief(over: Partial<SteckbriefDaten> = {}): SteckbriefDaten {
  return {
    einSatz: null, innovation: [], fueGegenstand: [], laufzeit: null, kernZielwert: null,
    zielmaerkte: [], personal: [], auftraegeDritte: [],
    ...over,
  };
}
const alleTexte = (g: ReturnType<typeof baueRechercheAnfragen>): string[] =>
  g.flatMap(x => x.anfragen.map(a => a.text));

describe('baueRechercheAnfragen', () => {
  it('leerer Steckbrief + keine Stammdaten → keine Gruppen', () => {
    expect(baueRechercheAnfragen(steckbrief(), { antragsteller: null })).toEqual([]);
    expect(baueRechercheAnfragen(null, { antragsteller: null })).toEqual([]);
  });

  it('Zielmärkte → Marktzahlen-Gruppe (Volumen + Wachstum je Markt)', () => {
    const g = baueRechercheAnfragen(
      steckbrief({ zielmaerkte: [{ markt: 'interaktive Displays', sektionIds: [] }] }),
      { antragsteller: null },
    );
    const markt = g.find(x => x.id === 'markt')!;
    expect(markt.anfragen.map(a => a.text)).toEqual([
      'Marktvolumen interaktive Displays',
      'Marktwachstum interaktive Displays Prognose',
    ]);
  });

  it('Antragsteller + FuE-Gegenstand → Wettbewerb-Gruppe', () => {
    const g = baueRechercheAnfragen(
      steckbrief({ fueGegenstand: [{ text: 'Multitouch-Tisch mit RFID-Objekterkennung', sektionIds: [] }] }),
      { antragsteller: 'ProtoWerk GmbH' },
    );
    const w = g.find(x => x.id === 'wettbewerb')!;
    expect(w.anfragen.map(a => a.text)).toContain('ProtoWerk GmbH Wettbewerber');
    expect(w.anfragen.some(a => a.text.startsWith('Multitouch-Tisch mit RFID-Objekterkennung') && a.text.endsWith('Anbieter Vergleich'))).toBe(true);
  });

  it('FuE-Gegenstand + Kern-Zielwert → Stand-der-Technik-Gruppe', () => {
    const g = baueRechercheAnfragen(
      steckbrief({
        fueGegenstand: [{ text: 'RFID-Objekterkennung', sektionIds: [] }],
        kernZielwert: { text: 'Erkennungsgenauigkeit über 95 %', sektionIds: [] },
      }),
      { antragsteller: null },
    );
    const s = g.find(x => x.id === 'sdt')!;
    expect(s.anfragen.map(a => a.text)).toContain('Stand der Technik RFID-Objekterkennung');
    expect(s.anfragen.some(a => a.text.endsWith('Benchmark'))).toBe(true);
  });

  it('kürzt lange Satz-Texte auf ≤ 10 Wörter (Kernbegriffe statt Sätze)', () => {
    const langer = 'ein sehr langer beschreibender Satz mit vielen Wörtern der als Suchanfrage viel zu lang wäre wirklich';
    const g = baueRechercheAnfragen(steckbrief({ fueGegenstand: [{ text: langer, sektionIds: [] }] }), { antragsteller: null });
    const sdt = g.find(x => x.id === 'sdt')!.anfragen[0]!.text;
    // "Stand der Technik" + max 10 Wörter des Gegenstands
    expect(sdt.replace('Stand der Technik ', '').split(' ')).toHaveLength(10);
  });

  it('dedupliziert doppelte Märkte (case-insensitiv)', () => {
    const g = baueRechercheAnfragen(
      steckbrief({ zielmaerkte: [{ markt: 'Displays', sektionIds: [] }, { markt: 'displays', sektionIds: [] }] }),
      { antragsteller: null },
    );
    expect(alleTexte(g).filter(t => t === 'Marktvolumen Displays')).toHaveLength(1);
  });

  it('ist deterministisch (gleiche Eingabe → gleiche Anfragen)', () => {
    const sb = steckbrief({ zielmaerkte: [{ markt: 'A', sektionIds: [] }], fueGegenstand: [{ text: 'X', sektionIds: [] }] });
    expect(baueRechercheAnfragen(sb, { antragsteller: 'Y' })).toEqual(baueRechercheAnfragen(sb, { antragsteller: 'Y' }));
  });
});
