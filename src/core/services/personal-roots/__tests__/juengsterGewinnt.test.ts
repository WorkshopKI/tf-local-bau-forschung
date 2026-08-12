/**
 * Die Dubletten-Regel: dieselbe Person unter zwei Wurzeln, jüngster Stand gewinnt.
 *
 * Die tragende Zusage ist REIHENFOLGE-UNABHÄNGIGKEIT: kein Root hat Vorrang.
 * Genau die wird hier in beiden Richtungen geprüft — vorher entschied still der
 * Zufall, welche Wurzel als zweite gelesen wurde.
 */
import { describe, it, expect } from 'vitest';
import { juengsterGewinnt } from '../juengsterGewinnt';

interface P { id: string; wurzel: string; ts?: string }

const alt: P = { id: 'MUE', wurzel: 'A', ts: '2026-01-01T00:00:00Z' };
const neu: P = { id: 'MUE', wurzel: 'B', ts: '2026-08-01T00:00:00Z' };

const key = (p: P): string => p.id;
const ts = (p: P): string | undefined => p.ts;

describe('juengsterGewinnt', () => {
  it('behält den jüngsten Eintrag je Schlüssel', () => {
    expect(juengsterGewinnt([alt, neu], key, ts)).toEqual([neu]);
  });

  it('liefert dasselbe Ergebnis in BEIDER Wurzel-Reihenfolge', () => {
    // Das ist die eigentliche Zusage „kein Root hat Vorrang".
    expect(juengsterGewinnt([alt, neu], key, ts)).toEqual(juengsterGewinnt([neu, alt], key, ts));
  });

  it('lässt verschiedene Schlüssel unangetastet, in Eingabe-Reihenfolge', () => {
    const a: P = { id: 'AAA', wurzel: 'A', ts: '2026-01-01T00:00:00Z' };
    const b: P = { id: 'BBB', wurzel: 'B', ts: '2026-02-01T00:00:00Z' };
    expect(juengsterGewinnt([a, b], key, ts)).toEqual([a, b]);
  });

  it('behält bei Gleichstand den zuerst gesehenen', () => {
    const x: P = { id: 'MUE', wurzel: 'A', ts: '2026-05-05T00:00:00Z' };
    const y: P = { id: 'MUE', wurzel: 'B', ts: '2026-05-05T00:00:00Z' };
    expect(juengsterGewinnt([x, y], key, ts)).toEqual([x]);
  });

  it('behält den zuerst gesehenen, wenn kein Zeitstempel da ist', () => {
    const x: P = { id: 'MUE', wurzel: 'A' };
    const y: P = { id: 'MUE', wurzel: 'B' };
    expect(juengsterGewinnt([x, y], key, ts)).toEqual([x]);
  });

  it('ein datierter Eintrag schlägt einen undatierten, egal in welcher Reihenfolge', () => {
    const ohne: P = { id: 'MUE', wurzel: 'A' };
    expect(juengsterGewinnt([ohne, neu], key, ts)).toEqual([neu]);
    expect(juengsterGewinnt([neu, ohne], key, ts)).toEqual([neu]);
  });

  it('ignoriert unparsebare Zeitstempel, statt zu werfen', () => {
    const kaputt: P = { id: 'MUE', wurzel: 'A', ts: 'gestern' };
    expect(juengsterGewinnt([neu, kaputt], key, ts)).toEqual([neu]);
    expect(juengsterGewinnt([kaputt, neu], key, ts)).toEqual([neu]);
  });

  it('verwirft NICHTS, wenn der Schlüssel null ist', () => {
    // Ein Eintrag ohne Kürzel ist nicht zuordenbar — er darf trotzdem nicht
    // still verschwinden, sonst fehlte er auch in der Bilanz.
    const a: P = { id: '', wurzel: 'A', ts: '2026-01-01T00:00:00Z' };
    const b: P = { id: '', wurzel: 'B', ts: '2026-02-01T00:00:00Z' };
    expect(juengsterGewinnt([a, b], () => null, ts)).toEqual([a, b]);
  });

  it('kommt mit einer leeren Liste aus', () => {
    expect(juengsterGewinnt([], key, ts)).toEqual([]);
  });
});
