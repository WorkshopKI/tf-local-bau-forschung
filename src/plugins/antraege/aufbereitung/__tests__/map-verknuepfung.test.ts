/**
 * Reine Teile der Verknüpfung Aufbereitung ↔ MAP-Einreichung.
 *
 * Der IO-Teil (`ladeEinreichungsBezug`) hängt an `resolveVb` und damit am halben
 * Dokument-Stack — geprüft werden hier die zwei Entscheidungen, die tatsächlich
 * etwas entscheiden: WELCHE Einreichung gehört zum Vorgang, und WIE werden ihre
 * Arbeitspakete zu Gantt-Zeilen.
 */
import { describe, it, expect } from 'vitest';
import type { MapEinreichung } from '@/plugins/map-foerderfaehig/types';
import { einreichungZuZeitplan, findeEinreichungIdFuerDoc } from '../map-verknuepfung';

describe('findeEinreichungIdFuerDoc', () => {
  const eintraege: Array<[string, unknown]> = [
    ['map-vb:E1', { docId: 'doc-a', docName: 'A.pdf' }],
    ['map-vb:E2', { docId: 'doc-b', docName: 'B.pdf', zusatz: [{ docId: 'doc-c', docName: 'C.pdf' }] }],
  ];

  it('findet die Einreichung über das Hauptdokument', () => {
    expect(findeEinreichungIdFuerDoc(eintraege, 'doc-a')).toBe('E1');
  });

  it('findet die Einreichung auch über ein Zusatzdokument', () => {
    expect(findeEinreichungIdFuerDoc(eintraege, 'doc-c')).toBe('E2');
  });

  it('liefert null ohne Treffer und bei leerer docId', () => {
    expect(findeEinreichungIdFuerDoc(eintraege, 'doc-x')).toBeNull();
    expect(findeEinreichungIdFuerDoc(eintraege, '')).toBeNull();
  });

  it('überspringt kaputte Einträge, statt zu werfen', () => {
    const kaputt: Array<[string, unknown]> = [
      ['map-vb:E0', null],
      ['map-vb:E0b', { docName: 'ohne id' }],
      ['map-einreichung:E9', { docId: 'doc-a' }], // falscher Präfix → kein Treffer
      ...eintraege,
    ];
    expect(findeEinreichungIdFuerDoc(kaputt, 'doc-a')).toBe('E1');
  });
});

/** Minimal-Einreichung — nur die Felder, die der Zeitplan liest. */
function einreichung(over: Partial<MapEinreichung> = {}): MapEinreichung {
  return {
    version: 1, id: 'E1', schemaId: null, importiertAm: '', importiertVon: null,
    dateiname: 'antrag.json', quellHash: '',
    stamm: { titel: null, akronym: null, kurzfassung: null },
    laufzeit: { start: '2025-06-01', ende: '2027-04-30', monate: 23 },
    arbeitspakete: [
      { laufnummer: 1, name: 'AP1 Grundlagen', start: '2025-06-01', ende: '2025-08-31', aufwandPm: 4, quellIndex: 0 },
      { laufnummer: 2, name: 'AP2 Aufbau', start: '2025-09-01', ende: '2026-02-28', aufwandPm: 6, quellIndex: 1 },
    ],
    einsatzplanung: [],
    summen: { personenmonateEinsatz: null, arbeitsaufwandAp: null, nnAnteil: null },
    kosten: {} as MapEinreichung['kosten'],
    antragsteller: { kurzprofil: null },
    merkmale: {} as MapEinreichung['merkmale'],
    anlagen: [],
    ...over,
  };
}

describe('einreichungZuZeitplan', () => {
  it('rechnet Monate relativ zum Laufzeit-Start (M1 = Startmonat)', () => {
    const plan = einreichungZuZeitplan(einreichung());
    expect(plan).not.toBeNull();
    expect(plan!.zeilen).toHaveLength(2);
    expect(plan!.zeilen[0]).toMatchObject({ nummer: '1', bezeichnung: 'AP1 Grundlagen', monatStart: 1, monatEnde: 3, pm: 4 });
    expect(plan!.zeilen[1]).toMatchObject({ nummer: '2', monatStart: 4, monatEnde: 9, pm: 6 });
  });

  it('setzt die fraktionalen Positionen wie die Anlage-5-Normalisierung (Monatskanten)', () => {
    const plan = einreichungZuZeitplan(einreichung())!;
    // 01.06. = Monatsanfang → posStart exakt auf der Kante; 31.08. = Monatsende → nächste Kante.
    expect(plan.zeilen[0]!.posStart).toBeCloseTo(1, 5);
    expect(plan.zeilen[0]!.posEnde).toBeCloseTo(4, 5);
  });

  it('lässt maNr leer — eine Person je AP wäre willkürlich gewählt', () => {
    const plan = einreichungZuZeitplan(einreichung())!;
    expect(plan.zeilen.every(z => z.maNr === undefined)).toBe(true);
  });

  it('spannt die Achse mindestens über die deklarierte Laufzeit', () => {
    const plan = einreichungZuZeitplan(einreichung())!;
    expect(plan.achseMax).toBe(23); // Zeilen enden bei 9, Laufzeit sagt 23
    expect(plan.laufzeit).toEqual({ start: '2025-06-01', ende: '2027-04-30', monate: 23 });
  });

  it('fällt ohne Laufzeit-Start auf den frühesten AP-Beginn zurück', () => {
    const plan = einreichungZuZeitplan(einreichung({
      laufzeit: { start: null, ende: null, monate: null },
    }))!;
    expect(plan.zeilen[0]!.monatStart).toBe(1);
    expect(plan.achseMax).toBe(9);
  });

  it('liefert null ohne Arbeitspakete und ohne jedes brauchbare Datum', () => {
    expect(einreichungZuZeitplan(einreichung({ arbeitspakete: [] }))).toBeNull();
    expect(einreichungZuZeitplan(einreichung({
      laufzeit: { start: null, ende: null, monate: null },
      arbeitspakete: [{ laufnummer: 1, name: 'AP1', start: null, ende: null, aufwandPm: null, quellIndex: 0 }],
    }))).toBeNull();
  });

  it('nummeriert Arbeitspakete ohne Laufnummer über die Position', () => {
    const plan = einreichungZuZeitplan(einreichung({
      arbeitspakete: [{ laufnummer: null, name: 'Ohne Nummer', start: '2025-06-01', ende: '2025-07-31', aufwandPm: null, quellIndex: 0 }],
    }))!;
    expect(plan.zeilen[0]!.nummer).toBe('1');
    expect(plan.zeilen[0]!.pm).toBeUndefined();
  });
});
