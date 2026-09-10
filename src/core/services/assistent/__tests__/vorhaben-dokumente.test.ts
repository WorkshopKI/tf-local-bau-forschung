import { describe, it, expect } from 'vitest';
import type { OramaSearchResult } from '@/core/services/search/orama-store';
import {
  baueVorhabenDokumente, trefferDesVorhabens, VORHABEN_DOK_AUSZUG_MAX, VORHABEN_DOK_MAX, type RohDokument,
} from '../vorhaben-dokumente';

const VB_ID = 'ZKN116622';

function doc(filename: string, tags: string[], markdown: string): RohDokument {
  return { filename, tags, markdown };
}

const FRONT = '---\nfilename: x.pdf\nformat: pdf\n---\n\n';

describe('baueVorhabenDokumente', () => {
  it('nimmt nur Dokumente mit dem Verbund-ID-Tag', () => {
    const docs = [
      doc('vb.pdf', [VB_ID, 'vorhabensbeschreibung'], `${FRONT}VB-Text`),
      doc('fremd.pdf', ['ANDERE_ID', 'arbeitsplan'], `${FRONT}fremd`),
    ];
    const out = baueVorhabenDokumente(docs, VB_ID);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('vb.pdf');
  });

  it('leitet Typ-Label aus der Tag-Relation ab und strippt Frontmatter im Auszug', () => {
    const out = baueVorhabenDokumente(
      [doc('16KN_Anlage 5.pdf', [VB_ID, 'arbeitsplan'], `${FRONT}| AP | Titel |\n| 1 | Analyse |`)],
      VB_ID,
    );
    expect(out[0]?.typLabel).toBe('Arbeitsplan (Anlage 5)');
    expect(out[0]?.auszug.startsWith('| AP | Titel |')).toBe(true);
    expect(out[0]?.auszug).not.toContain('filename:'); // Frontmatter entfernt
  });

  it('unbekannter/fehlender Typ-Tag → „Sonstiges"', () => {
    const out = baueVorhabenDokumente([doc('x.pdf', [VB_ID], `${FRONT}rumpf`)], VB_ID);
    expect(out[0]?.typLabel).toBe('Sonstiges');
  });

  it('kappt den Auszug auf VORHABEN_DOK_AUSZUG_MAX', () => {
    const lang = 'A'.repeat(VORHABEN_DOK_AUSZUG_MAX + 200);
    const out = baueVorhabenDokumente([doc('gross.pdf', [VB_ID, 'vorhabensbeschreibung'], `${FRONT}${lang}`)], VB_ID);
    expect(out[0]?.auszug.length).toBe(VORHABEN_DOK_AUSZUG_MAX);
  });

  it('kappt die Anzahl auf VORHABEN_DOK_MAX', () => {
    const viele = Array.from({ length: VORHABEN_DOK_MAX + 5 }, (_, i) =>
      doc(`d${i}.pdf`, [VB_ID, 'sonstiges'], `${FRONT}t${i}`));
    expect(baueVorhabenDokumente(viele, VB_ID)).toHaveLength(VORHABEN_DOK_MAX);
  });

  it('kein Match → leeres Array', () => {
    expect(baueVorhabenDokumente([doc('a.pdf', ['X'], 'y')], VB_ID)).toEqual([]);
  });
});

/**
 * Der Befund (10.09.2026): „Was ist bei CALYPSO zu tun?" bekam als Auszug [1] einen
 * Chunk aus der Anlage 4 von KITED — die globale Suche kannte den Vorgang nicht.
 */
describe('trefferDesVorhabens', () => {
  const CALYPSO = ['ZEP250140', '16KN999999'];

  function hit(id: string, source: string, score = 0.5): OramaSearchResult {
    return { id, text: 'Auszug', title: source, source, tags: [], type: 'dokument', score, method: 'hybrid' };
  }

  it('verwirft den Treffer aus einem fremden Antrag', () => {
    const kited = hit('dms-7f3-0', '16KN125320 - 2025-12-23-Anlage 4 KITED =PROGMKM7501=.pdf');
    expect(trefferDesVorhabens([kited], CALYPSO, [])).toEqual([]);
  });

  it('behält eine DMS-Datei, deren Name ein TV-Aktenzeichen trägt', () => {
    const eigen = hit('dms-a1-2', '16KN999999 - 2025-01-10-Anlage 4 CALYPSO.pdf');
    expect(trefferDesVorhabens([eigen], CALYPSO, [])).toEqual([eigen]);
  });

  it('behält die Chunks eines über den Tag zugeordneten Dokuments — und nur seine', () => {
    const chunk = hit('docX-3', 'Vorhabensbeschreibung.docx');
    const lazy = hit('docX', 'Vorhabensbeschreibung.docx');
    const nachbar = hit('docXY-1', 'Vorhabensbeschreibung.docx'); // anderes Dokument, gleicher Name
    expect(trefferDesVorhabens([chunk, lazy, nachbar], CALYPSO, ['docX'])).toEqual([chunk, lazy]);
  });

  it('hält die Reihenfolge der Suche', () => {
    const a = hit('docX-0', 'a.pdf', 0.9);
    const b = hit('dms-1', '16KN999999 - b.pdf', 0.7);
    const fremd = hit('dms-2', '16KN125320 - c.pdf', 0.8);
    expect(trefferDesVorhabens([a, fremd, b], CALYPSO, ['docX'])).toEqual([a, b]);
  });

  it('ohne Kennungen und Dokumente bleibt nichts', () => {
    expect(trefferDesVorhabens([hit('x-0', 'x.pdf')], [], [])).toEqual([]);
  });
});
