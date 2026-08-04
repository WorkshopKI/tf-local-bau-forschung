/**
 * Was diese Datei festnagelt:
 *
 * 1. Eine kaputte Zeile kostet nur sich selbst, nie die Datei.
 * 2. Die Dateireihenfolge entscheidet — ein zurückliegender Zeitstempel
 *    überschreibt NICHT (Uhren-Schiefe zwischen Rechnern).
 * 3. Urteil und Kommentar sind zwei unabhängige Projektionen desselben Durchlaufs.
 * 4. Zurückziehen verliert nie eine Zeile.
 * 5. Das Drahtformat überlebt JSON unverändert (kein `null`, kein `undefined`).
 */
import { describe, it, expect } from 'vitest';
import { parseEintraege, falte, baueEintrag, beitraegeSortiert } from '@/plugins/zu-klaeren/fold';
import { urteilSchluessel, type KlaerungEintrag } from '@/plugins/zu-klaeren/typen';

const z = (e: Partial<KlaerungEintrag> & { autor: string; punktId: string }): string =>
  JSON.stringify({ ts: '2026-08-04T10:00:00.000Z', ...e });

describe('parseEintraege (JSONL lesen, kaputte Zeilen überspringen)', () => {
  it('überspringt eine kaputte Zeile, statt die Datei zu verwerfen', () => {
    const roh = [
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      '{ das ist kein JSON',
      z({ autor: 'SCH', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n');
    expect(parseEintraege(roh).map(e => e.autor)).toEqual(['MUE', 'SCH']);
  });

  it('überspringt eine abgeschnittene letzte Zeile', () => {
    const roh = `${z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' })}\n{"autor":"SC`;
    expect(parseEintraege(roh)).toHaveLength(1);
  });

  it('ignoriert Objekte ohne punktId oder autor', () => {
    const roh = [
      '{"ts":"2026-08-04T10:00:00.000Z","autor":"MUE"}',
      '{"ts":"2026-08-04T10:00:00.000Z","punktId":"code-11"}',
      z({ autor: 'MUE', punktId: 'code-11' }),
    ].join('\n');
    expect(parseEintraege(roh)).toHaveLength(1);
  });

  it('leerer Text ergibt keine Einträge', () => {
    expect(parseEintraege('')).toEqual([]);
    expect(parseEintraege('\n\n  \n')).toEqual([]);
  });
});

describe('falte (Dateireihenfolge entscheidet, nicht der Zeitstempel)', () => {
  const k = urteilSchluessel('MUE', 'code-11');

  it('das letzte Urteil je (Autor, Punkt) gewinnt', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'andere', zielWert: 'pruefung' }),
    ].join('\n')));
    expect(stand.urteile.get(k)).toMatchObject({ urteil: 'andere', zielWert: 'pruefung' });
  });

  it('ein zurückliegender Zeitstempel überschreibt nicht', () => {
    // Die zweite Zeile trägt eine ältere Uhr — sie steht aber später in der Datei
    // und ist damit die jüngere Äußerung. Sortierte die Faltung nach `ts`, ginge
    // die neuere Meinung still verloren.
    const stand = falte(parseEintraege([
      z({ ts: '2026-08-04T12:00:00.000Z', autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      z({ ts: '2026-08-04T09:00:00.000Z', autor: 'MUE', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.get(k)?.urteil).toBe('unklar');
  });

  it('ein Eintrag ohne Urteil lässt das vorherige Urteil stehen', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: 'MUE', punktId: 'code-11', kommentar: 'nur ein Hinweis' }),
    ].join('\n')));
    expect(stand.urteile.get(k)?.urteil).toBe('passt');
  });

  it('ein Eintrag mit Urteil UND Kommentar zählt in beide Projektionen', () => {
    const stand = falte(parseEintraege(
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'andere', zielWert: 'pruefung', kommentar: 'weil X' }),
    ));
    expect(stand.urteile.get(k)?.urteil).toBe('andere');
    expect(stand.kommentare.get('code-11')).toHaveLength(1);
  });

  it('zurueckgezogen macht das Urteil unwirksam, ohne den Eintrag zu verlieren', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'zurueckgezogen' }),
    ].join('\n')));
    expect(stand.urteile.get(k)?.urteil).toBe('zurueckgezogen');
  });

  it('Urteile verschiedener Autoren stehen nebeneinander', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: 'SCH', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.get(urteilSchluessel('MUE', 'code-11'))?.urteil).toBe('passt');
    expect(stand.urteile.get(urteilSchluessel('SCH', 'code-11'))?.urteil).toBe('unklar');
  });

  it('dasselbe Kürzel in anderer Schreibweise ist derselbe Mensch', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'mue', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: ' MUE ', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.size).toBe(1);
    expect(stand.urteile.get(k)?.urteil).toBe('unklar');
  });

  it('alle Kommentare bleiben erhalten, auch mehrere je Autor', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', kommentar: 'erstens' }),
      z({ autor: 'SCH', punktId: 'code-11', kommentar: 'dazu' }),
      z({ autor: 'MUE', punktId: 'code-11', kommentar: 'zweitens' }),
    ].join('\n')));
    expect(stand.kommentare.get('code-11')?.map(b => b.text))
      .toEqual(['erstens', 'dazu', 'zweitens']);
  });

  it('kommentarZurueck nimmt nur den eigenen jüngsten Beitrag heraus', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: 'code-11', kommentar: 'erstens' }),
      z({ autor: 'SCH', punktId: 'code-11', kommentar: 'fremd' }),
      z({ autor: 'MUE', punktId: 'code-11', kommentar: 'zweitens' }),
      z({ autor: 'MUE', punktId: 'code-11', kommentarZurueck: true }),
    ].join('\n')));
    expect(stand.kommentare.get('code-11')?.map(b => b.text)).toEqual(['erstens', 'fremd']);
  });

  it('beitraegeSortiert mischt die Autor-Dateien nach Zeitstempel', () => {
    const stand = falte(parseEintraege([
      z({ ts: '2026-08-04T12:00:00.000Z', autor: 'MUE', punktId: 'code-11', kommentar: 'spät' }),
      z({ ts: '2026-08-04T09:00:00.000Z', autor: 'SCH', punktId: 'code-11', kommentar: 'früh' }),
    ].join('\n')));
    expect(beitraegeSortiert(stand, 'code-11').map(b => b.text)).toEqual(['früh', 'spät']);
  });
});

describe('baueEintrag (die Uhr kommt von außen)', () => {
  it('übernimmt den übergebenen Zeitstempel unverändert', () => {
    const e = baueEintrag({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }, '2026-01-02T03:04:05.678Z');
    expect(e.ts).toBe('2026-01-02T03:04:05.678Z');
  });

  it('normalisiert das Kürzel beim Schreiben', () => {
    expect(baueEintrag({ autor: ' mue ', punktId: 'p' }, 'T').autor).toBe('MUE');
  });

  it('lässt nicht gesetzte Felder weg, statt undefined oder null zu schreiben', () => {
    const roh = JSON.stringify(baueEintrag({ autor: 'MUE', punktId: 'p', urteil: 'passt' }, 'T'));
    expect(roh).not.toContain('null');
    expect(roh).not.toContain('zielWert');
    expect(roh).not.toContain('kommentar');
  });

  it('ein Eintrag überlebt JSON.parse(JSON.stringify(...)) unverändert', () => {
    const e = baueEintrag(
      { autor: 'MUE', punktId: 'p', urteil: 'andere', zielWert: 'pruefung', kommentar: 'weil', kommentarZurueck: true },
      'T',
    );
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });
});
