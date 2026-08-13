/**
 * Regression (Wurzel „Spaltenname ≠ Spaltenidentität"): alle vier Parse-Wege
 * trimmen die Kopfzeile (`fields.map(h => h.trim())`), PapaParse legt die
 * Zeilen-Objekte aber unter dem UNGETRIMMTEN Namen ab. `normalizeRow` suchte
 * mit dem getrimmten Schlüssel — ein einziges Leerzeichen im Export-Header
 * machte damit jede Zelle dieser Spalte leer, ohne Fehler und ohne Warnung.
 *
 * Trifft es eine Inhaltsspalte, verliert der Bestand still ein Feld; trifft es
 * die Join-Spalte, hat keine Zeile mehr einen Join-Wert — der Guard aus v4.9.0
 * greift dann nicht (er prüft die getrimmte KOPFZEILE, und die enthält die
 * Spalte ja).
 */
import { describe, it, expect } from 'vitest';
import { parseCsvPreview, parseCsvAll, parseCsvAllStreamed, parseCsvStream } from '../parser';

// Zwei Spalten mit Whitespace im Kopf: führend und nachgestellt.
const CSV = 'FKZ ;TITEL; ORT\n16EP0001;Alpha;Musterstadt\n16EP0002;Beta;Andernorts\n';
const blob = (t: string): Blob => new Blob([t], { type: 'text/csv' });

describe('Parser — Whitespace in der Kopfzeile', () => {
  it('liefert die Werte unter dem getrimmten Spaltennamen (parseCsvAll)', async () => {
    const { headers, rows } = await parseCsvAll(blob(CSV), { encoding: 'UTF-8', separator: ';' });

    expect(headers).toEqual(['FKZ', 'TITEL', 'ORT']);
    expect(rows[0]).toEqual({ FKZ: '16EP0001', TITEL: 'Alpha', ORT: 'Musterstadt' });
    expect(rows[1]?.FKZ).toBe('16EP0002');
  });

  it('gilt ebenso für die Vorschau (parseCsvPreview)', async () => {
    const { rows } = await parseCsvPreview(blob(CSV), 5, { encoding: 'UTF-8', separator: ';' });

    expect(rows[0]?.FKZ).toBe('16EP0001');
    expect(rows[0]?.ORT).toBe('Musterstadt');
  });

  it('gilt ebenso für den gestreamten Voll-Parse (parseCsvAllStreamed)', async () => {
    const { rows } = await parseCsvAllStreamed(blob(CSV), { encoding: 'UTF-8', separator: ';' });

    expect(rows[0]?.FKZ).toBe('16EP0001');
    expect(rows[1]?.ORT).toBe('Andernorts');
  });

  it('gilt ebenso für den Chunk-Stream (parseCsvStream)', async () => {
    const gesehen: Record<string, string>[] = [];
    await parseCsvStream(blob(CSV), {
      encoding: 'UTF-8', separator: ';',
      onChunk: (chunk) => { gesehen.push(...chunk); },
    });

    expect(gesehen[0]?.FKZ).toBe('16EP0001');
  });

  it('lässt eine saubere Kopfzeile unverändert (Gegenprobe)', async () => {
    const { headers, rows } = await parseCsvAll(
      blob('FKZ;TITEL\n16EP0001;Alpha\n'), { encoding: 'UTF-8', separator: ';' },
    );

    expect(headers).toEqual(['FKZ', 'TITEL']);
    expect(rows[0]).toEqual({ FKZ: '16EP0001', TITEL: 'Alpha' });
  });
});
