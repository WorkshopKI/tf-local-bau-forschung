/**
 * Die Anzeige-Kette für Datumswerte.
 *
 * Der Anlass: im Alle-Felder-Panel und in der Chronik standen ISO-Rohwerte
 * (`2026-07-08`) neben deutschen (`08.07.2026`) — in derselben Liste, weil die
 * alte Regel nur formatierte, wenn der FELDNAME auf `datum` endete. Die Zusage
 * hier lautet deshalb: **gleicher Tag, gleiche Anzeige, egal in welchem Format
 * er in der Spalte steht** — und alles, was kein Datum ist, bleibt unangetastet.
 */
import { describe, it, expect } from 'vitest';
import { formatDatumsWert, parseGermanDate, formatGermanDate } from '../dateParse';

describe('formatDatumsWert — ein Tag, eine Anzeige', () => {
  it('liefert für ISO und deutsches Format dieselbe Zeichenkette', () => {
    expect(formatDatumsWert('2026-07-08')).toBe('08.07.2026');
    expect(formatDatumsWert('08.07.2026')).toBe('08.07.2026');
    expect(formatDatumsWert('2026-07-08')).toBe(formatDatumsWert('08.07.2026'));
  });

  it('nimmt auch ISO-Zeitstempel und einstellige Tage/Monate', () => {
    expect(formatDatumsWert('2026-04-19T03:00:00')).toBe('19.04.2026');
    expect(formatDatumsWert('2026-4-9')).toBe('09.04.2026');
    expect(formatDatumsWert('9.4.2026')).toBe('09.04.2026');
    expect(formatDatumsWert('9.4.26')).toBe('09.04.2026');
  });

  it('trimmt, bevor es parst', () => {
    expect(formatDatumsWert('  2026-07-08  ')).toBe('08.07.2026');
  });

  it('lässt alles unverändert, was kein reiner Datumswert ist', () => {
    // Genau das schützt Aktenzeichen, Kürzel-Texte und Freitext mit Datum darin.
    for (const roh of [
      'ZKN113523', 'KK 1234567 AB0', '76', 'bewilligt',
      'Antrag ging am 08.07.2026 ein', '2026-07', '2026',
    ]) {
      expect(formatDatumsWert(roh)).toBe(roh);
    }
  });

  it('macht aus leer nichts — nicht „—", das entscheidet die Anzeige', () => {
    expect(formatDatumsWert('')).toBe('');
    expect(formatDatumsWert(null)).toBe('');
    expect(formatDatumsWert(undefined)).toBe('');
  });

  it('ist idempotent: zweimal formatiert bleibt gleich', () => {
    const einmal = formatDatumsWert('2026-07-08');
    expect(formatDatumsWert(einmal)).toBe(einmal);
  });

  it('ist genau die Verkettung von parseGermanDate und formatGermanDate', () => {
    // Damit die Kette nicht heimlich ein drittes Verhalten bekommt.
    for (const roh of ['2026-07-08', '08.07.2026', '2026-04-19T03:00:00']) {
      expect(formatDatumsWert(roh)).toBe(formatGermanDate(parseGermanDate(roh)));
    }
  });
});
