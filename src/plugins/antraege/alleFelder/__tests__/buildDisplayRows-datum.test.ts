/**
 * Datumsdarstellung im Alle-Felder-Panel.
 *
 * Vor v2.382 formatierte das Panel nur, wenn der FELDNAME auf `datum` endete und
 * der Wert reines ISO war. Alles andere — `laufzeitende`, die `D_`-Kürzelspalten,
 * `*_am`, ISO-Zeitstempel — stand roh daneben; in derselben Liste lasen sich
 * `2026-07-08` und `08.07.2026` untereinander.
 *
 * Zweite Falle: uneinheitliche Verbund-Werte kommen als `„a / b"` aus
 * `mergeAntraegeForDisplay` und sind als Ganzes kein Datum.
 */
import { describe, it, expect } from 'vitest';
import { buildDisplayRows } from '../buildDisplayRows';
import type { Antrag } from '@/core/services/csv/types';

function wert(felder: Record<string, unknown>): (key: string) => string | undefined {
  const rows = buildDisplayRows({
    aktenzeichen: 'KK1234567AB0', programm_id: 'p1', ...felder,
  } as unknown as Antrag);
  return (key: string) => rows.find(r => r.field === key)?.value;
}

describe('Alle-Felder-Panel — ein Datumsformat', () => {
  it('formatiert unabhängig vom Feldnamen', () => {
    const v = wert({
      antragsdatum: '2026-07-08',
      laufzeitende: '2026-12-31',
      d_aae: '2025-03-01',
      bewilligt_am: '2026-01-15',
    });
    expect(v('antragsdatum')).toBe('08.07.2026');
    expect(v('laufzeitende')).toBe('31.12.2026');
    expect(v('d_aae')).toBe('01.03.2025');
    expect(v('bewilligt_am')).toBe('15.01.2026');
  });

  it('zeigt denselben Tag gleich, egal in welchem Format er in der Spalte steht', () => {
    const v = wert({ a_iso: '2026-07-08', b_de: '08.07.2026', c_zeit: '2026-07-08T03:00:00' });
    expect(v('a_iso')).toBe('08.07.2026');
    expect(v('b_de')).toBe('08.07.2026');
    expect(v('c_zeit')).toBe('08.07.2026');
  });

  it('formatiert uneinheitliche Verbund-Werte teilweise — wenn ALLE Teile Daten sind', () => {
    const v = wert({
      laufzeitbeginn: '2025-08-29 / 2025-09-01',
      // Gemischt geschrieben: der deutsche Teil ändert sich nicht, das darf die
      // Zeile nicht zurück auf roh kippen.
      gemischt: '2025-08-29 / 01.09.2025',
    });
    expect(v('laufzeitbeginn')).toBe('29.08.2025 / 01.09.2025');
    expect(v('gemischt')).toBe('29.08.2025 / 01.09.2025');
  });

  it('lässt Nicht-Daten mit „ / " unangetastet', () => {
    const v = wert({
      branche: 'KMU / Universitäten/Hochschulen',
      adresse: 'Am Sonnenhügel 1 / Kaiserin-Augusta-Allee 104',
      halb: '2025-08-29 / offen',
    });
    expect(v('branche')).toBe('KMU / Universitäten/Hochschulen');
    expect(v('adresse')).toBe('Am Sonnenhügel 1 / Kaiserin-Augusta-Allee 104');
    // Ein Teil ist kein Datum ⇒ die ganze Zeichenkette bleibt, wie sie ist.
    expect(v('halb')).toBe('2025-08-29 / offen');
  });

  it('fasst Aktenzeichen und Zahlen-Strings nicht als Datum auf', () => {
    const v = wert({ vorgang: 'ZKN113523', jahr: '2026', monat: '2026-07' });
    expect(v('vorgang')).toBe('ZKN113523');
    expect(v('jahr')).toBe('2026');
    expect(v('monat')).toBe('2026-07');
  });
});
