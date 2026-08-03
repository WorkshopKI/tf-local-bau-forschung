/**
 * Die Abbildung Baum ↔ Filter-Store ist die Stelle, an der man sich vertut —
 * nicht das Rendern. Deshalb sind hier die drei Zusagen festgenagelt:
 *
 *  - **Ein Blatt = ein Code, nicht eine Schreibweise.** Ein Häkchen setzt alle
 *    Schreibweisen; ein gespeicherter Filter mit nur einer davon zählt als
 *    gesetzt und darf nach einem Update nicht wie „aus" aussehen.
 *  - **Fremde Filterwerte überleben.** Ein Preset kann Status führen, die im
 *    aktuellen Bestand nicht vorkommen und in keinem Blatt stehen. Ohne diese
 *    Regel wischte ein beliebiger Klick im Baum sie still weg.
 *  - **Tri-State ist abgeleitet**, nicht gespeichert: `checkedItems` führt nur
 *    Blätter, der Ordner-Zustand entsteht daraus.
 */
import { describe, it, expect } from 'vitest';
import {
  STATUS_BAUM_ROOT, baueStatusBaum, checkedAusFilter, filterAusChecked,
  filtereStatusPhasen, istGesetzt, phaseKnotenId, statusHoverDaten, statusKnotenId,
} from '../statusTreeAdapter';
import { groupStatusValues, type GroupedPhase } from '../statusGroups';

/** Zwei Phasen mit je zwei Blättern; „NF gestellt" führt eine zweite Schreibweise. */
const PHASEN: GroupedPhase[] = [
  {
    id: 'eingang', label: 'Eingang', items: [
      { value: 'Skizze eingegangen', count: 3, designed: true, schreibweisen: ['Skizze eingegangen'] },
      { value: 'beantragt', count: 7, designed: true, schreibweisen: ['beantragt'] },
    ],
  },
  {
    id: 'vollstaendigkeit', label: 'Vollständigkeit', items: [
      {
        value: 'NF gestellt', count: 5, designed: true,
        schreibweisen: ['NF gestellt', 'Nachforderung gestellt'],
      },
      { value: 'unvollständig', count: 1, designed: true, schreibweisen: ['unvollständig'] },
    ],
  },
];

const LEER: GroupedPhase = { id: 'sonstige', label: 'Nicht im Katalog', items: [] };

describe('baueStatusBaum', () => {
  it('hängt Phasen unter die Wurzel und Stati unter ihre Phase', () => {
    const { items, rootId } = baueStatusBaum(PHASEN);
    expect(rootId).toBe(STATUS_BAUM_ROOT);
    expect(items[STATUS_BAUM_ROOT]?.children)
      .toEqual([phaseKnotenId('eingang'), phaseKnotenId('vollstaendigkeit')]);
    expect(items[phaseKnotenId('vollstaendigkeit')]?.children)
      .toEqual([statusKnotenId('NF gestellt'), statusKnotenId('unvollständig')]);
  });

  it('markiert Phasen als Ordner und Stati als Blätter', () => {
    const { items } = baueStatusBaum(PHASEN);
    expect(items[phaseKnotenId('eingang')]?.isFolder).toBe(true);
    expect(items[statusKnotenId('beantragt')]?.isFolder).toBe(false);
  });

  it('lässt leere Phasen weg — ein Ordner, der aufgeklappt leer ist, hilft niemandem', () => {
    const { items } = baueStatusBaum([...PHASEN, LEER]);
    expect(items[STATUS_BAUM_ROOT]?.children).not.toContain(phaseKnotenId('sonstige'));
  });

  it('trägt den echten Bestand ohne doppelte Ids', () => {
    const echte = groupStatusValues(new Map([['beantragt', 4], ['Freitext-Status XY', 2]]));
    const { items } = baueStatusBaum(echte);
    const ids = Object.values(items).flatMap(i => [...(i.children ?? [])]);
    expect(new Set(ids).size).toBe(ids.length);
    // Der Katalog-Fremde landet unter „Nicht im Katalog", nicht unter einer Phase.
    expect(items[phaseKnotenId('sonstige')]?.children).toContain(statusKnotenId('Freitext-Status XY'));
  });
});

describe('checkedAusFilter — gesetzt heißt: IRGENDEINE Schreibweise steht im Filter', () => {
  it('erkennt den Eintrag auch über eine Nebenschreibweise', () => {
    expect(checkedAusFilter(PHASEN, ['Nachforderung gestellt']))
      .toEqual([statusKnotenId('NF gestellt')]);
  });

  it('liefert nichts bei leerem Filter', () => {
    expect(checkedAusFilter(PHASEN, [])).toEqual([]);
  });

  it('ignoriert Werte, die zu keinem Blatt gehören', () => {
    expect(checkedAusFilter(PHASEN, ['gibt-es-nicht'])).toEqual([]);
  });
});

describe('filterAusChecked', () => {
  it('setzt ALLE Schreibweisen eines gehakten Blattes', () => {
    const raus = filterAusChecked(PHASEN, [statusKnotenId('NF gestellt')], []);
    expect(new Set(raus)).toEqual(new Set(['NF gestellt', 'Nachforderung gestellt']));
  });

  it('entfernt alle Schreibweisen, wenn das Blatt abgehakt wird', () => {
    expect(filterAusChecked(PHASEN, [], ['NF gestellt', 'Nachforderung gestellt'])).toEqual([]);
  });

  it('lässt Werte außerhalb des Baums unangetastet (gespeichertes Preset)', () => {
    const raus = filterAusChecked(PHASEN, [statusKnotenId('beantragt')], ['Alt-Status aus Preset']);
    expect(raus).toContain('Alt-Status aus Preset');
    expect(raus).toContain('beantragt');
  });

  it('ist roundtrip-stabil: checked → filter → checked liefert dasselbe', () => {
    const start = ['Nachforderung gestellt', 'beantragt', 'Alt-Status aus Preset'];
    const checked = checkedAusFilter(PHASEN, start);
    const filter = filterAusChecked(PHASEN, checked, start);
    expect(checkedAusFilter(PHASEN, filter)).toEqual(checked);
    expect(filter).toContain('Alt-Status aus Preset');
  });

  it('erzeugt keine Duplikate, wenn ein Wert schon im Filter stand', () => {
    const raus = filterAusChecked(PHASEN, [statusKnotenId('NF gestellt')], ['NF gestellt']);
    expect(raus).toHaveLength(new Set(raus).size);
    expect(raus.filter(v => v === 'NF gestellt')).toHaveLength(1);
  });
});

describe('Tri-State der Phase leitet sich aus ihren Blättern ab', () => {
  const phase = PHASEN[1]!;
  const zustand = (selected: string[]): 'checked' | 'indeterminate' | 'unchecked' => {
    const gesetzt = new Set(selected);
    const an = phase.items.filter(it => istGesetzt(it, gesetzt)).length;
    return an === 0 ? 'unchecked' : an === phase.items.length ? 'checked' : 'indeterminate';
  };

  it('keine Blätter gesetzt ⇒ unchecked', () => {
    expect(zustand([])).toBe('unchecked');
  });

  it('ein Blatt gesetzt ⇒ indeterminate', () => {
    expect(zustand(['unvollständig'])).toBe('indeterminate');
  });

  it('alle Blätter gesetzt ⇒ checked — auch über eine Nebenschreibweise', () => {
    expect(zustand(['Nachforderung gestellt', 'unvollständig'])).toBe('checked');
  });
});

describe('statusHoverDaten — was der Tooltip behauptet', () => {
  it('nennt Gruppe, Anzahl und die weiteren Schreibweisen', () => {
    const d = statusHoverDaten(PHASEN[1]!.items[0]!, 'Vollständigkeit');
    expect(d).toEqual({
      gruppe: 'Vollständigkeit',
      anzahl: 5,
      herkunft: 'kuratiert',
      weitereSchreibweisen: ['Nachforderung gestellt'],
    });
  });

  it('lässt die Schreibweisen-Liste leer, wenn es nur eine gibt', () => {
    expect(statusHoverDaten(PHASEN[0]!.items[1]!, 'Eingang').weitereSchreibweisen).toEqual([]);
  });

  it('markiert Katalog-Fremde als „nicht im Katalog" — das ist der Kuratier-Hinweis', () => {
    const fremd = { value: 'Freitext XY', count: 2, designed: false, schreibweisen: ['Freitext XY'] };
    expect(statusHoverDaten(fremd, 'Nicht im Katalog').herkunft).toBe('nicht im Katalog');
  });
});

describe('filtereStatusPhasen', () => {
  it('gibt bei leerer Suche die identische Referenz zurück', () => {
    expect(filtereStatusPhasen(PHASEN, '   ')).toBe(PHASEN);
  });

  it('findet über eine Nebenschreibweise und wirft leere Phasen weg', () => {
    const treffer = filtereStatusPhasen(PHASEN, 'nachforderung');
    expect(treffer.map(p => p.id)).toEqual(['vollstaendigkeit']);
    expect(treffer[0]?.items.map(it => it.value)).toEqual(['NF gestellt']);
  });

  it('sucht ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(filtereStatusPhasen(PHASEN, 'SKIZZE')[0]?.items[0]?.value).toBe('Skizze eingegangen');
  });

  it('liefert nichts, wenn der Query auf keinen Status passt', () => {
    expect(filtereStatusPhasen(PHASEN, 'zzz')).toEqual([]);
  });
});
