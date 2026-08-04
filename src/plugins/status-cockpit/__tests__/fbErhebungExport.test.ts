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
import { baueArbeitsmappe } from '@/core/status/export/arbeitsmappe';

const KONTEXT: ErhebungsKontext = {
  stichtag: '2026-08-03T09:00:00.000Z',
  bereichText: 'Richtlinien 2015 + 2020 + 2025 · 12 Programme (46, 47, 48, 76, 77, 78, 79, 131, 136, 137, 138, 139)',
  rolle: 'fb',
};

const DATEN: ErhebungsDaten = {
  platzhalter: {
    gesamt: 7269,
    gruppen: [
      {
        rolle: 'fb', quellRegelId: 'r2', beschreibung: 'R2 · PreCheck negativ (Verbund)',
        todo: 'Abl/RNE von FB abwarten', alsPlatzhalter: 43, bedingungTrifft: 153,
        beispiele: ['16DS260251', '16EP260073', '16EP260087'],
      },
      // Eine fremde Rolle — darf im FB-Blatt NICHT auftauchen.
      {
        rolle: 'qs', quellRegelId: 'r19', beschreibung: 'R19 · Gutachten vollständig',
        todo: 'in QS', alsPlatzhalter: 75, bedingungTrifft: 75, beispiele: ['16KN1'],
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
      anzahl: 662, medianTage: 746,
      aktuell: { anzahl: 120, medianTage: 210, medianLetzteAktivitaet: 96, beispiele: ['16EP1'] },
      altbestand: {
        anzahl: 542, medianTage: 980, medianLetzteAktivitaet: 910, beispiele: ['16EP2', '16EP3'],
      },
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
      expect(kopf, b.name).toContain('12 Programme');
      expect(kopf, b.name).toContain('Ausgewertete Vorgänge: 7269');
      expect(kopf, b.name).toContain('alle Jahrgänge');
    }
  });

  it('zeigt im Platzhalter-Blatt nur die eigene Rolle, mit beiden Zahlen', () => {
    const zeilen = blaetter[0]!.zeilen;
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toEqual([
      43, 153, 'Abl/RNE von FB abwarten', 'R2 · PreCheck negativ (Verbund)', 'FB',
      '16DS260251, 16EP260073, 16EP260087',
    ]);
  });

  it('erklärt die zwei Zahlen im Kopf — sonst sind sie schlimmer als eine', () => {
    const kopf = blaetter[0]!.kopf.join('\n');
    expect(kopf).toContain('als Platzhalter sichtbar');
    expect(kopf).toContain('Bedingung trifft');
    expect(blaetter[0]!.spalten.slice(0, 2)).toEqual(['Als Platzhalter sichtbar', 'Bedingung trifft']);
  });

  it('trennt die blinden Flecken in zwei Blöcke, je mit Anzahl und Medianen', () => {
    expect(blaetter[1]!.kopf.join('\n')).toContain('ohne To-do in JEDEM Regelsatz: 6017');
    expect(blaetter[1]!.kopf.join('\n')).toContain('400 Tagen');
    expect(blaetter[1]!.zeilen).toEqual([
      ['bis 400 Tage', 120, 'ALT', 'ALU', 'Brief NF von TB', 'FB', 210, 96, '16EP1'],
      ['über 400 Tage', 542, 'ALT', 'ALU', 'Brief NF von TB', 'FB', 980, 910, '16EP2, 16EP3'],
    ]);
  });

  it('lässt einen leeren Block weg, statt eine Nullzeile zu schreiben', () => {
    const nurAlt = baueBlaetter(KONTEXT, {
      ...DATEN,
      flecken: {
        ...DATEN.flecken,
        paare: [{
          ...DATEN.flecken.paare[0]!,
          aktuell: { anzahl: 0, medianTage: 0, medianLetzteAktivitaet: 0, beispiele: [] },
        }],
      },
    });
    expect(nurAlt[1]!.zeilen).toHaveLength(1);
    expect(nurAlt[1]!.zeilen[0]![0]).toBe('über 400 Tage');
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
    expect(md).toContain('12 Programme');
  });

  it('warnt vor der Größenordnung des Platzhalters und nennt beide Zahlen', () => {
    // Der teuerste Irrtum des Termins: die 43 für die Reichweite der künftigen
    // Regel zu halten. Gemessen wurden 153.
    expect(md).toContain('Achtung bei der Größenordnung');
    expect(md).toContain('| 43 | 153 |');
  });

  it('nennt die blinden Flecken in zwei Blöcken samt beider Mediane', () => {
    expect(md).toContain('6017 von 7269');
    expect(md).toContain('Standzeit bis 400 Tage');
    expect(md).toContain('vermutlich Altbestand, kein Rückstand');
    expect(md).toContain('| 980 Tage | 910 Tage |');
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
