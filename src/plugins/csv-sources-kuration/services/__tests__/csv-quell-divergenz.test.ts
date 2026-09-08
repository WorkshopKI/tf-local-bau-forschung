/**
 * Divergenz zweier Datei-Sichten (Sept. 2026, Produktiv-Fall).
 *
 * Der Team-Stempel im Schema sagt: „die Quelle wurde in DIESER Nacht schon
 * importiert — aus einer Datei mit Checksum X". Findet ein Rechner für dieselbe
 * Nacht eine Datei mit anderem Checksum UND der Import ändert Zeilen, lesen zwei
 * Rechner verschiedene Export-Kopien. Das ist kein neuer Export (der läge eine
 * Nacht weiter), sondern ein Konfigurationsproblem — und die Ursache der
 * Import-Publish-Kette, die das Team täglich mit „neue Daten" weckte.
 */
import { describe, it, expect } from 'vitest';
import {
  istQuellDivergenz,
  istVeralteteDatei,
  teamStempelAus,
  DIVERGENZ_FENSTER_MS,
  VERALTET_SCHWELLE_MS,
  type TeamStempel,
  type DateiSicht,
} from '../csv-quell-divergenz';
import type { CsvSchema } from '@/core/services/csv/types';

// 08.09.2026 04:06:46 MESZ — der nächtliche Export.
const NACHT = Date.UTC(2026, 8, 8, 2, 6, 46);

const team: TeamStempel = {
  fileName: '7737_Bgl.csv',
  lastModified: NACHT,
  size: 10_330_438,
  checksum: 'e416a90e',
  von: 'TH PL',
};

const datei: DateiSicht = {
  name: '7737_Bgl.csv',
  lastModified: NACHT + 90_000,
  size: 10_358_986,
  checksum: '3ddcc7bf',
};

describe('istQuellDivergenz', () => {
  it('gleiche Nacht, anderer Inhalt, Import mit Änderungen → Divergenz', () => {
    expect(istQuellDivergenz(team, datei, 1094)).toBe(true);
  });

  it('ohne geänderte Zeilen keine Divergenz — dann war nur der Stempel veraltet', () => {
    expect(istQuellDivergenz(team, datei, 0)).toBe(false);
  });

  it('Team-Stempel aus der Vornacht → legitimer neuer Export, keine Divergenz', () => {
    const gestern = { ...team, lastModified: NACHT - 24 * 60 * 60 * 1000 };
    expect(istQuellDivergenz(gestern, datei, 1094)).toBe(false);
  });

  it('das Fenster ist 6 Stunden — knapp innerhalb zählt, knapp außerhalb nicht', () => {
    expect(DIVERGENZ_FENSTER_MS).toBe(6 * 60 * 60 * 1000);
    const innerhalb = { ...team, lastModified: datei.lastModified - DIVERGENZ_FENSTER_MS + 1 };
    const ausserhalb = { ...team, lastModified: datei.lastModified - DIVERGENZ_FENSTER_MS };
    expect(istQuellDivergenz(innerhalb, datei, 5)).toBe(true);
    expect(istQuellDivergenz(ausserhalb, datei, 5)).toBe(false);
  });

  it('ohne Team-Checksum oder ohne Team-Zeit gibt es kein Urteil', () => {
    expect(istQuellDivergenz({ ...team, checksum: null }, datei, 5)).toBe(false);
    expect(istQuellDivergenz({ ...team, lastModified: null }, datei, 5)).toBe(false);
  });

  it('gleicher Checksum ist keine Divergenz', () => {
    expect(istQuellDivergenz({ ...team, checksum: datei.checksum }, datei, 5)).toBe(false);
  });
});

/**
 * Der Produktiv-Beleg vom 08.09.2026: „TH PL zbook" stempelte dreimal Dateien vom
 * 21./23. August (7 945 statt 8 011 Zeilen), während vier Kollegen den Export vom
 * 8. September lasen. Jeder zbook-Start setzte den Team-Stand um 18 Tage zurück
 * (`changed 1028, heldRemovals 66`), der nächste Kollege drehte ihn wieder vor.
 * Eine Datei, die ÄLTER ist als die, die das Team schon importiert hat, ist kein
 * neuer Export — sie darf nicht automatisch importiert werden.
 */
describe('istVeralteteDatei', () => {
  const TAG = 24 * 60 * 60 * 1000;

  it('Datei 18 Tage älter als der Team-Stempel → veraltet', () => {
    const alt: DateiSicht = { ...datei, lastModified: NACHT - 18 * TAG };
    expect(istVeralteteDatei(team, alt)).toBe(true);
  });

  it('die Schwelle ist ein Export-Zyklus (24 h) — knapp darunter ist Uhr-Versatz, nicht Vergangenheit', () => {
    expect(VERALTET_SCHWELLE_MS).toBe(TAG);
    expect(istVeralteteDatei(team, { ...datei, lastModified: NACHT - TAG + 1 })).toBe(false);
    expect(istVeralteteDatei(team, { ...datei, lastModified: NACHT - TAG - 1 })).toBe(true);
  });

  it('gleiche Bytes sind nie veraltet — dann wäre gar nichts zu importieren', () => {
    expect(istVeralteteDatei(team, { ...datei, lastModified: NACHT - 18 * TAG, checksum: team.checksum! })).toBe(false);
  });

  it('ohne Team-Zeit kein Urteil', () => {
    expect(istVeralteteDatei({ ...team, lastModified: null }, { ...datei, lastModified: NACHT - 18 * TAG })).toBe(false);
  });

  it('eine neuere Datei ist der normale Tages-Export', () => {
    expect(istVeralteteDatei(team, { ...datei, lastModified: NACHT + TAG })).toBe(false);
  });
});

describe('teamStempelAus', () => {
  it('liest die Stempelfelder des Schemas, fehlende als null', () => {
    const schema = {
      id: 's', programm_id: 'p', csv_source_name: 'Q', is_master: false, join_key: 'aktenzeichen',
      priority: 1, column_mapping: {}, created_at: '2026-01-01T00:00:00.000Z',
      source_file_name: '7737_Bgl.csv', source_last_modified: NACHT, last_file_size: 1, file_checksum: 'abc',
      source_stamped_by: 'TH PL',
    } as CsvSchema;
    expect(teamStempelAus(schema)).toEqual({
      fileName: '7737_Bgl.csv', lastModified: NACHT, size: 1, checksum: 'abc', von: 'TH PL',
    });
    expect(teamStempelAus({ ...schema, source_file_name: undefined, source_last_modified: undefined,
      last_file_size: undefined, file_checksum: undefined, source_stamped_by: undefined })).toEqual({
      fileName: null, lastModified: null, size: null, checksum: null, von: null,
    });
  });
});
