/**
 * Reine Bausteine des Import-Adapters: JSON-Einstieg, Pfad-/Alias-Zugriff,
 * Laufzeitrechnung, AP-Referenzen, N.N.-Erkennung, Checkboxen, Kosten.
 */
import { describe, expect, it } from 'vitest';
import {
  berechneNnAnteil, ernteArbeitspakete, ernteEinsatzplanung, ernteJahre,
  findeVerwaisteApRefs, istNn, loeseApRefAuf, zerlegeMitarbeiterLabel,
} from '../import/arbeitspakete';
import { alsHaken, ernteCheckboxen } from '../import/checkboxen';
import { entferneBom, leseEinreichungJson } from '../import/json-lesen';
import { normalisiereFoerdersatz } from '../import/kosten';
import { jahrInLaufzeit, monateZwischen, parseDatum, pruefeInLaufzeit } from '../import/laufzeit';
import { alsZahl, leseAlias, lesePfad, sammleWerte } from '../import/pfad';

describe('json-lesen — BOM-Toleranz', () => {
  const NUTZ = '{"a":1}';

  it('liest ohne BOM', () => {
    const r = leseEinreichungJson(NUTZ);
    expect(r).toMatchObject({ ok: true, hatteBom: false });
  });

  it('liest mit BOM und meldet es', () => {
    const r = leseEinreichungJson(`﻿${NUTZ}`);
    expect(r).toMatchObject({ ok: true, hatteBom: true });
  });

  it('liest mit BOM und umgebendem Whitespace', () => {
    expect(leseEinreichungJson(`﻿\n  ${NUTZ}\n`).ok).toBe(true);
  });

  it('gibt bei kaputtem JSON einen Fehler zurueck statt zu werfen', () => {
    const r = leseEinreichungJson('{"a":');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler).toMatch(/kein gültiges JSON/);
  });

  it('lehnt Nicht-Objekte ab', () => {
    expect(leseEinreichungJson('42').ok).toBe(false);
    expect(leseEinreichungJson('"text"').ok).toBe(false);
  });

  it('lehnt leere Dateien ab', () => {
    expect(leseEinreichungJson('   ').ok).toBe(false);
  });

  it('entferneBom laesst Text ohne BOM unveraendert', () => {
    expect(entferneBom(NUTZ)).toBe(NUTZ);
  });
});

describe('pfad — Alias-Ketten', () => {
  const Q = { data: { a: { b: 'treffer' }, leer: '', null1: null, null0: 0, falsch: false } };

  it('liest verschachtelte Pfade', () => {
    expect(lesePfad(Q, 'data.a.b')).toBe('treffer');
  });

  it('gibt undefined bei fehlendem Pfad', () => {
    expect(lesePfad(Q, 'data.x.y')).toBeUndefined();
  });

  it('nimmt den Primaerpfad, wenn er traegt', () => {
    expect(leseAlias(Q, ['data.a.b', 'data.leer'])).toMatchObject({
      wert: 'treffer', benutzterPfad: 'data.a.b', status: 'primaer',
    });
  });

  it('faellt in Reihenfolge auf Aliasse zurueck', () => {
    expect(leseAlias(Q, ['data.fehlt', 'data.auch-nicht', 'data.a.b'])).toMatchObject({
      benutzterPfad: 'data.a.b', status: 'alias',
    });
  });

  it('meldet fehlend, wenn kein Pfad traegt', () => {
    expect(leseAlias(Q, ['data.x'])).toMatchObject({ benutzterPfad: null, status: 'fehlend' });
  });

  it('wertet 0, leeren String und false als vorhanden — nur null/undefined fehlen', () => {
    expect(leseAlias(Q, ['data.null0']).status).toBe('primaer');
    expect(leseAlias(Q, ['data.leer']).status).toBe('primaer');
    expect(leseAlias(Q, ['data.falsch']).status).toBe('primaer');
    expect(leseAlias(Q, ['data.null1', 'data.a.b']).status).toBe('alias');
  });

  it('alsZahl toleriert Zahl-als-String und Dezimalkomma', () => {
    expect(alsZahl(5)).toBe(5);
    expect(alsZahl('5000')).toBe(5000);
    expect(alsZahl('3,5')).toBe(3.5);
    expect(alsZahl('')).toBeNull();
    expect(alsZahl('abc')).toBeNull();
  });

  it('sammleWerte traversiert Array-Ebenen mit *', () => {
    const q = { g: [{ a: [{ r: 'x' }, { r: 'y' }] }, { a: [{ r: 'z' }] }] };
    expect(sammleWerte(q, 'g.*.a.*.r')).toEqual(['x', 'y', 'z']);
  });

  it('sammleWerte liefert leer statt zu werfen, wenn der Pfad nicht passt', () => {
    expect(sammleWerte({ g: 'kein array' }, 'g.*.r')).toEqual([]);
  });
});

describe('laufzeit — angefangene Kalendermonate', () => {
  it('rechnet die Dummy-Laufzeit auf 23 Monate', () => {
    expect(monateZwischen('2025-06-01', '2027-04-30')).toBe(23);
  });

  it('zaehlt denselben Monat als 1', () => {
    expect(monateZwischen('2025-06-01', '2025-06-30')).toBe(1);
  });

  it('zaehlt ueber die Jahresgrenze', () => {
    expect(monateZwischen('2025-12-01', '2026-01-31')).toBe(2);
  });

  it('gibt null bei Ende vor Start', () => {
    expect(monateZwischen('2026-01-01', '2025-01-01')).toBeNull();
  });

  it('gibt null bei unlesbaren Daten', () => {
    expect(monateZwischen('irgendwas', '2027-04-30')).toBeNull();
    expect(monateZwischen(null, undefined)).toBeNull();
  });

  it('parseDatum lehnt unmoegliche Monate ab', () => {
    expect(parseDatum('2025-13-01')).toBeNull();
    expect(parseDatum('2025-00-01')).toBeNull();
  });

  it('parseDatum ignoriert einen Zeitanteil', () => {
    expect(parseDatum('2025-06-05T00:00:00+02:00')).toMatchObject({ jahr: 2025, monat: 6, tag: 5 });
  });

  it('erkennt Zeitraeume ausserhalb der Laufzeit', () => {
    const lz = { start: '2025-06-01', ende: '2027-04-30' };
    expect(pruefeInLaufzeit({ start: '2025-08-01', ende: '2026-01-31' }, lz)).toEqual([]);
    expect(pruefeInLaufzeit({ start: '2025-01-01', ende: '2026-01-31' }, lz)).toEqual(['start-vor-beginn']);
    expect(pruefeInLaufzeit({ start: '2025-08-01', ende: '2028-01-31' }, lz)).toEqual(['ende-nach-abschluss']);
  });

  it('meldet keinen Verstoss, wenn Daten fehlen', () => {
    expect(pruefeInLaufzeit({ start: null, ende: null }, { start: '2025-06-01', ende: '2027-04-30' })).toEqual([]);
  });

  it('erkennt Jahre ausserhalb der Laufzeit', () => {
    const lz = { start: '2025-06-01', ende: '2027-04-30' };
    expect(jahrInLaufzeit(2027, lz)).toBe(true);
    expect(jahrInLaufzeit(2028, lz)).toBe(false);
    expect(jahrInLaufzeit(2024, lz)).toBe(false);
  });
});

describe('N.N.-Erkennung', () => {
  it('erkennt alle belegten und plausiblen Schreibweisen', () => {
    for (const v of ['N.N.', 'N.N', 'N. N.', 'NN', 'n.n.', 'N.N. N.N', 'nn']) {
      expect(istNn(v), v).toBe(true);
    }
  });

  it('haelt echte Namen auseinander', () => {
    for (const v of ['Anton Beispiel', 'Berta Musterfrau', 'Vorname 1 Name 1', 'Nina']) {
      expect(istNn(v), v).toBe(false);
    }
  });

  it('behandelt fehlenden Namen als benannt', () => {
    expect(istNn(null)).toBe(false);
  });

  it('zerlegt das Mitarbeiter-Label und behaelt nur die Personalnummer', () => {
    expect(zerlegeMitarbeiterLabel('2 | N.N. N.N')).toEqual({ personalNr: '2', name: 'N.N. N.N' });
    expect(zerlegeMitarbeiterLabel('1 | Anton Beispiel')).toEqual({ personalNr: '1', name: 'Anton Beispiel' });
    expect(zerlegeMitarbeiterLabel('ohne Trenner')).toEqual({ personalNr: null, name: 'ohne Trenner' });
    expect(zerlegeMitarbeiterLabel(undefined)).toEqual({ personalNr: null, name: null });
  });
});

describe('AP-Referenzen — vier Quellformate, ein Ziel', () => {
  const PAKETE = ernteArbeitspakete([
    { arbeitspaket: 'AP1', number: 1, arbeitsaufwand: 12 },
    { arbeitspaket: 'AP2', number: 2, arbeitsaufwand: 4 },
  ]);

  it('loest den reinen Namen auf', () => {
    expect(loeseApRefAuf('AP1', PAKETE)).toBe(1);
  });

  it('loest die Label-Form mit fuehrender Nummer auf', () => {
    expect(loeseApRefAuf('1 AP1', PAKETE)).toBe(1);
  });

  it('loest das Objekt mit Epoch-Tripel ueber das fuehrende Segment auf', () => {
    expect(loeseApRefAuf(
      { label: '1 AP1', value: '1-1753999200000-1769814000000' }, PAKETE,
    )).toBe(1);
  });

  it('loest abweichende Gross-/Kleinschreibung auf', () => {
    expect(loeseApRefAuf('Ap2', PAKETE)).toBe(2);
    expect(loeseApRefAuf('ap2', PAKETE)).toBe(2);
  });

  it('meldet unbekannte Referenzen als verwaist', () => {
    expect(loeseApRefAuf('AP9', PAKETE)).toBeNull();
    expect(loeseApRefAuf(null, PAKETE)).toBeNull();
    expect(findeVerwaisteApRefs(['AP1', 'Ap2', 'AP9', 'AP9'], PAKETE)).toEqual(['AP9']);
  });

  it('nutzt das Objekt-Label, wenn value nicht aufloest', () => {
    expect(loeseApRefAuf({ label: 'AP2', value: 'unbrauchbar' }, PAKETE)).toBe(2);
  });
});

describe('Einsatzplanung — Jahresscheiben und N.N.-Anteil', () => {
  const ZEILEN = ernteEinsatzplanung([
    {
      laufnummer: 1, arbeitspacket: 'AP1', arbeitsaufwandPM: 12,
      mitarbeiter: [
        {
          mitarbeiternummer: { label: '2 | N.N. N.N' }, gesamtpersonalmonateJeMitarbeiter: 8,
          jahr1: 2025, personenmonateJahr1: 3, jahr2: 2026, personenmonateJahr2: 2,
          jahr3: 2027, personenmonateJahr3: 1, jahr4: 2028, personenmonateJahr4: 2,
        },
        {
          mitarbeiternummer: { label: '1 | Anton Beispiel' }, gesamtpersonalmonateJeMitarbeiter: 4,
          jahr1: 2025, personenmonateJahr1: 2, jahr4: 2028, personenmonateJahr4: 1,
        },
      ],
    },
    {
      laufnummer: 2, arbeitspacket: 'AP2', arbeitsaufwandPM: 4,
      mitarbeiter: [
        { mitarbeiternummer: { label: '2 | N.N. N.N' }, gesamtpersonalmonateJeMitarbeiter: 2 },
        { mitarbeiternummer: { label: '1 | Anton Beispiel' }, gesamtpersonalmonateJeMitarbeiter: 2 },
      ],
    },
  ]);

  it('joint ueber die Laufnummer und haelt den Rohnamen nur als Diagnose', () => {
    expect(ZEILEN[0]?.laufnummer).toBe(1);
    expect(ZEILEN[0]?.apRefRoh).toBe('AP1');
  });

  it('speichert nur Personalnummer und N.N.-Flag, keinen Namen', () => {
    const ma = ZEILEN[0]!.mitarbeiter;
    expect(ma[0]).toEqual({ personalNr: '2', istNn: true, pm: 8 });
    expect(ma[1]).toEqual({ personalNr: '1', istNn: false, pm: 4 });
    expect(JSON.stringify(ma)).not.toMatch(/Anton|Beispiel/);
  });

  it('rechnet den N.N.-Anteil des Dummys auf 10 von 16 PM', () => {
    expect(berechneNnAnteil(ZEILEN)).toBeCloseTo(0.625, 5);
  });

  it('gibt null statt 0, wenn gar keine Personenmonate erfasst sind', () => {
    expect(berechneNnAnteil([])).toBeNull();
  });

  it('sammelt nur Jahre mit Personenmonaten', () => {
    expect(ZEILEN[0]?.jahre).toEqual([2025, 2026, 2027, 2028]);
    expect(ernteJahre([{ jahr1: 2025, personenmonateJahr1: 0, jahr2: 2026, personenmonateJahr2: 3 }]))
      .toEqual([2026]);
  });
});

describe('Checkboxen — zwei Kodierungen nebeneinander', () => {
  it('kennzeichnet numerische Schluessel ohne Zuordnung als unbekannt', () => {
    const r = ernteCheckboxen({ '0': false, '1': true, '2': true });
    expect(r).toHaveLength(3);
    expect(r[1]).toMatchObject({ key: '1', label: 'Position 1', gesetzt: true, labelHerkunft: 'unbekannt' });
  });

  it('nutzt eine gepflegte Zuordnung, wenn vorhanden', () => {
    const r = ernteCheckboxen({ '0': true }, { '0': 'Schutzrecht angemeldet' });
    expect(r[0]).toMatchObject({ label: 'Schutzrecht angemeldet', labelHerkunft: 'schema' });
  });

  it('nimmt Klartext-Schluessel als eigene Beschriftung', () => {
    const r = ernteCheckboxen({ 'Einstieg in ein neues Technologiegebiet': false });
    expect(r[0]).toMatchObject({
      label: 'Einstieg in ein neues Technologiegebiet', labelHerkunft: 'schluessel', gesetzt: false,
    });
  });

  it('sortiert numerische Schluessel numerisch, nicht lexikalisch', () => {
    expect(ernteCheckboxen({ '10': true, '2': true }).map(c => c.key)).toEqual(['2', '10']);
  });

  it('liefert leere Liste statt zu werfen', () => {
    expect(ernteCheckboxen(null)).toEqual([]);
    expect(ernteCheckboxen(['a'])).toEqual([]);
  });

  it('alsHaken deutet die belegten Wahrheitswert-Schreibweisen', () => {
    expect(alsHaken(true)).toBe(true);
    expect(alsHaken('ja')).toBe(true);
    expect(alsHaken('X')).toBe(true);
    expect(alsHaken(false)).toBe(false);
    expect(alsHaken('nein')).toBe(false);
    expect(alsHaken(undefined)).toBe(false);
  });
});

describe('Foerdersatz-Normalisierung', () => {
  it('nimmt den Anteil unveraendert', () => {
    expect(normalisiereFoerdersatz(0.45)).toBe(0.45);
  });

  it('rechnet eine Prozentangabe um', () => {
    expect(normalisiereFoerdersatz(45)).toBe(0.45);
  });

  it('gibt null statt eines stillen Defaults bei unbrauchbaren Werten', () => {
    expect(normalisiereFoerdersatz('keine Angabe')).toBeNull();
    expect(normalisiereFoerdersatz(-1)).toBeNull();
    expect(normalisiereFoerdersatz(null)).toBeNull();
  });
});
