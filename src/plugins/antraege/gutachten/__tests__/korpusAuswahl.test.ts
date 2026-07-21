import { describe, it, expect } from 'vitest';
import {
  baueInventar, waehleZusatzIds, schalteAufnahme, nimmAlleAuf, zaehleAufgenommen,
  zeigeSammelHinweis, leererKorpusRecord, type KorpusAuswahlRecord,
} from '../korpusAuswahl';
import type { DocumentFull } from '@/plugins/dokumente/store';

const VB = 'verbund-1';

const doc = (
  id: string, filename: string, tags: string[], created: string, markdown = 'x',
): DocumentFull => ({ id, filename, tags, created, markdown }) as unknown as DocumentFull;

/** Der gemeldete Fall: 5 Dateien, 3 davon auf dem VB-Default gelandet. */
const fuenfDokumente = (): DocumentFull[] => [
  doc('a5a', '16KN116733_Anlage 5.pdf', [VB, 'arbeitsplan'], '2026-07-21T10:00:01.000Z'),
  doc('markt', '16KN116733_A4_Markteinfuehrungskonzept.pdf', [VB, 'vorhabensbeschreibung'], '2026-07-21T10:00:02.000Z'),
  doc('projekt', '16KN116733_A4_Projektbeschreibung.pdf', [VB, 'vorhabensbeschreibung'], '2026-07-21T10:00:03.000Z'),
  doc('wirkung', '16KN116733_A4_Wirkung.pdf', [VB, 'vorhabensbeschreibung'], '2026-07-21T10:00:04.000Z'),
  doc('a5b', '16KN116734_Anlage 5.pdf', [VB, 'arbeitsplan'], '2026-07-21T10:00:05.000Z'),
];

describe('baueInventar', () => {
  it('nimmt nur Dokumente mit dem Verbund-Tag', () => {
    const docs = [...fuenfDokumente(), doc('fremd', 'Fremd.pdf', ['anderer-verbund', 'vorhabensbeschreibung'], '2026-07-21T09:00:00.000Z')];
    expect(baueInventar(docs, VB).map(k => k.docId)).not.toContain('fremd');
    expect(baueInventar(docs, VB)).toHaveLength(5);
  });

  it('leitet den Typ über typAusTags ab und markiert VB-Kandidaten', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(inv.find(k => k.docId === 'a5a')?.typ).toBe('arbeitsplan');
    expect(inv.find(k => k.docId === 'projekt')?.typ).toBe('vorhabensbeschreibung');
    expect(inv.filter(k => k.vbKandidat).map(k => k.docId)).toEqual(['markt', 'projekt', 'wirkung']);
  });

  it('sortiert stabil (created aufsteigend, dann Dateiname) — unabhängig von der Eingabereihenfolge', () => {
    const ids = (docs: DocumentFull[]): string[] => baueInventar(docs, VB).map(k => k.docId);
    const original = fuenfDokumente();
    expect(ids(original)).toEqual(['a5a', 'markt', 'projekt', 'wirkung', 'a5b']);
    expect(ids([...original].reverse())).toEqual(['a5a', 'markt', 'projekt', 'wirkung', 'a5b']);
  });

  it('gleicher created → Tie-Break über den Dateinamen', () => {
    const t = '2026-07-21T10:00:00.000Z';
    const docs = [doc('z', 'zebra.pdf', [VB], t), doc('a', 'alpha.pdf', [VB], t)];
    expect(baueInventar(docs, VB).map(k => k.docId)).toEqual(['a', 'z']);
  });

  it('verträgt fehlende Felder (Scanner-Records ohne created)', () => {
    const kaputt = { id: 'k', tags: [VB] } as unknown as DocumentFull;
    const inv = baueInventar([kaputt], VB);
    expect(inv[0]).toMatchObject({ docId: 'k', filename: '(ohne Namen)', created: '', zeichen: 0 });
  });
});

describe('waehleZusatzIds', () => {
  it('enthält die aktive VB NIE — auch wenn ihre docId in aufgenommen steht', () => {
    // Sonst käme der VB-Text doppelt im Prompt an (einmal als Präfix, einmal als Zusatz).
    const inv = baueInventar(fuenfDokumente(), VB);
    const gewaehlt = waehleZusatzIds(inv, ['projekt', 'markt', 'a5a'], 'projekt');
    expect(gewaehlt).not.toContain('projekt');
    expect(gewaehlt).toEqual(['a5a', 'markt']); // Inventar-Reihenfolge, nicht Klick-Reihenfolge
  });

  it('ignoriert verwaiste docIds still (Dokument zwischenzeitlich gelöscht)', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(waehleZusatzIds(inv, ['markt', 'geloescht'], 'projekt')).toEqual(['markt']);
  });

  it('leere Auswahl → keine Zusatzdokumente (Korpus === VB)', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(waehleZusatzIds(inv, [], 'projekt')).toEqual([]);
  });

  it('liefert in Inventar-Reihenfolge, nicht in Klick-Reihenfolge', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(waehleZusatzIds(inv, ['a5b', 'markt'], 'projekt')).toEqual(['markt', 'a5b']);
  });
});

describe('schalteAufnahme', () => {
  it('nimmt auf und entfernt', () => {
    expect(schalteAufnahme([], 'a', true)).toEqual(['a']);
    expect(schalteAufnahme(['a', 'b'], 'a', false)).toEqual(['b']);
  });

  it('ist idempotent und dublettenfrei', () => {
    expect(schalteAufnahme(['a'], 'a', true)).toEqual(['a']);
    expect(schalteAufnahme(['a', 'b'], 'c', false)).toEqual(['a', 'b']);
  });

  it('lässt die Reihenfolge der übrigen unangetastet', () => {
    expect(schalteAufnahme(['a', 'b', 'c'], 'b', false)).toEqual(['a', 'c']);
  });
});

describe('nimmAlleAuf', () => {
  it('nimmt alles außer der aktiven VB', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(nimmAlleAuf(inv, 'projekt')).toEqual(['a5a', 'markt', 'wirkung', 'a5b']);
  });

  it('ohne aktive VB (Ordner-Fallback) bleibt alles drin', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(nimmAlleAuf(inv, null)).toHaveLength(5);
  });
});

describe('zaehleAufgenommen', () => {
  it('zählt die VB mit — der gemeldete Ausgangszustand ist „5 Dokumente · 1 im Kontext"', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(zaehleAufgenommen(inv, [], 'projekt')).toEqual({ imKorpus: 1, gesamt: 5 });
  });

  it('nach „Alle aufnehmen" sind alle im Kontext', () => {
    const inv = baueInventar(fuenfDokumente(), VB);
    expect(zaehleAufgenommen(inv, nimmAlleAuf(inv, 'projekt'), 'projekt')).toEqual({ imKorpus: 5, gesamt: 5 });
  });

  it('leeres Inventar → 0 von 0 (keine Phantom-VB)', () => {
    expect(zaehleAufgenommen([], [], null)).toEqual({ imKorpus: 0, gesamt: 0 });
  });
});

describe('zeigeSammelHinweis', () => {
  const inv = baueInventar(fuenfDokumente(), VB);
  const record = (p: Partial<KorpusAuswahlRecord> = {}): KorpusAuswahlRecord => ({ ...leererKorpusRecord(VB), ...p });

  it('steht an, solange nichts aufgenommen und nichts entschieden wurde', () => {
    expect(zeigeSammelHinweis(inv, record(), 'projekt')).toBe(true);
  });

  it('verschwindet nach „Alle aufnehmen"', () => {
    expect(zeigeSammelHinweis(inv, record({ aufgenommen: ['markt'] }), 'projekt')).toBe(false);
  });

  it('verschwindet nach bewusster Ablehnung („Nur die VB verwenden")', () => {
    expect(zeigeSammelHinweis(inv, record({ hinweisErledigt: true }), 'projekt')).toBe(false);
  });

  it('steht nicht an, wenn es außer der VB nichts gibt', () => {
    const nurVb = baueInventar([doc('v', 'VB.pdf', [VB, 'vorhabensbeschreibung'], '2026-07-21T10:00:00.000Z')], VB);
    expect(zeigeSammelHinweis(nurVb, record(), 'v')).toBe(false);
  });
});

describe('VB-Wechsel', () => {
  it('macht die alte VB zum Zusatz-Kandidaten mit wirksamer Mitgliedschaft', () => {
    // Die Mitgliedschaft der alten VB war gespeichert, aber unwirksam (sie war Präfix).
    // Nach dem Wechsel wird sie wirksam — ohne dass der Nutzer erneut klicken muss.
    const inv = baueInventar(fuenfDokumente(), VB);
    const aufgenommen = ['projekt', 'markt'];
    expect(waehleZusatzIds(inv, aufgenommen, 'projekt')).toEqual(['markt']);
    expect(waehleZusatzIds(inv, aufgenommen, 'wirkung')).toEqual(['markt', 'projekt']);
  });
});
