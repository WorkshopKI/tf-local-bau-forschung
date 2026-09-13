/**
 * Die Zusage der Fristen-Karte (v6.67): **eine Zeile je Verbund, zwei Gruppen,
 * nur laufende Fristen.**
 *
 * Geprüft wird, was die Zusammenlegung riskant macht — dass ein Vorgang in der
 * falschen Gruppe landet (über der Frist als „eingreifen"), dass angehaltene
 * Fristen die Liste wieder füllen, dass Karte und Kopfkarte verschiedene
 * Blocker nennen oder dass eine Gruppe in der Kappung verschwindet.
 */
import { describe, it, expect } from 'vitest';
import {
  baueFristenLage, bilanzText, drohtInTagen, meilensteinKurzlage, meilensteinText, naechsterText, ordneEin,
  sichtbareZeilen, stillstandGrund, zaehleOhneLaufendeFrist, type FristenZeile, type VerbundQuelle,
} from '../fristenLage';
import { kuerzelIndex, type WaechterErgebnis } from '@/core/status';
import type { StatusFeldEintrag } from '@/core/status/typen';
import type { MeilensteinKnoten, MstErgebnis, MstZustand, VerbundMeilensteine } from '@/core/meilensteine';

const STICHTAG = '2026-03-01T15:00:00.000Z';

function knoten(id: string, nummer: string, p: Partial<MeilensteinKnoten> = {}): MeilensteinKnoten {
  return {
    id, nummer, label: `Stufe ${nummer}`, elternId: null, sollWoche: 1, relevantFuerFrist: true,
    nurTypen: [], aktiv: true, sortierung: 10, bedingung: { feldId: 'a', op: 'gefuellt' }, ...p,
  };
}

function ergebnis(knotenId: string, zustand: MstZustand, sollDatum: string | null): MstErgebnis {
  return { knotenId, zustand, sollDatum, istDatum: null, abweichungTage: null };
}

function bewertung(ergebnisse: MstErgebnis[]): VerbundMeilensteine {
  return {
    verbundId: 'VB', antragsdatum: '2026-01-05', anker: '2026-01-05', typ: 'FuE', wocheAktuell: 8,
    fristDatum: '2026-04-05', restTage: 35, fristZustand: 'laeuft', ergebnisse, prognose: 'gefaehrdet',
  };
}

function waechter(p: Partial<WaechterErgebnis> = {}): WaechterErgebnis {
  return {
    urteil: 'haengt', letzteAktivitaet: '2026-01-20', belegt: true, anstehend: null,
    tage: 40, zieltage: 21, grund: 'liegt zu lange', rolle: 'ab', paar: null, ...p,
  };
}

const K = [knoten('k1', '1'), knoten('k2', '2'), knoten('k3', '3')];

function quelle(p: Partial<VerbundQuelle> = {}): VerbundQuelle {
  return {
    verbundId: 'VB', akronym: 'ALPHA', fristZustand: 'laeuft', fristTage: 20,
    erledigtLautKuerzeln: false, waechter: null, stillstandGrund: null, bewertung: null, ...p,
  };
}

describe('ordneEin — welche Gruppe', () => {
  it('keine Bewegung bei laufender, nicht überschrittener Frist: Jetzt eingreifen', () => {
    const z = ordneEin(quelle({ waechter: waechter() }), K, STICHTAG);
    expect(z?.gruppe).toBe('eingreifen');
    expect(z?.bewegung).toMatchObject({ liegeTage: 40, zieltage: 21, belegt: true });
  });

  it('heute fällig zählt noch als in der Frist', () => {
    expect(ordneEin(quelle({ fristTage: 0, waechter: waechter() }), K, STICHTAG)?.gruppe).toBe('eingreifen');
  });

  it('keine Bewegung ÜBER der Frist ist Rückstand — da ist nichts mehr zu verhindern', () => {
    const z = ordneEin(quelle({ fristTage: -3, waechter: waechter() }), K, STICHTAG);
    expect(z?.gruppe).toBe('rueckstand');
    expect(z?.bewegung, 'die Bewegung bleibt an der Zeile stehen').not.toBeNull();
  });

  it('ein gerissener Meilenstein in der Frist ist Rückstand', () => {
    const b = bewertung([ergebnis('k1', 'gerissen', '2026-01-12'), ergebnis('k2', 'offen', '2026-03-20')]);
    expect(ordneEin(quelle({ bewertung: b }), K, STICHTAG)?.gruppe).toBe('rueckstand');
  });

  it('in der Frist, ohne Stillstand und ohne Riss: keine Zeile', () => {
    const b = bewertung([ergebnis('k1', 'erreicht', '2026-01-12'), ergebnis('k2', 'offen', '2026-03-20')]);
    expect(ordneEin(quelle({ bewertung: b, waechter: waechter({ urteil: 'ok' }) }), K, STICHTAG)).toBeNull();
  });

  it('angehaltene und nicht berechenbare Fristen stehen in keiner Gruppe — auch mit Riss und Stillstand', () => {
    const b = bewertung([ergebnis('k1', 'gerissen', '2026-01-12')]);
    for (const fristZustand of ['angehalten', 'nicht_berechenbar'] as const) {
      expect(ordneEin(quelle({ fristZustand, fristTage: null, waechter: waechter(), bewertung: b }), K, STICHTAG))
        .toBeNull();
    }
    expect(zaehleOhneLaufendeFrist([
      quelle({ fristZustand: 'angehalten', fristTage: null }),
      quelle({ fristZustand: 'nicht_berechenbar', fristTage: null }),
      quelle({ fristZustand: 'angehalten', fristTage: null, erledigtLautKuerzeln: true }),
      quelle(),
    ])).toBe(2);
  });

  it('laut Kürzeln erledigt ist ein Befund, keine Frist-Zeile', () => {
    expect(ordneEin(quelle({ fristTage: -40, erledigtLautKuerzeln: true }), K, STICHTAG)).toBeNull();
  });
});

describe('meilensteinKurzlage — dieselbe Wahl wie die Kopfkarte', () => {
  it('der Blocker ist die früheste gerissene Stufe, gezählt werden die gerissenen Blätter', () => {
    const b = bewertung([
      ergebnis('k1', 'gerissen', '2026-01-19'),
      ergebnis('k2', 'gerissen', '2026-01-12'),
      ergebnis('k3', 'erreicht', '2026-01-26'),
    ]);
    const m = meilensteinKurzlage(b, K, STICHTAG);
    expect(m.gerissen).toBe(2);
    expect(m.relevant).toBe(3);
    expect(m.blocker?.knoten.id).toBe('k2');
    expect(meilensteinText(m)).toBe('2 gerissen · 2 Stufe 2');
  });

  it('der nächste Meilenstein ist das früheste offene Soll, in Tagen ab dem Stichtag-TAG', () => {
    const b = bewertung([
      ergebnis('k1', 'offen', '2026-03-20'),
      ergebnis('k2', 'faellig', '2026-03-02'),
      ergebnis('k3', 'erreicht', '2026-02-01'),
    ]);
    const m = meilensteinKurzlage(b, K, STICHTAG);
    // 15 Uhr am 01.03. gegen den 02.03.: ein Tag, nicht null — sonst hieße
    // „morgen" am Nachmittag „heute fällig".
    expect(m.naechster).toMatchObject({ tageBis: 1 });
    expect(m.naechster?.knoten.id).toBe('k2');
    expect(naechsterText(m)).toBe('nächster Meilenstein fällig in 1 T');
    expect(meilensteinText(m)).toBeNull();
  });
});

describe('baueFristenLage — Reihenfolge', () => {
  const offenIn = (tage: number): VerbundMeilensteine => {
    const soll = new Date(Date.parse('2026-03-01') + tage * 86_400_000).toISOString().slice(0, 10);
    return bewertung([ergebnis('k1', 'offen', soll)]);
  };

  it('Eingreifen vor Rückstand; eingreifen nach dem, was zuerst reißt, dann längerer Liegezeit', () => {
    const zeilen = baueFristenLage([
      quelle({ verbundId: 'R', akronym: 'R', fristTage: -5 }),
      quelle({ verbundId: 'E-spaet', akronym: 'E-spaet', fristTage: 46, waechter: waechter(), bewertung: offenIn(12) }),
      quelle({ verbundId: 'E-frueh', akronym: 'E-frueh', waechter: waechter({ tage: 25 }), bewertung: offenIn(3) }),
      quelle({ verbundId: 'E-gleich-lang', akronym: 'E-gleich-lang', waechter: waechter({ tage: 60 }), bewertung: offenIn(3) }),
      // Kein Meilenstein mehr offen, aber die Frist endet in zwei Tagen — das reißt zuerst.
      quelle({ verbundId: 'E-frist-knapp', akronym: 'E-frist-knapp', fristTage: 2, waechter: waechter() }),
    ], K, STICHTAG);
    expect(zeilen.map(z => z.verbundId)).toEqual(['E-frist-knapp', 'E-gleich-lang', 'E-frueh', 'E-spaet', 'R']);
  });

  it('drohtInTagen nimmt das Frühere von nächstem Meilenstein und Frist', () => {
    const [z] = baueFristenLage([quelle({ fristTage: 4, waechter: waechter(), bewertung: offenIn(9) })], K, STICHTAG);
    expect(drohtInTagen(z!)).toBe(4);
    expect(drohtInTagen({ fristTage: 30, meilensteine: z!.meilensteine })).toBe(9);
    expect(drohtInTagen({ fristTage: 7, meilensteine: null })).toBe(7);
  });

  it('Rückstand: am weitesten über der Frist zuerst, dann mehr Risse', () => {
    const riss = (n: number): VerbundMeilensteine =>
      bewertung(['k1', 'k2', 'k3'].slice(0, n).map(id => ergebnis(id, 'gerissen', '2026-01-12')));
    const zeilen = baueFristenLage([
      quelle({ verbundId: 'wenig-ueber', akronym: 'A', fristTage: -2, bewertung: riss(3) }),
      quelle({ verbundId: 'in-frist', akronym: 'B', fristTage: 10, bewertung: riss(3) }),
      quelle({ verbundId: 'weit-ueber', akronym: 'C', fristTage: -90, bewertung: riss(1) }),
      quelle({ verbundId: 'in-frist-mehr', akronym: 'D', fristTage: 10, bewertung: riss(2) }),
    ], K, STICHTAG);
    expect(zeilen.map(z => z.verbundId)).toEqual(['weit-ueber', 'wenig-ueber', 'in-frist', 'in-frist-mehr']);
  });
});

describe('sichtbareZeilen und Kopfzeile', () => {
  const zeile = (id: string, gruppe: FristenZeile['gruppe']): FristenZeile => ({
    verbundId: id, akronym: id, gruppe, fristTage: 1, meilensteine: null, bewegung: null,
  });

  it('beide Gruppen kommen vor, auch wenn eine die Liste füllt', () => {
    const zeilen = [
      ...Array.from({ length: 10 }, (_, i) => zeile(`e${i}`, 'eingreifen')),
      zeile('r1', 'rueckstand'), zeile('r2', 'rueckstand'), zeile('r3', 'rueckstand'),
    ];
    const sichtbar = sichtbareZeilen(zeilen, 8, 2);
    expect(sichtbar).toHaveLength(8);
    expect(sichtbar.filter(z => z.gruppe === 'rueckstand').map(z => z.verbundId)).toEqual(['r1', 'r2']);
  });

  it('nennt die Gruppen mit Zahl, leere fallen weg', () => {
    expect(bilanzText([zeile('a', 'eingreifen'), zeile('b', 'rueckstand'), zeile('c', 'rueckstand')]))
      .toBe('1 eingreifen · 2 Rückstand');
    expect(bilanzText([zeile('b', 'rueckstand')])).toBe('1 Rückstand');
    expect(bilanzText([])).toBe('');
  });
});

describe('stillstandGrund — die Felder werden nachgeschlagen, nie zusammengesetzt', () => {
  // feldIds bewusst NICHT `D_<Kürzel>`: sonst bestünde auch eine geratene Spalte
  // den Test. Die Umlaut-Kürzel stehen in NFD, so kommen sie aus der Zuarbeit.
  const KATALOG = kuerzelIndex([
    { feldId: 'D_AK4_KAT', label: 'Gutachten kfm.', typ: 'datum', ebene: 'tv', code: 'AK4' } as StatusFeldEintrag,
    { feldId: 'D_AT4_KAT', label: 'Gutachten techn.', typ: 'datum', ebene: 'tv', code: 'AT4' } as StatusFeldEintrag,
    { feldId: 'D_AEK_KAT', label: 'Änderung kfm.', typ: 'datum', ebene: 'tv', code: 'ÄK'.normalize('NFD') } as StatusFeldEintrag,
  ]);
  const paar = (gesetzt: string, fehlt: string): WaechterErgebnis =>
    waechter({ paar: { gesetzt, fehlt } as WaechterErgebnis['paar'] });

  it('ohne Kürzel-Paar ist der Status der Zeile die Quelle', () => {
    expect(stillstandGrund(waechter(), 'NF gestellt', KATALOG)).toEqual({ text: 'NF gestellt', quellFelder: ['STATUS_TV'] });
  });

  it('ein Paar nennt die Katalog-Felder beider Kürzel, gesetzt zuerst — auch über NFC/NFD hinweg', () => {
    expect(stillstandGrund(paar('AT4', 'AK4'), 'x', KATALOG))
      .toEqual({ text: 'AT4 gesetzt, AK4 fehlt', quellFelder: ['D_AT4_KAT', 'D_AK4_KAT'] });
    expect(stillstandGrund(paar('ÄK'.normalize('NFC'), 'AK4'), 'x', KATALOG).quellFelder)
      .toEqual(['D_AEK_KAT', 'D_AK4_KAT']);
  });

  it('kennt der Katalog ein Kürzel nicht, wird keine Spalte daraus zusammengesetzt', () => {
    expect(stillstandGrund(paar('AK4', 'ZZZ'), 'x', KATALOG).quellFelder).toEqual(['D_AK4_KAT']);
    expect(stillstandGrund(paar('YYY', 'ZZZ'), 'x', KATALOG).quellFelder).toBeUndefined();
  });
});
