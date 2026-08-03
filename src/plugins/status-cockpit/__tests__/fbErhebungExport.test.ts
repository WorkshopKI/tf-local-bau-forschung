/**
 * Das Erhebungsmaterial, wie es im Termin auf dem Tisch liegt.
 *
 * Geprüft wird das **Formen** der Blätter und der Kurzfassung, nicht der
 * Download: `XLSX.writeFile` und der Anker-Klick sind Browser-Sache und im Test
 * nichts wert. Was zählt, ist, dass jedes Blatt seinen Erhebungs-Kontext trägt
 * (Stichtag, Bereich, Grundmenge) — eine Zahl ohne den Kontext ist im Termin
 * nicht einzuordnen und erzeugt später den Streit, welche Liste denn nun gilt.
 */
import { describe, it, expect } from 'vitest';
import { baueBlaetter, baueMarkdown, type ErhebungsDaten, type ErhebungsKontext } from '../fbErhebungExport';
import { baueArbeitsmappe } from '../arbeitsmappe';

const KONTEXT: ErhebungsKontext = {
  stichtag: '2026-08-03T09:00:00.000Z',
  bereichText: '9 Richtlinien (76, 77, 78, 79, 131, 136, 137, 138, 139)',
  rolle: 'fb',
};

const DATEN: ErhebungsDaten = {
  platzhalter: {
    gesamt: 7269,
    gruppen: [
      {
        rolle: 'fb', quellRegelId: 'r2', beschreibung: 'R2 · PreCheck negativ (Verbund)',
        todo: 'Abl/RNE von FB abwarten', anzahl: 43,
        beispiele: ['16DS260251', '16EP260073', '16EP260087'],
      },
      // Eine fremde Rolle — darf im FB-Blatt NICHT auftauchen.
      {
        rolle: 'qs', quellRegelId: 'r19', beschreibung: 'R19 · Gutachten vollständig',
        todo: 'in QS', anzahl: 75, beispiele: ['16KN1'],
      },
    ],
    proRolle: [
      { rolle: 'ab', todos: 824, abgeleitet: 0 },
      { rolle: 'fb', todos: 68, abgeleitet: 68 },
    ],
  },
  flecken: {
    gesamt: 7269,
    ohneTodo: 6017,
    paare: [{
      gesetzt: 'ALT', fehlt: 'ALU', fehltLabel: 'Brief NF von TB', rolle: 'fb',
      anzahl: 662, medianTage: 746, beispiele: ['16EP1', '16EP2'],
    }],
  },
  karte: [
    { code: 'AT4', label: 'Gutachten techn. fertig', vorkommen: 1200, wirkung: ['Setzt den TV-Status auf 45.'] },
    { code: 'XPC+', label: 'PreCheck Verbund positiv', vorkommen: 0, wirkung: [] },
  ],
};

describe('Blätter der Arbeitsmappe', () => {
  const blaetter = baueBlaetter(KONTEXT, DATEN);

  it('führt genau die drei Auswertungen', () => {
    expect(blaetter.map(b => b.name)).toEqual(['Platzhalter', 'Blinde Flecken', 'FB-Kürzel']);
  });

  it('nennt auf JEDEM Blatt Stichtag, Bereich und Grundmenge', () => {
    for (const b of blaetter) {
      const kopf = b.kopf.join('\n');
      expect(kopf, b.name).toContain('Stichtag: 2026-08-03');
      expect(kopf, b.name).toContain('9 Richtlinien');
      expect(kopf, b.name).toContain('Ausgewertete Vorgänge: 7269');
      expect(kopf, b.name).toContain('alle Jahrgänge');
    }
  });

  it('zeigt im Platzhalter-Blatt nur die eigene Rolle', () => {
    const zeilen = blaetter[0]!.zeilen;
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toEqual([
      43, 'Abl/RNE von FB abwarten', 'R2 · PreCheck negativ (Verbund)', 'FB',
      '16DS260251, 16EP260073, 16EP260087',
    ]);
  });

  it('sagt am Platzhalter-Blatt, dass die Anzahl eine Untergrenze ist', () => {
    expect(blaetter[0]!.kopf.join('\n')).toContain('Untergrenze');
  });

  it('führt die blinden Flecken mit Median-Standzeit', () => {
    expect(blaetter[1]!.kopf.join('\n')).toContain('ohne To-do in JEDEM Regelsatz: 6017');
    expect(blaetter[1]!.zeilen[0]).toEqual([
      662, 'ALT', 'ALU', 'Brief NF von TB', 'FB', 746, '16EP1, 16EP2',
    ]);
  });

  it('behält in der Landkarte auch die nie gesetzten Kürzel', () => {
    expect(blaetter[2]!.zeilen.map(z => z[0])).toEqual(['AT4', 'XPC+']);
    expect(blaetter[2]!.zeilen[1]![2]).toBe(0);
  });

  it('ergibt eine Arbeitsmappe mit drei Blättern', () => {
    const mappe = baueArbeitsmappe(blaetter);
    expect(mappe.SheetNames).toEqual(['Platzhalter', 'Blinde Flecken', 'FB-Kürzel']);
  });

  it('kürzt zu lange Blattnamen auf Excels Grenze von 31 Zeichen', () => {
    const mappe = baueArbeitsmappe([{
      name: 'Ein sehr langer Blattname, den Excel so nicht annimmt',
      kopf: [], spalten: ['A'], zeilen: [['x']],
    }]);
    expect(mappe.SheetNames[0]).toHaveLength(31);
  });
});

describe('Kurzfassung für die Einladung', () => {
  const md = baueMarkdown(KONTEXT, DATEN);

  it('trägt den Erhebungs-Kontext im Kopf', () => {
    expect(md).toContain('# Erhebung FB-Regelsatz');
    expect(md).toContain('Stand 2026-08-03');
    expect(md).toContain('9 Richtlinien');
  });

  it('warnt vor der Größenordnung des Platzhalters', () => {
    // Der teuerste Irrtum des Termins: die 43 für die Reichweite der künftigen
    // Regel zu halten. Gemessen wurden 153.
    expect(md).toContain('Achtung bei der Größenordnung');
  });

  it('nennt die blinden Flecken samt Standzeit', () => {
    expect(md).toContain('6017 von 7269');
    expect(md).toContain('746 Tage');
  });

  it('endet mit den Entscheidungen, die der Termin treffen muss', () => {
    expect(md).toContain('Was im Termin zu entscheiden ist');
    expect(md).toContain('eigene** Regel bekommen');
  });

  it('bleibt ehrlich, wenn es nichts zu berichten gibt', () => {
    const leer = baueMarkdown(KONTEXT, {
      platzhalter: { gesamt: 10, gruppen: [], proRolle: [] },
      flecken: { gesamt: 10, ohneTodo: 0, paare: [] },
      karte: [],
    });
    expect(leer).toContain('wartet derzeit keine Regel auf diese Rolle');
    expect(leer).toContain('Keine einseitig offenen Paare');
  });
});
