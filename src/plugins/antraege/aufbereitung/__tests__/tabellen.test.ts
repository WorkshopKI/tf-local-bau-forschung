import { describe, it, expect } from 'vitest';
import {
  parsePipeTabellen, klassifiziereTabelle, ernteTabellen,
  normalisiereAnlage5, normalisiereZeitplanText, verglichZeitplaene, parseMonatRange,
  type ApZeile,
} from '../tabellen';

describe('parsePipeTabellen', () => {
  it('findet mehrere Tabellen, tolerant gegen fehlende Rand-Pipes und Escapes', () => {
    const md = [
      'Vorspann.',
      '',
      '| A | B |',
      '| --- | --- |',
      '| a \\| x | b |',
      '',
      'Zwischentext',
      '',
      'c | d | e',
      '--- | --- | ---',
      '1 | 2 | 3',
      '4 | 5 | 6',
    ].join('\n');
    const ts = parsePipeTabellen(md);
    expect(ts).toHaveLength(2);
    expect(ts[0]!.header).toEqual(['A', 'B']);
    expect(ts[0]!.rows).toEqual([['a | x', 'b']]); // Escape-Pipe bleibt Zelleninhalt
    expect(ts[1]!.header).toEqual(['c', 'd', 'e']);
    expect(ts[1]!.rows).toEqual([['1', '2', '3'], ['4', '5', '6']]);
    // Span verankert die erste Tabelle im Original.
    expect(md.slice(ts[0]!.start, ts[0]!.end)).toContain('| A | B |');
  });
});

describe('klassifiziereTabelle', () => {
  const klasse = (header: string): string =>
    klassifiziereTabelle({ header: header.split('|').map(s => s.trim()), rows: [], start: 0, end: 0 });

  it('anlage5 inkl. Grenzfälle (:AP, MA Nr ohne Punkt)', () => {
    expect(klasse('AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM')).toBe('anlage5');
    expect(klasse(':AP | Bezeichnung | Beginn | Ende | MA Nr. | Aufwand PM')).toBe('anlage5');
  });

  it('ap-zeitplan-text: getrennte Monatsspalten UND Laufzeit-Range-Form', () => {
    expect(klasse('Arbeitspaket | Monat Beginn | Monat Ende | Dauer (Monate)')).toBe('ap-zeitplan-text');
    expect(klasse('AP | Bezeichnung | Laufzeit | Ziele | Ergebnisse | Aufwand')).toBe('ap-zeitplan-text');
  });

  it('risiko, ap-taetigkeiten, auftraege-dritte, unbekannt', () => {
    expect(klasse('Risiko | Beschreibung | Gegenmaßnahme')).toBe('risiko');
    expect(klasse('AP | Tätigkeiten | Ergebnisse')).toBe('ap-taetigkeiten');
    expect(klasse('Lfd. Nr. | Auftragnehmer | Leistung | Kosten')).toBe('auftraege-dritte');
    expect(klasse('Feld | Angabe')).toBe('unbekannt');
  });
});

describe('normalisiereAnlage5', () => {
  const t = parsePipeTabellen([
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Konzept | 01.01.2023 | 28.02.2023 | MA01 | 2 |',
    '| 3 | Entwicklung des Prototyps |  |  |  |  |',
    '| 3.1 | Kernfunktionen | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
    '| 3.2 | Erweiterte Funktionen | 16.04.2023 | 30.04.2023 | MA03 | 3 |',
  ].join('\n'))[0]!;

  it('M1 = frühester Beginn; Ober-AP-Gruppenzeile ohne Monate; Unter-APs erkannt', () => {
    const z = normalisiereAnlage5(t);
    expect(z.map(x => x.nummer)).toEqual(['1', '3', '3.1', '3.2']);
    // 01.01.2023 = M1, 01.04.2023 = M4.
    expect(z[0]).toMatchObject({ monatStart: 1, monatEnde: 2, pm: 2, maNr: 'MA01', istUnterAp: false });
    expect(z[1]).toMatchObject({ nummer: '3', istUnterAp: false, monatStart: undefined, monatEnde: undefined });
    expect(z[2]).toMatchObject({ nummer: '3.1', istUnterAp: true, monatStart: 4, monatEnde: 4, pm: 4 });
  });
});

describe('normalisiereZeitplanText', () => {
  it('Laufzeit-Range-Form (Monat 1–4) → monatStart/monatEnde; kein PM aus „Aufwand"', () => {
    const t = parsePipeTabellen([
      '| AP | Bezeichnung | Laufzeit | Ziele | Ergebnisse | Aufwand |',
      '| --- | --- | --- | --- | --- | --- |',
      '| AP1 | Datenbeschaffung | Monat 1–4 | z | e | 500 |',
      '| AP2 | KI-Kernmodell | Monat 3–8 (Sept–Feb) | z | e | 600 |',
    ].join('\n'))[0]!;
    const z = normalisiereZeitplanText(t);
    expect(z[0]).toMatchObject({ nummer: '1', bezeichnung: 'Datenbeschaffung', monatStart: 1, monatEnde: 4, pm: undefined });
    expect(z[1]).toMatchObject({ nummer: '2', monatStart: 3, monatEnde: 8 });
  });

  it('getrennte Monat-Beginn/Ende-Spalten; Zeile ohne AP-Nummer → laufende Nummer', () => {
    const t = parsePipeTabellen([
      '| Arbeitspaket | Monat Beginn | Monat Ende | Dauer (Monate) |',
      '| --- | --- | --- | --- |',
      '| Entwicklung des Prototyps | 3 | 5 | 3 |',
    ].join('\n'))[0]!;
    const z = normalisiereZeitplanText(t);
    expect(z[0]).toMatchObject({ nummer: '1', bezeichnung: 'Entwicklung des Prototyps', monatStart: 3, monatEnde: 5 });
  });
});

describe('parseMonatRange', () => {
  it('erkennt Range- und Einzelmonat-Formen', () => {
    expect(parseMonatRange('Monat 1–4')).toEqual({ start: 1, ende: 4 });
    expect(parseMonatRange('M3-5')).toEqual({ start: 3, ende: 5 });
    expect(parseMonatRange('7 bis 14')).toEqual({ start: 7, ende: 14 });
    expect(parseMonatRange('Monat 6 (Juni 2024)')).toEqual({ start: 6, ende: 6 });
  });
});

describe('verglichZeitplaene', () => {
  it('echter Diskrepanzfall Text vs. Anlage 5 → zeitraum-abweichung', () => {
    const anlage = normalisiereAnlage5(parsePipeTabellen([
      '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 1 | Konzept | 01.01.2023 | 28.02.2023 | MA01 | 2 |',
      '| 3 | Entwicklung des Prototyps |  |  |  |  |',
      '| 3.1 | Kernfunktionen | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
      '| 3.2 | Erweiterte Funktionen | 16.04.2023 | 30.04.2023 | MA03 | 3 |',
    ].join('\n'))[0]!);
    const text = normalisiereZeitplanText(parsePipeTabellen([
      '| Arbeitspaket | Monat Beginn | Monat Ende | Dauer (Monate) |',
      '| --- | --- | --- | --- |',
      '| Entwicklung des Prototyps | 3 | 5 | 3 |',
    ].join('\n'))[0]!);

    const befunde = verglichZeitplaene(text, anlage);
    const abw = befunde.find(b => b.typ === 'zeitraum-abweichung');
    expect(abw).toBeDefined();
    expect(abw!.schwere).toBe('warnung');
    expect(abw!.text).toContain('Entwicklung des Prototyps');
    expect(abw!.text).toContain('M3–M5'); // Text-Angabe
    expect(abw!.text).toContain('M4');    // Anlage-5-Angabe (aggregiert aus 3.1/3.2)
    expect(abw!.quellen.map(q => q.rolle)).toEqual(['vb', 'anlage5']);
    // Konzept steht nur in Anlage 5.
    expect(befunde.some(b => b.typ === 'nur-in-anlage' && b.text.includes('Konzept'))).toBe(true);
  });

  it('unterschiedlicher Horizont → horizont-Befund', () => {
    const text: ApZeile[] = [{ nummer: '1', bezeichnung: 'Marktvorbereitung', istUnterAp: false, monatStart: 1, monatEnde: 18 }];
    const anlage: ApZeile[] = [{ nummer: '1', bezeichnung: 'Konzept', istUnterAp: false, monatStart: 1, monatEnde: 6 }];
    const befunde = verglichZeitplaene(text, anlage);
    const hor = befunde.find(b => b.typ === 'horizont');
    expect(hor).toBeDefined();
    expect(hor!.text).toContain('M18');
    expect(hor!.text).toContain('M6');
    expect(befunde.some(b => b.typ === 'nur-im-text')).toBe(true);
    expect(befunde.some(b => b.typ === 'nur-in-anlage')).toBe(true);
  });

  it('ernteTabellen führt Unbekanntes mit (verwirft nichts)', () => {
    const md = ['| Feld | Angabe |', '| --- | --- |', '| Antragsteller | X GmbH |'].join('\n');
    expect(ernteTabellen(md).map(t => t.klasse)).toEqual(['unbekannt']);
  });
});
