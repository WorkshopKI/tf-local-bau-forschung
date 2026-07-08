import { describe, it, expect } from 'vitest';
import { parseVbGliederung } from '../gliederung';

describe('parseVbGliederung', () => {
  it('saubere H1–H3-Struktur: Ebenen, IDs, quelle und lückenlose Spans', () => {
    const md = [
      '# 1 Einleitung',
      'Text A',
      '## 1.1 Motivation',
      'Text B',
      '### 1.1.1 Detail',
      'Text C',
      '# 2 Stand der Technik',
      'Text D',
    ].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['k-1', 'k-1.1', 'k-1.1.1', 'k-2']);
    expect(s.map(x => x.ebene)).toEqual([1, 2, 3, 1]);
    expect(s.map(x => x.titel)).toEqual(['Einleitung', 'Motivation', 'Detail', 'Stand der Technik']);
    expect(s.every(x => x.quelle === 'heading')).toBe(true);
    // Spans lückenlos + im Original verankert.
    expect(s[0]!.start).toBe(0);
    expect(s[s.length - 1]!.end).toBe(md.length);
    for (let i = 0; i + 1 < s.length; i++) expect(s[i]!.end).toBe(s[i + 1]!.start);
    expect(md.slice(s[0]!.start, s[0]!.end)).toContain('# 1 Einleitung');
    expect(md.slice(s[3]!.start, s[3]!.end)).toContain('Stand der Technik');
  });

  it('nur nummerierte Fließtext-Überschriften (Word-Styles verloren)', () => {
    const md = [
      'Projektbeschreibung ProDemo',
      '',
      '1 Ausgangssituation',
      'Beschreibung der Ausgangslage.',
      '2 Zielsetzung',
      'Die Ziele sind hoch.',
      '2.1 Teilziel A',
      'Details.',
      '3 Arbeitsplan',
      'Ablauf.',
    ].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['s-intro', 'k-1', 'k-2', 'k-2.1', 'k-3']);
    expect(s[0]!.quelle).toBe('heading'); // Vorspann
    expect(s.slice(1).every(x => x.quelle === 'nummerierung')).toBe(true);
    expect(s.map(x => x.ebene)).toEqual([1, 1, 1, 2, 1]);
    expect(md.slice(s[0]!.start, s[0]!.end)).toContain('Projektbeschreibung ProDemo');
  });

  it('Mischform: Headings + Nummerierungs-Inferenz', () => {
    const md = [
      '# Vorhabensbeschreibung',
      'Einleitender Absatz.',
      '## 1 Zielsetzung',
      'Ziele.',
      '2 Arbeitsplan',
      'Der Plan sieht vor.',
      '### 2.1 Arbeitspaket 1',
      'Inhalt.',
    ].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['s0', 'k-1', 'k-2', 'k-2.1']);
    expect(s.map(x => x.quelle)).toEqual(['heading', 'heading', 'nummerierung', 'heading']);
    expect(s.map(x => x.ebene)).toEqual([1, 2, 1, 3]);
  });

  it('IHV-Block erzeugt keine Phantom-Kapitel, sondern eine s-toc-Sektion', () => {
    const md = [
      '# Projekt XY',
      '',
      'Inhaltsverzeichnis',
      '1 Ausgangssituation ........... 3',
      '2 Zielsetzung ................. 5',
      '3 Technische Umsetzung ........ 8',
      '3.1 Teilaspekt A ............. 9',
      '3.2 Teilaspekt B ............ 11',
      '4 Marktanalyse .............. 14',
      '',
      '# 1 Ausgangssituation',
      'Echter Inhalt hier.',
      '# 2 Zielsetzung',
      'Mehr Inhalt.',
    ].join('\n');
    const s = parseVbGliederung(md);
    // s0 (Projekt XY), s-toc, k-1, k-2 — sonst nichts.
    expect(s.map(x => x.id)).toEqual(['s0', 's-toc', 'k-1', 'k-2']);
    expect(s.filter(x => x.id === 's-toc')).toHaveLength(1);
    // KEINE Phantom-Sektion für die IHV-Zeilen 3 / 3.1 / 3.2 / 4.
    expect(s.some(x => x.nummer === '3' || x.nummer === '3.1' || x.nummer === '4')).toBe(false);
    // Das IHV bleibt im s-toc-Span verankert.
    expect(md.slice(s[1]!.start, s[1]!.end)).toContain('Teilaspekt A');
  });

  it('H1-Kapitel ohne Kinder werden nicht in den Vorgänger geschluckt', () => {
    const md = ['# 1 Alpha', 'Inhalt Alpha.', '# 2 Beta', 'Inhalt Beta.', '# 3 Gamma', 'Inhalt Gamma.'].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['k-1', 'k-2', 'k-3']);
    expect(md.slice(s[0]!.start, s[0]!.end)).not.toContain('Beta');
    expect(md.slice(s[1]!.start, s[1]!.end)).toContain('Beta');
  });

  it('leeres / markerloses Dokument degradiert korrekt', () => {
    expect(parseVbGliederung('')).toEqual([]);
    expect(parseVbGliederung('   \n  \t ')).toEqual([]);
    const roh = 'Nur ein Fließtext ohne jede Überschrift. Noch ein Satz.';
    const s = parseVbGliederung(roh);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: 's-intro', ebene: 1, start: 0, end: roh.length });
  });

  it('Nummerierungs-Fehlstart: „25 Prozent …" wird KEINE Sektion (Sequenz-Plausibilität)', () => {
    const md = [
      '1 Einleitung',
      'Wir sparen Energie.',
      '25 Prozent Einsparung sind das Ziel des Vorhabens',
      'Weiterer Text.',
      '2 Hauptteil',
      'Inhalt.',
    ].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['k-1', 'k-2']);
    expect(s.some(x => x.nummer === '25')).toBe(false);
  });

  it('Nummerierungs-Zeile mit Satzpunkt-Ende wird ignoriert', () => {
    const md = ['1 Ziel', 'Fließtext.', '2. Das ist ein ganzer Satz mit Nummer am Anfang.', '2 Umsetzung', 'Inhalt.'].join('\n');
    const s = parseVbGliederung(md);
    expect(s.map(x => x.id)).toEqual(['k-1', 'k-2']);
    expect(s.map(x => x.titel)).toEqual(['Ziel', 'Umsetzung']);
  });

  it('IDs sind bei unverändertem Dokument deterministisch identisch', () => {
    const md = '# 1 A\nx\n## 1.1 B\ny\n# 2 C\nz';
    expect(parseVbGliederung(md).map(x => x.id)).toEqual(parseVbGliederung(md).map(x => x.id));
  });
});
