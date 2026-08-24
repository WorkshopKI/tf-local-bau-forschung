import { describe, it, expect } from 'vitest';
import {
  pdfStrukturSeiteZuMarkdown,
  type PdfMarkiertesElement,
  type PdfStrukturKnoten,
} from '../pdf-struktur';

/** Blatt-Knoten, das auf Marked Content zeigt. */
const blatt = (id: string): PdfStrukturKnoten => ({ type: 'content', id });
/** Struktur-Knoten mit Rolle. */
const k = (role: string, ...children: PdfStrukturKnoten[]): PdfStrukturKnoten => ({ role, children });

/** Ein markierter Textabschnitt im Textstrom (begin … str … end). */
function mc(id: string | null, ...texte: string[]): PdfMarkiertesElement[] {
  return [
    { type: 'beginMarkedContentProps', ...(id === null ? {} : { id }) },
    ...texte.map(str => ({ str })),
    { type: 'endMarkedContent' },
  ];
}

describe('pdfStrukturSeiteZuMarkdown — Gliederung aus dem PDF-Tag-Baum', () => {
  it('macht aus H1/H2 echte Markdown-Überschriften', () => {
    const baum = k('Root', k('Document',
      k('H1', blatt('mc0')),
      k('P', blatt('mc1')),
      k('H2', blatt('mc2')),
    ));
    const items = [
      ...mc('mc0', '2 Projektgegenstand'),
      ...mc('mc1', 'Das Kernziel des Vorhabens ist …'),
      ...mc('mc2', '3.1 Prognosefähigkeit'),
    ];
    expect(pdfStrukturSeiteZuMarkdown(baum, items)).toBe(
      '# 2 Projektgegenstand\n\nDas Kernziel des Vorhabens ist …\n\n## 3.1 Prognosefähigkeit',
    );
  });

  it('hält zwei benachbarte Absätze auseinander (Knoten-Identität, nicht Rolle)', () => {
    const baum = k('Root', k('Document', k('P', blatt('a')), k('P', blatt('b'))));
    const md = pdfStrukturSeiteZuMarkdown(baum, [...mc('a', 'Erster.'), ...mc('b', 'Zweiter.')]);
    expect(md).toBe('Erster.\n\nZweiter.');
  });

  it('wirft Artefakte weg — die Kopfzeile steht in keinem Tag', () => {
    const baum = k('Root', k('Document', k('P', blatt('mc1'))));
    const items = [
      ...mc(null, 'Projektbeschreibung ZIM Einzelprojekt'), // Kopfzeile: Marker OHNE Id
      ...mc('mc1', 'Der eigentliche Absatz.'),
      ...mc('unbekannt', 'Seite 5'),                        // Id, die im Baum fehlt
    ];
    const md = pdfStrukturSeiteZuMarkdown(baum, items);
    expect(md).toBe('Der eigentliche Absatz.');
    expect(md).not.toContain('Projektbeschreibung');
    expect(md).not.toContain('Seite 5');
  });

  it('setzt L/LI/Lbl/LBody als Aufzählung, nummerierte Marken als geordnete Liste', () => {
    const baum = k('Root', k('Document', k('L',
      k('LI', k('Lbl', blatt('l0')), k('LBody', blatt('b0'))),
      k('LI', k('Lbl', blatt('l1')), k('LBody', blatt('b1'))),
    )));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('l0', '1.'), ...mc('b0', 'Adaptive Algorithmen'),
      ...mc('l1', '2.'), ...mc('b1', 'Sichere Architektur'),
    ]);
    expect(md).toBe('1. Adaptive Algorithmen\n2. Sichere Architektur');
  });

  it('rückt geschachtelte Listen ein', () => {
    const baum = k('Root', k('Document', k('L',
      k('LI', k('Lbl', blatt('l0')), k('LBody', blatt('b0'), k('L',
        k('LI', k('Lbl', blatt('l1')), k('LBody', blatt('b1'))),
      ))),
    )));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('l0', '•'), ...mc('b0', 'Oben'),
      ...mc('l1', '•'), ...mc('b1', 'Darunter'),
    ]);
    expect(md).toContain('- Oben');
    expect(md).toContain('  - Darunter');
  });

  it('baut aus Table/THead/TR/TH/TD eine Pipe-Tabelle', () => {
    const baum = k('Root', k('Document', k('Table',
      k('THead', k('TR', k('TH', blatt('h0')), k('TH', blatt('h1')))),
      k('TBody',
        k('TR', k('TD', blatt('c0')), k('TD', blatt('c1'))),
        k('TR', k('TD', blatt('c2')), k('TD', blatt('c3'))),
      ),
    )));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('h0', 'AP'), ...mc('h1', 'Bezeichnung'),
      ...mc('c0', '1'), ...mc('c1', 'Analyse'),
      ...mc('c2', '2'), ...mc('c3', 'Aufbau'),
    ]);
    expect(md).toBe('| AP | Bezeichnung |\n| --- | --- |\n| 1 | Analyse |\n| 2 | Aufbau |');
  });

  it('setzt ein getaggtes Inhaltsverzeichnis (TOC/TOCI) als Liste', () => {
    const baum = k('Root', k('Document', k('TOC',
      k('TOCI', blatt('t0')), k('TOCI', blatt('t1')),
    )));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('t0', '1 Ausgangssituation'), ...mc('t1', '2 Projektgegenstand'),
    ]);
    // Entscheidend ist der Listen-Strich: ohne ihn liest die Gliederungs-
    // Erkennung jede IHV-Zeile als eigenes Kapitel.
    expect(md).toBe('- 1 Ausgangssituation\n- 2 Projektgegenstand');
    expect(md).not.toMatch(/^\d/m);
  });

  it('setzt auch ein UNGETAGGTES Inhaltsverzeichnis als Liste — Absatz ganz im Link', () => {
    const baum = k('Root', k('Document',
      k('P', k('Link', blatt('v0'))),
      k('P', k('Link', blatt('v1'))),
    ));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('v0', '7.2.1 Technische Realisierbarkeit'),
      ...mc('v1', '8 Fachliche Eignung'),
    ]);
    expect(md).toBe('- 7.2.1 Technische Realisierbarkeit\n- 8 Fachliche Eignung');
  });

  it('lässt einen Absatz MIT Link darin ein Absatz — nur ganz-im-Link ist ein Verweis', () => {
    const baum = k('Root', k('Document', k('P', blatt('p0'), k('Link', blatt('p1')), blatt('p2'))));
    const md = pdfStrukturSeiteZuMarkdown(baum, [
      ...mc('p0', 'Details stehen in '), ...mc('p1', 'Kapitel 4'), ...mc('p2', ' und danach.'),
    ]);
    expect(md).toBe('Details stehen in Kapitel 4 und danach.');
    expect(md).not.toContain('- ');
  });

  it('macht aus einer verlinkten Überschrift keine Listenzeile', () => {
    const baum = k('Root', k('Document', k('H1', k('Link', blatt('h')))));
    expect(pdfStrukturSeiteZuMarkdown(baum, mc('h', 'Anlage 5'))).toBe('# Anlage 5');
  });

  it('ohne Baum (ungetaggtes PDF) kommt nichts zurück — der Aufrufer fällt zurück', () => {
    expect(pdfStrukturSeiteZuMarkdown(null, mc('x', 'Text'))).toBe('');
    expect(pdfStrukturSeiteZuMarkdown(k('Root'), mc('x', 'Text'))).toBe('');
  });
});
