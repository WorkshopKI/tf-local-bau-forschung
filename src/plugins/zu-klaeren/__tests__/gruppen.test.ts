/**
 * Was diese Datei festnagelt:
 *
 * 1. Die Gruppenüberschrift trägt Anzahl Codes und Summe der Vorkommen — und zwar
 *    für die SICHTBAREN Zeilen, sonst wäre die Zahl eine falsche Zusage.
 * 2. Der Filter behält die Gruppenstruktur; eine Zeile wandert nie in eine andere
 *    Gruppe.
 * 3. Die Marker-Gruppe steht am Ende und ist als solche erkennbar.
 * 4. Der Zähler zählt nur eigene, nicht zurückgezogene Antworten.
 * 5. Die Spalte „Stand" erscheint genau dann, wenn eine Zeile etwas zu melden hat —
 *    dieselbe Funktion entscheidet über Anzeige UND Sichtbarkeit der Spalte.
 * 6. Die drei Ist-Stand-Vermerke sind DISJUNKT, und ohne geladene Fassung schweigt
 *    die Spalte, statt „steht auf Auslieferungsstand" zu behaupten.
 */
import { describe, it, expect } from 'vitest';
import {
  baueZeilen, baueGruppen, beantwortetVon, standMarke, zeigtStand, zeigtIstStand,
  type IstStandKontext,
} from '@/plugins/zu-klaeren/gruppen';
import { falte } from '@/plugins/zu-klaeren/fold';
import { bauePunkte } from '@/plugins/zu-klaeren/seed-phasenschnitt';
import { OHNE_PHASE, type KlaerungEintrag, type ZielWert } from '@/plugins/zu-klaeren/typen';

const PUNKTE = bauePunkte();
const LEER = falte([]);
const e = (x: Partial<KlaerungEintrag> & { autor: string; punktId: string }): KlaerungEintrag =>
  ({ ts: '2026-08-04T10:00:00.000Z', ...x });

describe('baueGruppen (Gruppen statt einer Phasen-Spalte)', () => {
  it('bildet die sechs Phasen plus die Marker-Gruppe, Marker zuletzt', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null, null));
    expect(g).toHaveLength(7);
    expect(g[g.length - 1]?.id).toBe(OHNE_PHASE);
    expect(g[g.length - 1]?.istMarker).toBe(true);
    expect(g.slice(0, 6).every(x => !x.istMarker)).toBe(true);
  });

  it('die Gruppenköpfe tragen zusammen alle 30 Codes', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null, null));
    expect(g.reduce((s, x) => s + x.codeAnzahl, 0)).toBe(30);
  });

  it('die Summe der Vorkommen ist die Summe ihrer sichtbaren Zeilen', () => {
    const vorkommen = new Map(PUNKTE.filter(p => p.code !== undefined).map(p => [p.code!, 10]));
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, vorkommen, null));
    for (const gruppe of g) expect(gruppe.vorkommenSumme).toBe(gruppe.codeAnzahl * 10);
  });

  it('ohne geladene Zahlen steht null, nicht 0', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null, null));
    expect(g.every(x => x.vorkommenSumme === null)).toBe(true);
  });

  it('der Filter „nur strittige" behält die Gruppenstruktur', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
    ]);
    const zeilen = baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], undefined, null, null);
    const g = baueGruppen(zeilen, 'strittig');
    expect(g).toHaveLength(1);
    expect(g[0]?.id).toBe('pruefung');           // 38 liegt im Auslieferungsschnitt dort
    expect(g[0]?.zeilen.map(z => z.punkt.id)).toEqual(['code-38']);
    expect(g[0]?.codeAnzahl).toBe(1);            // die sichtbare Zahl, nicht 3
  });

  it('der Filter „unklar" zeigt Rückfragen, nicht Konflikte', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'unklar' }),
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
    ]);
    const g = baueGruppen(baueZeilen(PUNKTE, stand, ['MUE'], undefined, null, null), 'unklar');
    expect(g.flatMap(x => x.zeilen).map(z => z.punkt.id)).toEqual(['code-11']);
  });

  it('die Zeile trägt das eigene Urteil und die Kommentar-Anzahl', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'begleitung' }),
      e({ autor: 'SCH', punktId: 'code-38', kommentar: 'dazu was' }),
    ]);
    const zeile = baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], 'mue', null, null)
      .find(z => z.punkt.id === 'code-38');
    expect(zeile?.meinUrteil).toMatchObject({ urteil: 'andere', zielWert: 'begleitung' });
    expect(zeile?.kommentarAnzahl).toBe(1);
  });
});

describe('beantwortetVon (der Zähler im Seitenkopf)', () => {
  it('zählt nur eigene Antworten', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-31', urteil: 'passt' }),
    ]);
    expect(beantwortetVon(PUNKTE, stand, 'MUE')).toBe(1);
  });

  it('ein zurückgezogenes Urteil zählt nicht mehr', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'zurueckgezogen' }),
    ]);
    expect(beantwortetVon(PUNKTE, stand, 'MUE')).toBe(0);
  });

  it('„andere" ohne gewählte Zielphase zählt noch nicht', () => {
    // Sonst behauptete der Zähler „erledigt", während die Auswertung aus dem
    // Eintrag nichts liest — jemand hielte sich für durch und wäre es nicht.
    const offen = falte([e({ autor: 'MUE', punktId: 'code-11', urteil: 'andere' })]);
    expect(beantwortetVon(PUNKTE, offen, 'MUE')).toBe(0);

    const fertig = falte([
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'andere', zielWert: 'pruefung' }),
    ]);
    expect(beantwortetVon(PUNKTE, fertig, 'MUE')).toBe(1);
  });

  it('bei einer Grundsatzfrage zählt der eigene Kommentar als Antwort', () => {
    const stand = falte([e({ autor: 'MUE', punktId: 'frage-59-begleitung', kommentar: 'meine Sicht' })]);
    expect(beantwortetVon(PUNKTE, stand, 'MUE')).toBe(1);
  });

  it('… auch dann, wenn er noch unter der alten Punkt-Id in der Datei steht', () => {
    // `frage-3` ist die Id, unter der diese Frage bis v2.412 geschrieben wurde.
    const stand = falte([e({ autor: 'MUE', punktId: 'frage-3', kommentar: 'aus der alten Datei' })]);
    expect(beantwortetVon(PUNKTE, stand, 'MUE')).toBe(1);
  });

  it('ohne Kürzel ist der Zähler 0, nicht die Gesamtzahl', () => {
    const stand = falte([e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' })]);
    expect(beantwortetVon(PUNKTE, stand, undefined)).toBe(0);
  });
});

describe('standMarke / zeigtStand (die Spalte „Stand")', () => {
  const zeileZu = (stand: ReturnType<typeof falte>, autoren: string[], id: string) =>
    baueZeilen(PUNKTE, stand, autoren, undefined, null, null).find(z => z.punkt.id === id)!;

  it('ohne Antworten meldet keine Zeile etwas — die Spalte bleibt weg', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null, null));
    expect(g.flatMap(x => x.zeilen).every(z => standMarke(z) === null)).toBe(true);
    expect(zeigtStand(g)).toBe(false);
  });

  it('Einigkeit auf die ausgelieferte Phase ist keine Meldung — und keine leere Spalte', () => {
    // Der Maßstab ist die Marke, nicht „irgendwer hat geklickt": stimmen alle zu,
    // stünde die Spalte 30-mal leer und nähme der Bezeichnung die Breite.
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'passt' }),
    ]);
    expect(standMarke(zeileZu(stand, ['MUE', 'SCH'], 'code-38'))).toBeNull();
    expect(zeigtStand(baueGruppen(baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], undefined, null, null))))
      .toBe(false);
  });

  it('zwei verschiedene Zielphasen ergeben „strittig" — und zwar laut', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
    ]);
    expect(standMarke(zeileZu(stand, ['MUE', 'SCH'], 'code-38')))
      .toMatchObject({ text: 'strittig', leise: false });
    expect(zeigtStand(baueGruppen(baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], undefined, null, null))))
      .toBe(true);
  });

  it('`unklar` meldet eine Rückfrage samt Kürzel — leise, denn es ist keine Gegenstimme', () => {
    const stand = falte([e({ autor: 'MUE', punktId: 'code-11', urteil: 'unklar' })]);
    const marke = standMarke(zeileZu(stand, ['MUE'], 'code-11'));
    expect(marke).toMatchObject({ text: 'Rückfrage', leise: true });
    expect(marke?.title).toContain('MUE');
  });

  it('Einigkeit auf eine ANDERE Phase zeigt das Ziel an', () => {
    const stand = falte([e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' })]);
    expect(standMarke(zeileZu(stand, ['MUE'], 'code-38'))?.text).toMatch(/^→ /);
  });

  it('ein zurückgezogenes Urteil nimmt die Marke wieder weg', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'zurueckgezogen' }),
    ]);
    expect(standMarke(zeileZu(stand, ['MUE'], 'code-38'))).toBeNull();
  });
});

describe('Ist-Stand (was der Katalog heute führt)', () => {
  /** Code 38 liegt in der Auslieferung in „Prüfung". */
  const CODE = 38;

  /** Ein Katalog-Kontext, der genau diesen einen Code umhängt. */
  const katalog = (nachher?: ZielWert): IstStandKontext => ({
    abweichend: nachher === undefined ? new Map() : new Map([[CODE, nachher]]),
    fassungPhasen: undefined,
  });

  const zeile = (
    stand: ReturnType<typeof falte>, autoren: string[], ctx: IstStandKontext | null,
  ) => baueZeilen(PUNKTE, stand, autoren, undefined, null, ctx)
    .find(z => z.punkt.code === CODE)!;

  const einigAuf = (ziel: ZielWert) => falte([
    e({ autor: 'MUE', punktId: `code-${CODE}`, urteil: 'andere', zielWert: ziel }),
    e({ autor: 'SCH', punktId: `code-${CODE}`, urteil: 'andere', zielWert: ziel }),
  ]);

  it('ohne geladene Fassung schweigt die Spalte ganz', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, einigAuf('begleitung'), ['MUE', 'SCH'], undefined, null, null));
    expect(g.flatMap(x => x.zeilen).every(z => z.istStand === null)).toBe(true);
    expect(zeigtIstStand(g), 'lieber keine Spalte als eine falsche Behauptung').toBe(false);
  });

  it('Konsens und Fassung stimmen überein ⇒ umgesetzt', () => {
    const z = zeile(einigAuf('begleitung'), ['MUE', 'SCH'], katalog('begleitung'));
    expect(z.istStand).toMatchObject({ vermerk: 'umgesetzt', text: 'umgesetzt', leise: true });
    expect(z.istStand?.phase).toBe('Begleitung');
  });

  it('Konsens abweichend, Fassung auf Auslieferungsstand ⇒ noch offen', () => {
    // Der Fall Code 29 vom 05.08.: der Beschluss steht da, vollzogen ist er nicht.
    const z = zeile(einigAuf('begleitung'), ['MUE', 'SCH'], katalog());
    expect(z.istStand).toMatchObject({ vermerk: 'offen', text: 'noch offen' });
    expect(z.istStand?.phase, 'die Spalte zeigt, was der Katalog HEUTE führt').toBe('Prüfung');
  });

  it('Fassung geändert, Konsens sagt etwas anderes ⇒ abweichend beschlossen', () => {
    const z = zeile(einigAuf('begleitung'), ['MUE', 'SCH'], katalog('abgeschlossen'));
    expect(z.istStand).toMatchObject({ vermerk: 'abweichend', leise: false });
    expect(z.istStand?.title).toContain('Begleitung');
  });

  it('Fassung geändert, gar kein Konsens ⇒ ebenfalls abweichend beschlossen', () => {
    const z = zeile(LEER, [], katalog('abgeschlossen'));
    expect(z.istStand).toMatchObject({ vermerk: 'abweichend' });
    expect(z.istStand?.title).toContain('einen Konsens dazu gibt es nicht');
  });

  it('kein Konsens und nichts geändert ⇒ nichts zu vermerken', () => {
    expect(zeile(LEER, [], katalog()).istStand).toBeNull();
  });

  it('ein STRITTIGER Punkt ist kein Konsens — die Fassung entscheidet den Vermerk', () => {
    const strittig = falte([
      e({ autor: 'MUE', punktId: `code-${CODE}`, urteil: 'andere', zielWert: 'begleitung' }),
      e({ autor: 'SCH', punktId: `code-${CODE}`, urteil: 'andere', zielWert: 'eingang' }),
    ]);
    expect(zeile(strittig, ['MUE', 'SCH'], katalog()).istStand, 'nichts geändert ⇒ nichts zu sagen')
      .toBeNull();
    expect(zeile(strittig, ['MUE', 'SCH'], katalog('eingang')).istStand)
      .toMatchObject({ vermerk: 'abweichend' });
  });

  it('der Filter „nicht umgesetzt" fasst beide offenen Lagen zusammen', () => {
    const stand = falte([
      // 38: beschlossen, nicht vollzogen ⇒ offen
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'begleitung' }),
      // 11: bestätigt und unverändert ⇒ umgesetzt, also NICHT im Filter
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
    ]);
    const ctx: IstStandKontext = {
      // 59 trägt eine Änderung ohne jeden Konsens ⇒ abweichend
      abweichend: new Map<number, ZielWert>([[59, 'abgeschlossen']]),
      fassungPhasen: undefined,
    };
    const g = baueGruppen(baueZeilen(PUNKTE, stand, ['MUE'], undefined, null, ctx), 'nichtUmgesetzt');
    expect(g.flatMap(x => x.zeilen).map(z => z.punkt.code).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual([38, 59]);
    expect(g.every(x => x.codeAnzahl === x.zeilen.length), 'die Gruppenzahl zählt die sichtbaren')
      .toBe(true);
  });
});
