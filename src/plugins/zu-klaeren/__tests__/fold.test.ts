/**
 * Was diese Datei festnagelt:
 *
 * 1. Eine kaputte Zeile kostet nur sich selbst, nie die Datei.
 * 2. Die Dateireihenfolge entscheidet — ein zurückliegender Zeitstempel
 *    überschreibt NICHT (Uhren-Schiefe zwischen Rechnern).
 * 3. Urteil und Kommentar sind zwei unabhängige Projektionen desselben Durchlaufs.
 * 4. Zurückziehen verliert nie eine Zeile.
 * 5. Das Drahtformat überlebt JSON unverändert (kein `null`, kein `undefined`).
 * 6. Eine alte Punkt-Id wird beim LESEN übersetzt — für Urteil UND Kommentar,
 *    an genau einer Stelle. Geschrieben wird sie nie wieder.
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

  it('derselbe Name in anderer Schreibweise ist derselbe Mensch', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'mue', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: ' MUE ', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.size).toBe(1);
    expect(stand.urteile.get(k)?.urteil).toBe('unklar');
  });

  it('… auch bei einem Personennamen samt Doppel-Leerzeichen', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'Thomas  Hübsch', punktId: 'code-11', urteil: 'passt' }),
      z({ autor: 'thomas hübsch', punktId: 'code-11', urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.size).toBe(1);
    expect(stand.namen.size).toBe(1);
  });

  it('`namen` hält die zuletzt gesehene Schreibweise für die Anzeige', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'Thomas Hübsch', punktId: 'code-11', urteil: 'passt' }),
    ].join('\n')));
    expect([...stand.namen.values()]).toEqual(['Thomas Hübsch']);
    expect([...stand.namen.keys()]).toEqual(['THOMAS HÜBSCH']);
  });

  it('Beiträge tragen die Anzeigeform, nicht die Vergleichsform', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'Thomas Hübsch', punktId: 'code-11', kommentar: 'dazu' }),
    ].join('\n')));
    expect(stand.kommentare.get('code-11')?.[0]?.autor).toBe('Thomas Hübsch');
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

  it('… und findet den eigenen Beitrag auch bei anderer Schreibweise', () => {
    // Der Beitrag steht in der Anzeigeform in der Liste, der Widerruf kommt
    // normalisiert an. Verglichen der Code roh, bliebe der Beitrag stehen und
    // das Zurückziehen wäre eine Attrappe.
    const stand = falte(parseEintraege([
      z({ autor: 'Thomas Hübsch', punktId: 'code-11', kommentar: 'weg damit' }),
      z({ autor: 'THOMAS HÜBSCH', punktId: 'code-11', kommentarZurueck: true }),
    ].join('\n')));
    expect(stand.kommentare.get('code-11')).toEqual([]);
  });

  it('beitraegeSortiert mischt die Autor-Dateien nach Zeitstempel', () => {
    const stand = falte(parseEintraege([
      z({ ts: '2026-08-04T12:00:00.000Z', autor: 'MUE', punktId: 'code-11', kommentar: 'spät' }),
      z({ ts: '2026-08-04T09:00:00.000Z', autor: 'SCH', punktId: 'code-11', kommentar: 'früh' }),
    ].join('\n')));
    expect(beitraegeSortiert(stand, 'code-11').map(b => b.text)).toEqual(['früh', 'spät']);
  });
});

describe('falte übersetzt alte Punkt-Ids (v2.412)', () => {
  const ALT = 'frage-1';
  const NEU = 'frage-32-ablehnungsreif';

  it('ein Urteil unter der alten Id zählt für die neue', () => {
    const stand = falte(parseEintraege(z({ autor: 'MUE', punktId: ALT, urteil: 'passt' })));
    expect(stand.urteile.get(urteilSchluessel('MUE', NEU))?.urteil).toBe('passt');
    expect(stand.urteile.get(urteilSchluessel('MUE', ALT))).toBeUndefined();
  });

  it('ein Kommentar unter der alten Id landet an derselben Frage', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: ALT, kommentar: 'aus der alten Datei' }),
      z({ autor: 'SCH', punktId: NEU, kommentar: 'aus der neuen' }),
    ].join('\n')));
    expect(stand.kommentare.get(NEU)?.map(b => b.text))
      .toEqual(['aus der alten Datei', 'aus der neuen']);
    expect(stand.kommentare.has(ALT)).toBe(false);
  });

  it('eine neue Äußerung überschreibt die alte desselben Autors', () => {
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: ALT, urteil: 'passt' }),
      z({ autor: 'MUE', punktId: NEU, urteil: 'unklar' }),
    ].join('\n')));
    expect(stand.urteile.size).toBe(1);
    expect(stand.urteile.get(urteilSchluessel('MUE', NEU))?.urteil).toBe('unklar');
  });

  it('kommentarZurueck greift über die Id-Grenze hinweg auf dieselbe Liste', () => {
    // Der Widerruf steht unter der NEUEN Id, der Beitrag unter der alten. Ohne
    // eine gemeinsame Übersetzung sähen beide verschiedene Fächer, und der
    // Widerruf liefe ins Leere — sichtbar erst Wochen später.
    const stand = falte(parseEintraege([
      z({ autor: 'MUE', punktId: ALT, kommentar: 'Tippfehler' }),
      z({ autor: 'MUE', punktId: NEU, kommentarZurueck: true }),
    ].join('\n')));
    expect(stand.kommentare.get(NEU) ?? []).toHaveLength(0);
  });

  it('unbekannte Ids bleiben unangetastet', () => {
    const stand = falte(parseEintraege(z({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' })));
    expect(stand.urteile.get(urteilSchluessel('MUE', 'code-11'))?.urteil).toBe('passt');
  });

  it('geschrieben wird die Id unverändert — die Übersetzung ist ein Lesepfad', () => {
    expect(baueEintrag({ autor: 'MUE', punktId: ALT }, 'T').punktId).toBe(ALT);
  });
});

describe('baueEintrag (die Uhr kommt von außen)', () => {
  it('übernimmt den übergebenen Zeitstempel unverändert', () => {
    const e = baueEintrag({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }, '2026-01-02T03:04:05.678Z');
    expect(e.ts).toBe('2026-01-02T03:04:05.678Z');
  });

  it('schreibt den Namen in der ANZEIGEFORM, nicht in Großbuchstaben', () => {
    // Die Datei wird im Zweifel von einem Menschen gelesen; „THOMAS HÜBSCH"
    // wäre dort eine Verschlechterung ohne Gegenwert.
    expect(baueEintrag({ autor: ' Thomas  Hübsch ', punktId: 'p' }, 'T').autor)
      .toBe('Thomas Hübsch');
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
