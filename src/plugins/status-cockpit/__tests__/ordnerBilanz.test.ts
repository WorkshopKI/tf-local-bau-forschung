/**
 * Die Zusage der Ordner-Bilanz: **sie sagt dasselbe wie die Fördertabelle.**
 *
 * Der Ordnerbaum sieht nach Zierrat aus — über 25 Fassungen hat ihn niemand
 * umgebaut. Er ist aber die Quelle der Ordner-Spalten der Fördertabelle, und
 * genau deshalb ist ein leerer Ordner kein Schönheitsfehler, sondern eine
 * Spalte, die nie erscheinen kann.
 *
 * Das Kriterium darf hier nicht nachgebaut werden: es wohnt in
 * `kategorie-projektion.ts`. Diese Tests halten fest, dass die Zeile dieselbe
 * Antwort gibt — auch in den Fällen, in denen „leer" und „ohne Spalte"
 * auseinanderfallen.
 */
import { describe, it, expect } from 'vitest';
import { ordnerBilanzText, ordnerMitSpalte, ordnerOhneSpalte } from '../ordnerBilanz';
import type { MappingVersion, StatusFeldEintrag, StatusKategorie } from '@/core/status';

function ordner(p: Partial<StatusKategorie> & { id: string; label: string }): StatusKategorie {
  return { elternId: null, ebene: 'tv', reihenfolge: 10, aktiv: true, ...p } as StatusKategorie;
}
function feld(p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag {
  return {
    label: p.feldId, typ: 'datum', ebene: 'tv', prominenzDefault: 'normal',
    aktiv: true, unkuratiert: false, ...p,
  } as StatusFeldEintrag;
}
const version = (
  kategorien: StatusKategorie[], felder: StatusFeldEintrag[],
): MappingVersion => ({ kategorien, felder, werte: [] } as unknown as MappingVersion);

describe('ordnerMitSpalte', () => {
  it('nimmt einen Ordner mit aktivem Datums-Kürzel', () => {
    const v = version(
      [ordner({ id: 'tv.a', label: 'A' })],
      [feld({ feldId: 'x', kategorieId: 'tv.a' })],
    );
    expect([...ordnerMitSpalte(v)]).toEqual(['tv.a']);
  });

  it('lässt einen Ordner draußen, in dem KEIN Datumsfeld liegt', () => {
    // „Leer" und „ohne Spalte" sind nicht dasselbe: ein Ordner voller
    // Textfelder ist belegt und trägt trotzdem nichts.
    const v = version(
      [ordner({ id: 'tv.a', label: 'A' })],
      [feld({ feldId: 'x', typ: 'text', kategorieId: 'tv.a' })],
    );
    expect([...ordnerMitSpalte(v)]).toEqual([]);
  });

  it('zählt ein stillgelegtes oder ignoriertes Kürzel nicht als Träger', () => {
    const v = version(
      [ordner({ id: 'tv.a', label: 'A' }), ordner({ id: 'tv.b', label: 'B' })],
      [
        feld({ feldId: 'x', kategorieId: 'tv.a', aktiv: false }),
        feld({ feldId: 'y', kategorieId: 'tv.b', prominenzDefault: 'ignoriert' }),
      ],
    );
    expect([...ordnerMitSpalte(v)]).toEqual([]);
  });
});

describe('ordnerOhneSpalte', () => {
  it('nennt den aktiven Ordner, aus dem nichts wird', () => {
    const v = version(
      [ordner({ id: 'tv.a', label: 'A' }), ordner({ id: 'tv.leer', label: 'Vor-Ort-Besuch' })],
      [feld({ feldId: 'x', kategorieId: 'tv.a' })],
    );
    expect(ordnerOhneSpalte(v).map(k => k.label)).toEqual(['Vor-Ort-Besuch']);
  });

  it('lässt einen stillgelegten Ordner draußen — dass er nichts trägt, ist sein Zweck', () => {
    const v = version([ordner({ id: 'tv.aus', label: 'Archiv', aktiv: false })], []);
    expect(ordnerOhneSpalte(v)).toEqual([]);
  });
});

describe('ordnerBilanzText', () => {
  it('nennt die Ordner ohne Spalte namentlich, nicht als Anzahl', () => {
    const v = version(
      [
        ordner({ id: 'tv.a', label: 'A' }),
        ordner({ id: 'tv.b', label: 'Betreuung' }),
        ordner({ id: 'tv.c', label: 'Vor-Ort-Besuch' }),
      ],
      [feld({ feldId: 'x', kategorieId: 'tv.a' })],
    );
    expect(ordnerBilanzText(v)).toBe(
      '1 von 3 Ordnern tragen eine Spalte in der Fördertabelle '
      + '· ohne Spalte: Betreuung, Vor-Ort-Besuch',
    );
  });

  it('sagt es ausdrücklich, wenn nichts fehlt — Schweigen läse sich als ungeprüft', () => {
    const v = version(
      [ordner({ id: 'tv.a', label: 'A' })],
      [feld({ feldId: 'x', kategorieId: 'tv.a' })],
    );
    expect(ordnerBilanzText(v)).toBe(
      '1 von 1 Ordnern tragen eine Spalte in der Fördertabelle · jeder Ordner trägt eine',
    );
  });
});
