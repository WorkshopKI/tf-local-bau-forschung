/**
 * Import-Adapter gegen die Fixtures: Schema-Erkennung, Strukturmodell,
 * Rechenchecks, Datenschutz-Nachweis.
 *
 * Der Echtfall-Block überspringt sich, wenn die gitignorierte Datei fehlt —
 * damit bleibt der Lauf auf jedem Clone grün.
 */
import { describe, expect, it } from 'vitest';
import { importiereEinreichung } from '../import/adapter';
import { findeVerdaechtigeWerte } from '../import/redaktion';
import { erkenneSchema } from '../import/schema-erkennung';
import type { MapEinreichung, MapImportReport } from '../types';
import {
  DRIFT_PFAD, DUMMY_PFAD, ECHTFALL_PFAD, ECHTFALL_VORHANDEN, TEST_KONTEXT, leseFixture,
} from './fixtures';

function importiere(pfad: string): { einreichung: MapEinreichung; report: MapImportReport } {
  const antwort = importiereEinreichung(leseFixture(pfad), TEST_KONTEXT);
  if (!antwort.ok) throw new Error(`Import fehlgeschlagen: ${antwort.fehler}`);
  return { einreichung: antwort.einreichung, report: antwort.report };
}

describe('Import — Dummy (Schema 2025)', () => {
  const { einreichung: e, report } = importiere(DUMMY_PFAD);

  it('erkennt die Generation eindeutig als 2025', () => {
    expect(report.erkennung.schemaId).toBe('zim-2025');
    expect(report.erkennung.eindeutig).toBe(true);
  });

  it('uebernimmt die Stammdaten', () => {
    expect(e.stamm.titel).toBe('Test der Kurzbezeichnung');
    expect(e.stamm.akronym).toBe('Akronym');
    expect(e.stamm.kurzfassung).not.toBeNull();
  });

  it('rechnet die Laufzeit auf 23 Monate', () => {
    expect(e.laufzeit).toMatchObject({ start: '2025-06-01', ende: '2027-04-30', monate: 23 });
  });

  it('uebernimmt die Kostenarten und die Gesamtsumme', () => {
    expect(e.kosten).toMatchObject({
      personal: 69718, dritte: 5012, fue: 7000, temp: 5000, uebrige: 25000,
      gesamt: 111730, beantragteZuwendung: 50279, foerdersatz: 0.45,
    });
  });

  it('bestaetigt die Kostensumme rechnerisch', () => {
    expect(69718 + 5012 + 7000 + 5000 + 25000).toBe(111730);
    expect(Math.abs(111730 * 0.45 - 50279)).toBeLessThanOrEqual(1);
  });

  it('erntet beide Arbeitspakete mit Laufnummer', () => {
    expect(e.arbeitspakete).toHaveLength(2);
    expect(e.arbeitspakete[0]).toMatchObject({ laufnummer: 1, name: 'AP1', aufwandPm: 12 });
    expect(e.arbeitspakete[1]).toMatchObject({ laufnummer: 2, name: 'AP2', aufwandPm: 4 });
  });

  it('uebernimmt die Personenmonats-Summen', () => {
    expect(e.summen.arbeitsaufwandAp).toBe(16);
    expect(e.summen.personenmonateEinsatz).toBe(16);
  });

  it('rechnet den N.N.-Anteil auf 62,5 Prozent', () => {
    expect(e.summen.nnAnteil).toBeCloseTo(0.625, 5);
  });

  it('erntet beide Checkbox-Gruppen mit ihrer jeweiligen Kodierung', () => {
    expect(e.merkmale.patentsituation).toHaveLength(5);
    expect(e.merkmale.patentsituation[0]?.labelHerkunft).toBe('unbekannt');
    expect(e.merkmale.technologieneuerung).toHaveLength(2);
    expect(e.merkmale.technologieneuerung[0]?.labelHerkunft).toBe('schluessel');
  });

  it('erntet Anlagen ohne Download-Links', () => {
    expect(e.anlagen.length).toBeGreaterThan(0);
    const serialisiert = JSON.stringify(e.anlagen);
    expect(serialisiert).not.toMatch(/http/);
    expect(serialisiert).not.toMatch(/fileUrl/);
  });

  it('stempelt Kontext und Quell-Hash', () => {
    expect(e.importiertVon).toBe('TST');
    expect(e.importiertAm).toBe('2026-07-20T10:00:00.000Z');
    expect(e.quellHash).toMatch(/^[0-9a-z]+$/);
    expect(e.id).toMatch(/^[0-9a-z]+$/);
  });

  it('meldet das BOM als Hinweis', () => {
    expect(report.meldungen.some(m => m.text.includes('BOM'))).toBe(true);
  });
});

describe('Rechenchecks — Dummy loest genau zwei Befunde aus', () => {
  const { report } = importiere(DUMMY_PFAD);
  const ids = report.befunde.map(b => b.id).sort();

  it('findet die AP-Ueberschreitung und die Jahresscheibe ausserhalb der Laufzeit', () => {
    expect(ids).toEqual(['ap-pm-grenze:1', 'einsatz-jahr:2028']);
  });

  it('beschreibt die AP-Ueberschreitung nachvollziehbar', () => {
    const b = report.befunde.find(x => x.id === 'ap-pm-grenze:1');
    expect(b?.erwartet).toContain('6');
    expect(b?.gefunden).toContain('12');
  });

  it('meldet weder Kostensummen- noch Zuwendungs- noch PM-Abweichung', () => {
    expect(ids).not.toContain('kosten-summe');
    expect(ids).not.toContain('zuwendung-foerdersatz');
    expect(ids).not.toContain('pm-summe');
  });

  it('findet keine verwaisten AP-Referenzen — auch nicht die Schreibweise „Ap2"', () => {
    expect(ids).not.toContain('ap-ref-verwaist');
  });
});

describe('Datenschutz — was nicht importiert wird', () => {
  const { einreichung: e, report } = importiere(DUMMY_PFAD);

  it('weist die verworfenen Quellpfade nach', () => {
    const verworfen = report.redaktion.verworfenePfade;
    expect(verworfen.length).toBeGreaterThan(0);
    expect(verworfen.some(p => p.startsWith('data.mitarbeiter.personalbogen_editgrid'))).toBe(true);
    expect(verworfen.some(p => p.startsWith('data.bankverb'))).toBe(true);
    expect(verworfen.some(p => p.startsWith('metadata'))).toBe(true);
  });

  it('laesst im Ergebnis keinen verdaechtigen Schluessel zurueck', () => {
    expect(findeVerdaechtigeWerte(e)).toEqual([]);
  });

  it('traegt im serialisierten Ergebnis keine Personendaten', () => {
    const roh = JSON.stringify(e);
    for (const muster of [/iban/i, /geburtsdatum/i, /@/, /brutto/i, /vwl/i, /stundensatz/i, /tvod/i]) {
      expect(roh, `Muster ${muster} gefunden`).not.toMatch(muster);
    }
  });

  it('listet nicht ausgewertete Bereiche auf, statt sie stumm zu verwerfen', () => {
    expect(report.unbekannteFelder.length).toBeGreaterThan(0);
    expect(report.unbekannteFelder.every(b => b.startsWith('data.'))).toBe(true);
  });
});

describe('Drift-Fixture 2027 — importiert mit Warnungen statt Abbruch', () => {
  const { einreichung: e, report } = importiere(DRIFT_PFAD);

  it('erkennt die Generation nicht mehr eindeutig', () => {
    expect(report.erkennung.eindeutig).toBe(false);
  });

  it('bricht trotzdem nicht ab und liefert ein Strukturmodell', () => {
    expect(e.stamm.akronym).toBe('Akronym');
    expect(e.kosten.gesamt).toBe(111730);
    expect(e.arbeitspakete).toHaveLength(2);
  });

  it('findet den umbenannten Titel ueber den Alias-Pfad', () => {
    expect(e.stamm.titel).toBe('Test der Kurzbezeichnung');
    const befund = report.zielfelder.find(z => z.ziel === 'stamm.titel');
    expect(befund).toMatchObject({
      status: 'alias', benutzterPfad: 'data.antragsdetails.projekttitel_textfield',
    });
  });

  it('meldet das fehlende Pflichtfeld als Fehler', () => {
    const befund = report.zielfelder.find(z => z.ziel === 'kosten.beantragteZuwendung');
    expect(befund).toMatchObject({ status: 'fehlend', pflicht: true });
    expect(report.meldungen.some(m => m.schwere === 'fehler' && m.text.includes('beantragteZuwendung')))
      .toBe(true);
  });

  it('zeigt den neuen, unbekannten Bereich', () => {
    expect(report.unbekannteFelder).toContain('data.nachhaltigkeit');
  });

  it('ueberspringt den Zuwendungs-Check, statt einen Falsch-Befund zu erzeugen', () => {
    expect(report.befunde.map(b => b.id)).not.toContain('zuwendung-foerdersatz');
  });
});

describe('Schema-Erkennung — Randfaelle', () => {
  it('meldet Mehrdeutigkeit, wenn Merkmale beider Generationen vorliegen', () => {
    const r = erkenneSchema({
      data: {
        istVorjahr: {}, werteUbertragen: false,
        finanzierungsubersicht: {}, antragsteller: { handwerk_confirm: false },
        auftraegeDritter: { istEinAuftragAnDritteGeplant: false },
      },
    });
    expect(r.erkennung.schemaId).toBeNull();
    expect(r.erkennung.eindeutig).toBe(false);
    expect(r.meldungen[0]?.text).toMatch(/mehrerer Schema-Generationen/);
  });

  it('meldet fehlende Erkennung bei voellig fremdem JSON', () => {
    const r = erkenneSchema({ etwas: 'anderes' });
    expect(r.erkennung.schemaId).toBeNull();
    expect(r.definition.id).toBe('zim-2026');
    expect(r.meldungen[0]?.text).toMatch(/Keine bekannte Schema-Generation/);
  });
});

const beschreibeEchtfall = ECHTFALL_VORHANDEN ? describe : describe.skip;

/**
 * Faul laden: `describe.skip` führt den Callback trotzdem aus, um die Tests zu
 * registrieren. Ein Dateizugriff auf oberster Ebene des Blocks würde deshalb
 * auch dann scheitern, wenn der Block übersprungen wird.
 */
let echtfallCache: ReturnType<typeof importiere> | null = null;
const echtfall = (): ReturnType<typeof importiere> =>
  (echtfallCache ??= importiere(ECHTFALL_PFAD));

beschreibeEchtfall('Echtfall (lokal, nicht committet)', () => {
  it('erkennt die Generation eindeutig als 2026', () => {
    expect(echtfall().report.erkennung.schemaId).toBe('zim-2026');
    expect(echtfall().report.erkennung.eindeutig).toBe(true);
  });

  it('uebernimmt Kosten und Personenmonate', () => {
    expect(echtfall().einreichung.kosten.gesamt).toBe(227488);
    expect(echtfall().einreichung.kosten.beantragteZuwendung).toBe(102370);
    expect(echtfall().einreichung.summen.personenmonateEinsatz).toBe(19.5);
  });

  it('loest keinen einzigen Rechenbefund aus', () => {
    expect(echtfall().report.befunde).toEqual([]);
  });

  it('haelt auch hier alle Personendaten draussen', () => {
    expect(findeVerdaechtigeWerte(echtfall().einreichung)).toEqual([]);
    expect(JSON.stringify(echtfall().einreichung)).not.toMatch(/@|iban|geburtsdatum/i);
  });
});

it.skipIf(ECHTFALL_VORHANDEN)(
  'Echtfall-Tests uebersprungen — fixtures-local/echtfall-2026.json fehlt (gitignored, erwartet)',
  () => { expect(ECHTFALL_VORHANDEN).toBe(false); },
);
