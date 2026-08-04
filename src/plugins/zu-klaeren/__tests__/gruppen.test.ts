/**
 * Was diese Datei festnagelt:
 *
 * 1. Die Gruppenüberschrift trägt Anzahl Codes und Summe der Vorkommen — und zwar
 *    für die SICHTBAREN Zeilen, sonst wäre die Zahl eine falsche Zusage.
 * 2. Der Filter behält die Gruppenstruktur; eine Zeile wandert nie in eine andere
 *    Gruppe.
 * 3. Die Marker-Gruppe steht am Ende und ist als solche erkennbar.
 * 4. Der Zähler zählt nur eigene, nicht zurückgezogene Antworten.
 */
import { describe, it, expect } from 'vitest';
import { baueZeilen, baueGruppen, beantwortetVon } from '@/plugins/zu-klaeren/gruppen';
import { falte } from '@/plugins/zu-klaeren/fold';
import { bauePunkte } from '@/plugins/zu-klaeren/seed-phasenschnitt';
import { OHNE_PHASE, type KlaerungEintrag } from '@/plugins/zu-klaeren/typen';

const PUNKTE = bauePunkte();
const LEER = falte([]);
const e = (x: Partial<KlaerungEintrag> & { autor: string; punktId: string }): KlaerungEintrag =>
  ({ ts: '2026-08-04T10:00:00.000Z', ...x });

describe('baueGruppen (Gruppen statt einer Phasen-Spalte)', () => {
  it('bildet die sechs Phasen plus die Marker-Gruppe, Marker zuletzt', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null));
    expect(g).toHaveLength(7);
    expect(g[g.length - 1]?.id).toBe(OHNE_PHASE);
    expect(g[g.length - 1]?.istMarker).toBe(true);
    expect(g.slice(0, 6).every(x => !x.istMarker)).toBe(true);
  });

  it('die Gruppenköpfe tragen zusammen alle 30 Codes', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null));
    expect(g.reduce((s, x) => s + x.codeAnzahl, 0)).toBe(30);
  });

  it('die Summe der Vorkommen ist die Summe ihrer sichtbaren Zeilen', () => {
    const vorkommen = new Map(PUNKTE.filter(p => p.code !== undefined).map(p => [p.code!, 10]));
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, vorkommen));
    for (const gruppe of g) expect(gruppe.vorkommenSumme).toBe(gruppe.codeAnzahl * 10);
  });

  it('ohne geladene Zahlen steht null, nicht 0', () => {
    const g = baueGruppen(baueZeilen(PUNKTE, LEER, [], undefined, null));
    expect(g.every(x => x.vorkommenSumme === null)).toBe(true);
  });

  it('der Filter „nur strittige" behält die Gruppenstruktur', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
    ]);
    const zeilen = baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], undefined, null);
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
    const g = baueGruppen(baueZeilen(PUNKTE, stand, ['MUE'], undefined, null), 'unklar');
    expect(g.flatMap(x => x.zeilen).map(z => z.punkt.id)).toEqual(['code-11']);
  });

  it('die Zeile trägt das eigene Urteil und die Kommentar-Anzahl', () => {
    const stand = falte([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'begleitung' }),
      e({ autor: 'SCH', punktId: 'code-38', kommentar: 'dazu was' }),
    ]);
    const zeile = baueZeilen(PUNKTE, stand, ['MUE', 'SCH'], 'mue', null)
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

  it('„gehört nach …" ohne gewählte Zielphase zählt noch nicht', () => {
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
    const stand = falte([e({ autor: 'MUE', punktId: 'frage-3', kommentar: 'meine Sicht' })]);
    expect(beantwortetVon(PUNKTE, stand, 'MUE')).toBe(1);
  });

  it('ohne Kürzel ist der Zähler 0, nicht die Gesamtzahl', () => {
    const stand = falte([e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' })]);
    expect(beantwortetVon(PUNKTE, stand, undefined)).toBe(0);
  });
});
