import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  PROJEKTART_LABELS, PROJEKTART_ORDER, applyProjektart, asProjektart, getProjektartItems,
  matchesProjektart, projektartVonLabel, type Projektart,
} from '../filter/projektartQuickfilter';

/** vb_phase: 3 = FuE, 5 = DS, 4 = DL, 1/2 = NW (siehe `vb-phase-mappings`). */
function antrag(akz: string, vbPhase: number, verbundId = ''): AntragListItem {
  return { aktenzeichen: akz, vb_phase: vbPhase, verbund_id: verbundId } as unknown as AntragListItem;
}

/** TV-Zahlen je Verbund; alles Unbekannte zaehlt als 1 (kein Verbund = ein TV). */
const tvCountOf = (tv: Record<string, number>) => (a: AntragListItem): number =>
  tv[(a.verbund_id as string) ?? ''] ?? 1;

describe('matchesProjektart — die fachliche Definition', () => {
  const einTv = () => 1;

  it('FuE mit genau 1 TV ist ein Einzelprojekt', () => {
    expect(matchesProjektart(antrag('16EP123456', 3), 'einzel', 1)).toBe(true);
  });

  it('DS mit genau 1 TV ist ein Einzelprojekt', () => {
    expect(matchesProjektart(antrag('16DS123456', 5), 'einzel', 1)).toBe(true);
  });

  it('FuE mit 2 TV ist ein Kooperationsprojekt, kein Einzelprojekt', () => {
    const a = antrag('16KN106227', 3, 'V1');
    expect(matchesProjektart(a, 'einzel', 2)).toBe(false);
    expect(matchesProjektart(a, 'kooperation', 2)).toBe(true);
  });

  it('DL und NW fallen in KEINE der beiden Stufen', () => {
    // Die gewaehlte Spiegelbild-Definition: Projektart gilt nur fuer FuE/DS.
    // Bricht dieser Test, ist die fachliche Abgrenzung verschoben worden.
    for (const [akz, phase] of [['16DL260001', 4], ['16KN106201', 1]] as const) {
      const a = antrag(akz, phase);
      expect(matchesProjektart(a, 'einzel', 1)).toBe(false);
      expect(matchesProjektart(a, 'kooperation', 5)).toBe(false);
    }
  });

  it('Netzwerkbezug unterscheidet 16KN von 16EP', () => {
    expect(matchesProjektart(antrag('16KN106227', 3), 'einzel_mit_nb', 1)).toBe(true);
    expect(matchesProjektart(antrag('16KN106227', 3), 'einzel_ohne_nb', 1)).toBe(false);
    expect(matchesProjektart(antrag('16EP123456', 3), 'einzel_ohne_nb', 1)).toBe(true);
    expect(matchesProjektart(antrag('16EP123456', 3), 'einzel_mit_nb', 1)).toBe(false);
  });

  it('ein DS-Einzelprojekt (16DS…) traegt WEDER mit NOCH ohne Netzwerkbezug', () => {
    // Bewusst so: „ohne Netzwerkbezug" heisst 16EP, nicht „alles ausser 16KN".
    const a = antrag('16DS123456', 5);
    expect(matchesProjektart(a, 'einzel', 1)).toBe(true);
    expect(matchesProjektart(a, 'einzel_mit_nb', 1)).toBe(false);
    expect(matchesProjektart(a, 'einzel_ohne_nb', 1)).toBe(false);
  });

  it('Antrag ohne Verbund-Zuordnung gilt als Einzelprojekt', () => {
    expect(matchesProjektart(antrag('16EP123456', 3, ''), 'einzel', einTv())).toBe(true);
  });

  it('„Alle" matcht ausnahmslos', () => {
    expect(matchesProjektart(antrag('16DL260001', 4), 'alle', 9)).toBe(true);
  });
});

describe('applyProjektart', () => {
  const LISTE = [
    antrag('16EP000001', 3, ''),        // FuE, solo        → einzel, ohne NB
    antrag('16KN106227', 3, 'V2'),      // FuE, 2 TV        → kooperation
    antrag('16KN106228', 3, 'V2'),      // FuE, 2 TV        → kooperation
    antrag('16KN200501', 3, 'V1'),      // FuE, 1 TV        → einzel, mit NB
    antrag('16DS000001', 5, ''),        // DS, solo         → einzel, ohne Stufe
    antrag('16DL260001', 4, ''),        // DL               → keine Stufe
  ];
  const tv = tvCountOf({ V1: 1, V2: 2 });

  it('„Alle" gibt die Liste unveraendert zurueck', () => {
    expect(applyProjektart(LISTE, 'alle', tv)).toBe(LISTE);
  });

  it('Einzelprojekt: FuE/DS mit einem TV', () => {
    expect(applyProjektart(LISTE, 'einzel', tv).map(a => a.aktenzeichen))
      .toEqual(['16EP000001', '16KN200501', '16DS000001']);
  });

  it('Kooperationsprojekt: FuE/DS mit mehreren TV', () => {
    expect(applyProjektart(LISTE, 'kooperation', tv).map(a => a.aktenzeichen))
      .toEqual(['16KN106227', '16KN106228']);
  });

  it('Netzwerkbezug greift nur innerhalb der Einzelprojekte', () => {
    // 16KN106227 traegt zwar 16KN, ist aber ein Kooperationsprojekt.
    expect(applyProjektart(LISTE, 'einzel_mit_nb', tv).map(a => a.aktenzeichen))
      .toEqual(['16KN200501']);
    expect(applyProjektart(LISTE, 'einzel_ohne_nb', tv).map(a => a.aktenzeichen))
      .toEqual(['16EP000001']);
  });
});

describe('getProjektartItems — Zaehler und Filter sind EIN Vokabular', () => {
  const LISTE = [
    antrag('16EP000001', 3, ''),
    antrag('16KN106227', 3, 'V2'),
    antrag('16KN106228', 3, 'V2'),
    antrag('16KN200501', 3, 'V1'),
    antrag('16DS000001', 5, ''),
    antrag('16DL260001', 4, ''),
  ];
  const tv = tvCountOf({ V1: 1, V2: 2 });

  it('jede Stufe zaehlt genau das, was sie auch filtert', () => {
    const items = getProjektartItems(LISTE, tv);
    for (const art of PROJEKTART_ORDER) {
      const item = items.find(i => i.label === PROJEKTART_LABELS[art]);
      expect(item, `Stufe ${art} fehlt in den Items`).toBeDefined();
      expect(item!.count, `Zaehler ${art}`).toBe(applyProjektart(LISTE, art, tv).length);
    }
  });

  it('die Netzwerkbezug-Stufen summieren sich NICHT auf „Einzelprojekt"', () => {
    // Dokumentierte Luecke, kein Defekt: das DS-Einzelprojekt traegt 16DS und
    // gehoert in keine der beiden Unterstufen. Wer das „repariert", weitet
    // „ohne Netzwerkbezug" still zu „alles ausser 16KN" auf.
    const items = getProjektartItems(LISTE, tv);
    const zahl = (art: Projektart): number =>
      items.find(i => i.label === PROJEKTART_LABELS[art])!.count!;
    expect(zahl('einzel_mit_nb') + zahl('einzel_ohne_nb')).toBeLessThan(zahl('einzel'));
  });

  it('„Alle" zaehlt die ganze Grundmenge', () => {
    expect(getProjektartItems(LISTE, tv)[0]!.count).toBe(LISTE.length);
  });

  it('jede Stufe traegt einen erklaerenden Tooltip', () => {
    expect(getProjektartItems(LISTE, tv).every(i => typeof i.title === 'string' && i.title.length > 0))
      .toBe(true);
  });
});

describe('Label ↔ Stufe', () => {
  it('laeuft rund ueber alle Stufen', () => {
    for (const art of PROJEKTART_ORDER) {
      expect(projektartVonLabel(PROJEKTART_LABELS[art])).toBe(art);
    }
  });

  it('faellt bei Unbekanntem auf „alle" zurueck', () => {
    expect(projektartVonLabel('Quatsch')).toBe('alle');
    expect(asProjektart('Quatsch')).toBe('alle');
    expect(asProjektart(null)).toBe('alle');
    expect(asProjektart('kooperation')).toBe('kooperation');
  });
});
