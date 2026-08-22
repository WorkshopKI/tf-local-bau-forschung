import { describe, it, expect } from 'vitest';
import { pickVb, pickAktiveVb } from '../vbDokument';
import type { DocumentFull } from '@/plugins/dokumente/store';
import type { OrdnerVb } from '@/core/services/personal-storage/antraege-eingang';

const idbDoc = { markdown: 'AUS IDB', tags: ['vorhabensbeschreibung'] } as unknown as DocumentFull;
const ordner: OrdnerVb = { markdown: 'AUS ORDNER', quelle: 'VB.pdf', fkz: '16EP1', konvertiert_am: '2026-06-11T10:00:00.000Z' };

describe('pickVb — IDB hat Vorrang', () => {
  it('IDB-Treffer gewinnt, Ordner wird ignoriert', () => {
    const r = pickVb(idbDoc, ordner);
    expect(r).toEqual({ markdown: 'AUS IDB', herkunft: 'idb', dokument: idbDoc });
  });
  it('ohne IDB → Ordner-Fallback', () => {
    const r = pickVb(null, ordner);
    expect(r?.herkunft).toBe('ordner');
    expect(r?.markdown).toBe('AUS ORDNER');
    expect(r?.quelleName).toBe('VB.pdf');
    expect(r?.dokument).toBeNull();
  });
  it('beides leer → null', () => {
    expect(pickVb(null, null)).toBeNull();
  });
});

/** VB-Kandidat mit steuerbarem Tag-Satz (Default: VB-getaggt). */
const vbDoc = (id: string, created: string, filename = `${id}.pdf`, tags = ['vorhabensbeschreibung']): DocumentFull =>
  ({ id, created, filename, tags, markdown: `INHALT ${id}` }) as unknown as DocumentFull;

describe('pickAktiveVb — expliziter Pick vor „jüngstes gewinnt"', () => {
  it('ohne Pick gewinnt bei gleichem Format das jüngste Dokument', () => {
    const docs = [vbDoc('a', '2026-07-01T10:00:00.000Z'), vbDoc('b', '2026-07-03T10:00:00.000Z')];
    expect(pickAktiveVb(docs, null)?.id).toBe('b');
  });

  it('expliziter Pick gewinnt über „jüngstes"', () => {
    const docs = [vbDoc('a', '2026-07-01T10:00:00.000Z'), vbDoc('b', '2026-07-03T10:00:00.000Z')];
    expect(pickAktiveVb(docs, 'a')?.id).toBe('a');
  });

  it('Pick auf ein gelöschtes Dokument → Fallback auf „jüngstes", kein Throw', () => {
    const docs = [vbDoc('a', '2026-07-01T10:00:00.000Z'), vbDoc('b', '2026-07-03T10:00:00.000Z')];
    expect(pickAktiveVb(docs, 'weg')?.id).toBe('b');
  });

  it('Pick auf ein nicht mehr VB-getaggtes Dokument → Fallback (Kandidatenliste ist vorgefiltert)', () => {
    // 'a' wurde auf `arbeitsplan` umgetaggt und ist damit kein Kandidat mehr.
    const docs = [vbDoc('b', '2026-07-03T10:00:00.000Z')];
    expect(pickAktiveVb(docs, 'a')?.id).toBe('b');
  });

  it('gleicher created-Zeitstempel → deterministischer Tie-Break über den Dateinamen', () => {
    const gleich = '2026-07-03T10:00:00.000Z';
    const vorwaerts = [vbDoc('x', gleich, 'anlage.pdf'), vbDoc('y', gleich, 'beschreibung.pdf')];
    const rueckwaerts = [vbDoc('y', gleich, 'beschreibung.pdf'), vbDoc('x', gleich, 'anlage.pdf')];
    expect(pickAktiveVb(vorwaerts, null)?.id).toBe('x');
    expect(pickAktiveVb(rueckwaerts, null)?.id).toBe('x'); // Eingabereihenfolge egal
  });

  it('keine Kandidaten → null', () => {
    expect(pickAktiveVb([], null)).toBeNull();
    expect(pickAktiveVb([], 'irgendwas')).toBeNull();
  });

  it('Bug-Reproduktion: drei VB-getaggte Dokumente, der Pick entscheidet statt des Zufalls', () => {
    // Genau der gemeldete Fall: „Markteinführungskonzept", „Projektbeschreibung" und
    // „Wirkung" landen alle auf dem VB-Default; ohne Pick gewinnt, wer zufällig zuletzt
    // fertig konvertiert war.
    const docs = [
      vbDoc('markt', '2026-07-21T10:00:01.000Z', 'Markteinfuehrungskonzept.pdf'),
      vbDoc('projekt', '2026-07-21T10:00:02.000Z', 'Projektbeschreibung.pdf'),
      vbDoc('wirkung', '2026-07-21T10:00:03.000Z', 'Wirkung.pdf'),
    ];
    expect(pickAktiveVb(docs, null)?.id).toBe('wirkung'); // heute: willkürlich der letzte
    expect(pickAktiveVb(docs, 'projekt')?.id).toBe('projekt'); // mit Pick: der gewollte
  });
});

/**
 * Gemessen am 22.08.2026 an derselben VB, beide Fassungen durch den `DocConverter`:
 * DOCX 44 Überschriften und 80 Fettauszeichnungen, PDF null und null. Ohne
 * Überschriften kann die Relevanz-Map keine Abschnitts-Spans bilden.
 */
describe('pickAktiveVb — DOCX schlägt PDF, weil PDF die Struktur verliert', () => {
  it('DOCX gewinnt gegen ein gleich altes PDF — auch wenn der Dateiname dagegen spricht', () => {
    // Dateinamen bewusst gegenläufig: nach dem alten Tie-Break hätte „anlage.pdf" gewonnen.
    const gleich = '2026-07-03T10:00:00.000Z';
    const docs = [vbDoc('pdf', gleich, 'anlage.pdf'), vbDoc('docx', gleich, 'zusammenfassung.docx')];
    expect(pickAktiveVb(docs, null)?.id).toBe('docx');
  });

  it('DOCX gewinnt AUCH gegen ein neueres PDF — der bewusst in Kauf genommene Fall', () => {
    const docs = [
      vbDoc('docx', '2026-07-01T10:00:00.000Z', 'VB.docx'),
      vbDoc('pdf', '2026-07-09T10:00:00.000Z', 'VB-neu.pdf'),
    ];
    expect(pickAktiveVb(docs, null)?.id).toBe('docx');
  });

  it('der explizite Pick des Bearbeiters überstimmt die Format-Regel', () => {
    const docs = [
      vbDoc('docx', '2026-07-01T10:00:00.000Z', 'VB.docx'),
      vbDoc('pdf', '2026-07-09T10:00:00.000Z', 'VB-neu.pdf'),
    ];
    expect(pickAktiveVb(docs, 'pdf')?.id).toBe('pdf');
  });

  it('unter mehreren DOCX entscheidet weiter das Datum', () => {
    const docs = [
      vbDoc('alt', '2026-07-01T10:00:00.000Z', 'VB.docx'),
      vbDoc('neu', '2026-07-09T10:00:00.000Z', 'VB2.docx'),
      vbDoc('pdf', '2026-07-20T10:00:00.000Z', 'VB.pdf'),
    ];
    expect(pickAktiveVb(docs, null)?.id).toBe('neu');
  });

  it('nur PDFs: alles bleibt wie bisher (jüngstes, dann Dateiname)', () => {
    const gleich = '2026-07-03T10:00:00.000Z';
    expect(pickAktiveVb([vbDoc('y', gleich, 'b.pdf'), vbDoc('x', gleich, 'a.pdf')], null)?.id).toBe('x');
  });

  it('.doc zählt wie .docx, unbekannte Endungen wie PDF', () => {
    const gleich = '2026-07-03T10:00:00.000Z';
    expect(pickAktiveVb([vbDoc('pdf', gleich, 'anlage.pdf'), vbDoc('doc', gleich, 'zzz.doc')], null)?.id).toBe('doc');
    expect(pickAktiveVb([vbDoc('md', gleich, 'anlage.md'), vbDoc('docx', gleich, 'zzz.docx')], null)?.id).toBe('docx');
  });
});
