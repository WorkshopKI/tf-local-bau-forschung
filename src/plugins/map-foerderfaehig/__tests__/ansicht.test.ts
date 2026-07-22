/**
 * Reine Ableitungen der Ansichten: Gantt-Geometrie und Kosten-Segmente.
 *
 * Diese Tests sind der einzige Testbarkeits-Hebel für die Darstellung — die
 * Vitest-Umgebung ist `node` ohne jsdom, `.tsx` wird nicht eingesammelt. Deshalb
 * die Regel: keine `.tsx` in diesem Plugin rechnet.
 */
import { describe, expect, it } from 'vitest';
import { GANTT_W, macheAchse } from '@/plugins/antraege/aufbereitung/GanttAchse';
import {
  GANTT_MIN_BREITE, baueGanttDaten, letzterTerminierterMonat, monatsPosition, zeichenBreite,
} from '../ansicht/gantt-daten';
import { baueKostenSegmente, summenAbweichung } from '../ansicht/kosten-segmente';
import { importiereEinreichung } from '../import/adapter';
import { AP_PM_GRENZE } from '../import/rechenchecks';
import type { MapKosten } from '../types';
import { DUMMY_PFAD, TEST_KONTEXT, leseFixture } from './fixtures';

const antwort = importiereEinreichung(leseFixture(DUMMY_PFAD), TEST_KONTEXT);
if (!antwort.ok) throw new Error(antwort.fehler);
const DUMMY = antwort.einreichung;

describe('Gantt-Geometrie', () => {
  it('legt den Projektstart auf Monatsposition 1', () => {
    expect(monatsPosition('2025-06-01', '2025-06-01')).toBe(1);
  });

  it('rechnet den Tagesanteil innerhalb des Monats', () => {
    // 16.06. von 30 Tagen → 1 + 15/30
    expect(monatsPosition('2025-06-16', '2025-06-01')).toBeCloseTo(1.5, 5);
  });

  it('rechnet ueber Jahresgrenzen', () => {
    expect(monatsPosition('2026-01-01', '2025-06-01')).toBe(8);
  });

  it('gibt null bei unlesbarem Datum', () => {
    expect(monatsPosition(null, '2025-06-01')).toBeNull();
    expect(monatsPosition('2025-06-01', null)).toBeNull();
  });

  it('erzeugt fuer beide Dummy-Arbeitspakete eine Zeile', () => {
    const d = baueGanttDaten(DUMMY, AP_PM_GRENZE);
    expect(d.zeilen).toHaveLength(2);
    expect(d.ohneTermin).toEqual([]);
  });

  it('markiert nur das Arbeitspaket ueber der PM-Grenze', () => {
    const d = baueGanttDaten(DUMMY, AP_PM_GRENZE);
    expect(d.zeilen[0]).toMatchObject({ name: 'AP1', aufwandPm: 12, auffaellig: true });
    expect(d.zeilen[1]).toMatchObject({ name: 'AP2', aufwandPm: 4, auffaellig: false });
  });

  it('folgt der Laufzeit, nicht dem letzten Arbeitspaket', () => {
    // Sonst verschwaende die Ansicht die Aussage „ab M12 ist nichts mehr terminiert".
    const d = baueGanttDaten(DUMMY, AP_PM_GRENZE);
    expect(d.achseMax).toBe(23);
    expect(letzterTerminierterMonat(d)).toBeLessThan(23);
  });

  it('waechst mit, wenn ein Arbeitspaket ueber die Laufzeit hinausreicht', () => {
    const ueberlang = {
      ...DUMMY,
      arbeitspakete: [{
        laufnummer: 1, name: 'AP1', start: '2025-06-01', ende: '2028-06-30',
        aufwandPm: 3, quellIndex: 0,
      }],
    };
    expect(baueGanttDaten(ueberlang, AP_PM_GRENZE).achseMax).toBeGreaterThan(23);
  });

  it('meldet Arbeitspakete ohne Termin, statt sie stumm zu verschlucken', () => {
    const ohne = {
      ...DUMMY,
      arbeitspakete: [{
        laufnummer: 1, name: 'AP ohne Datum', start: null, ende: null,
        aufwandPm: 3, quellIndex: 0,
      }],
    };
    const d = baueGanttDaten(ohne, AP_PM_GRENZE);
    expect(d.zeilen).toEqual([]);
    expect(d.ohneTermin).toEqual(['AP ohne Datum']);
  });

  it('gibt jedem Balken eine sichtbare Mindestbreite', () => {
    const eintaegig = {
      ...DUMMY,
      arbeitspakete: [{
        laufnummer: 1, name: 'AP', start: '2025-06-01', ende: '2025-06-01',
        aufwandPm: 1, quellIndex: 0,
      }],
    };
    const zeile = baueGanttDaten(eintaegig, AP_PM_GRENZE).zeilen[0]!;
    expect(zeile.posEnde).toBeGreaterThan(zeile.posStart);
  });
});

/**
 * Der viewBox muss der gemessenen Breite folgen. Bliebe er fest, skalierte das
 * breite Prüfblatt die Zeichnung hoch — samt Schrift und Balken.
 */
describe('Zeichenbreite', () => {
  it('nimmt die gemessene Breite, damit 1 Einheit 1 Pixel bleibt', () => {
    expect(zeichenBreite(1290, 1000)).toBe(1290);
  });

  it('rundet auf ganze Pixel', () => {
    expect(zeichenBreite(1289.6, 1000)).toBe(1290);
  });

  it('faellt vor der ersten Messung auf das feste Mass zurueck', () => {
    expect(zeichenBreite(null, 1000)).toBe(1000);
    expect(zeichenBreite(0, 1000)).toBe(1000);
    expect(zeichenBreite(Number.NaN, 1000)).toBe(1000);
  });

  it('haelt einen Sockel, statt in schmalen Panels unlesbar zu werden', () => {
    expect(zeichenBreite(320, 1000)).toBe(GANTT_MIN_BREITE);
  });

  it('laesst die Achse mit der Zeichenbreite wachsen', () => {
    const schmal = macheAchse(12, 1000);
    const breit = macheAchse(12, 1400);
    expect(breit.mw).toBeGreaterThan(schmal.mw);
    expect(breit.plotRight).toBe(1400 - 16);
    // Der Ursprung bleibt fix: M1 liegt in beiden Fällen auf derselben Kante.
    expect(breit.x(1)).toBe(schmal.x(1));
  });

  it('bleibt ohne Breitenangabe beim festen Mass', () => {
    expect(macheAchse(12).plotRight).toBe(macheAchse(12, GANTT_W).plotRight);
  });
});

describe('Kosten-Segmente', () => {
  it('erzeugt fuer den Dummy fuenf Segmente', () => {
    const s = baueKostenSegmente(DUMMY.kosten);
    expect(s.map(x => x.key)).toEqual(['personal', 'dritte', 'fue', 'temp', 'uebrige']);
  });

  it('summiert die Anteile auf 1', () => {
    const s = baueKostenSegmente(DUMMY.kosten);
    expect(s.reduce((a, b) => a + b.anteil, 0)).toBeCloseTo(1, 10);
  });

  it('summiert die Betraege auf die Gesamtkosten', () => {
    const s = baueKostenSegmente(DUMMY.kosten);
    expect(s.reduce((a, b) => a + b.betrag, 0)).toBe(111730);
    expect(summenAbweichung(DUMMY.kosten, s)).toBeNull();
  });

  it('faerbt den groessten Posten am kraeftigsten', () => {
    const s = baueKostenSegmente(DUMMY.kosten);
    const staerkste = s.reduce((a, b) => (b.deckkraft > a.deckkraft ? b : a));
    expect(staerkste.key).toBe('personal');
    expect(s.every(x => x.deckkraft > 0 && x.deckkraft <= 1)).toBe(true);
  });

  it('laesst Kostenarten ohne Wert und mit 0 EUR weg', () => {
    const kosten = { ...DUMMY.kosten, dritte: null, fue: 0 };
    expect(baueKostenSegmente(kosten).map(x => x.key)).toEqual(['personal', 'temp', 'uebrige']);
  });

  it('liefert leere Liste statt NaN, wenn keine Kosten erfasst sind', () => {
    const leer: MapKosten = {
      personal: null, dritte: null, fue: null, temp: null, uebrige: null,
      gesamt: null, beantragteZuwendung: null, foerdersatz: null, foerdersatzQuelle: null,
    };
    expect(baueKostenSegmente(leer)).toEqual([]);
    expect(summenAbweichung(leer, [])).toBeNull();
  });

  it('meldet eine Abweichung zur ausgewiesenen Gesamtsumme', () => {
    const kosten = { ...DUMMY.kosten, gesamt: 100000 };
    expect(summenAbweichung(kosten, baueKostenSegmente(kosten))).toBe(11730);
  });
});
