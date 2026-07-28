import { describe, it, expect } from 'vitest';
import { darfAblegen, naechsteReihenfolge, SAMMEL_GRENZE } from '../ordnerDrag';
import type { StatusKategorie } from '@/core/status';

function kat(
  id: string, elternId: string | null, ebene: 'verbund' | 'tv' = 'tv', reihenfolge = 10,
): StatusKategorie {
  return { id, elternId, label: id, ebene, reihenfolge, aktiv: true };
}

const BAUM: StatusKategorie[] = [
  kat('tv.komm', null, 'tv', 10),
  kat('tv.ab', null, 'tv', 20),
  kat('tv.ab.precheck', 'tv.ab', 'tv', 10),
  kat('tv.ab.precheck.tief', 'tv.ab.precheck', 'tv', 10),
  kat('tv.nz', null, 'tv', 999),
  kat('vb.komm', null, 'verbund', 10),
];

describe('ordnerDrag — was abgelegt werden darf', () => {
  it('erlaubt das Umhängen unter einen fremden Ordner derselben Ebene', () => {
    expect(darfAblegen(BAUM, 'tv.komm', 'tv.ab')).toBe(true);
  });

  it('verweigert den Ebenen-Wechsel — Verbund und TV sind getrennte Bäume', () => {
    expect(darfAblegen(BAUM, 'vb.komm', 'tv.ab')).toBe(false);
    expect(darfAblegen(BAUM, 'tv.komm', 'vb.komm')).toBe(false);
  });

  it('verweigert den eigenen Nachfahren als Elternknoten', () => {
    expect(darfAblegen(BAUM, 'tv.ab', 'tv.ab.precheck')).toBe(false);
    expect(darfAblegen(BAUM, 'tv.ab', 'tv.ab.precheck.tief')).toBe(false);
  });

  it('verweigert den Selbstbezug', () => {
    expect(darfAblegen(BAUM, 'tv.ab', 'tv.ab')).toBe(false);
  });

  it('verweigert die Nulländerung — der Ordner liegt schon dort', () => {
    expect(darfAblegen(BAUM, 'tv.ab.precheck', 'tv.ab')).toBe(false);
    expect(darfAblegen(BAUM, 'tv.komm', null)).toBe(false);
  });

  it('erlaubt den Weg zurück auf die oberste Ebene', () => {
    expect(darfAblegen(BAUM, 'tv.ab.precheck', null)).toBe(true);
  });

  it('verweigert unbekannte Ids, statt zu werfen', () => {
    expect(darfAblegen(BAUM, 'gibtsnicht', 'tv.ab')).toBe(false);
    expect(darfAblegen(BAUM, 'tv.ab', 'gibtsnicht')).toBe(false);
  });
});

describe('ordnerDrag — Reihenfolge des Zuzugs', () => {
  it('reiht hinter die vorhandenen Geschwister ein', () => {
    expect(naechsteReihenfolge(BAUM, 'tv', 'tv.ab')).toBe(20);
  });

  it('überspringt die Sammelordner, statt sich dahinter zu stellen', () => {
    // Auf oberster TV-Ebene steht „Nicht zugeordnet" auf 999 — der Zuzug landet
    // hinter tv.ab (20), nicht hinter dem Sammelordner.
    expect(naechsteReihenfolge(BAUM, 'tv', null)).toBe(30);
    expect(naechsteReihenfolge(BAUM, 'tv', null)).toBeLessThan(SAMMEL_GRENZE);
  });

  it('startet ohne Geschwister bei 10', () => {
    expect(naechsteReihenfolge(BAUM, 'tv', 'tv.komm')).toBe(10);
  });
});
