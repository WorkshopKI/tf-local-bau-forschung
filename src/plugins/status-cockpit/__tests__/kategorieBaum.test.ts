/**
 * Der Ordnerbaum wird aus `baumVon` umgehängt, nicht neu erfunden — geprüft
 * wird deshalb genau die Umhängung, plus die Zusagen, an denen der Nutzer
 * etwas merken würde:
 *
 *  - **Verbund und Teilvorhaben bleiben getrennte Bäume.** Ein `vb.`-Ordner
 *    taucht im TV-Baum nicht auf; die Ablege-Regel sperrt den Ebenenwechsel.
 *  - **Auch ein leerer Ordner ist ein Ordner** — er ist ein gültiges Drop-Ziel.
 *  - **Die Belegung kommt von aussen**, aus dem Feld-Katalog, nicht aus der
 *    Ordnerliste.
 */
import { describe, it, expect } from 'vitest';
import { baueKategorieBaum, belegungJeOrdner, wurzelId } from '../kategorieBaum';
import { darfAblegen, naechsteReihenfolge } from '../ordnerDrag';
import type { StatusKategorie } from '@/core/status';

const k = (
  id: string, elternId: string | null, ebene: 'verbund' | 'tv', reihenfolge = 10,
): StatusKategorie => ({ id, elternId, label: id.split('.').pop()!, ebene, reihenfolge, aktiv: true });

const KATEGORIEN: StatusKategorie[] = [
  k('vb.antrag', null, 'verbund', 10),
  k('vb.antrag.eingang', 'vb.antrag', 'verbund', 10),
  k('vb.kommunikation', null, 'verbund', 20),
  k('tv.pruefung', null, 'tv', 10),
  k('tv.pruefung.fachlich', 'tv.pruefung', 'tv', 10),
  k('tv.kommunikation', null, 'tv', 20),
];

const OHNE_BELEGUNG = new Map<string, number>();

describe('baueKategorieBaum', () => {
  it('hängt Unterordner unter ihren Elternordner', () => {
    const { items, rootId } = baueKategorieBaum(KATEGORIEN, 'verbund', OHNE_BELEGUNG);
    expect(rootId).toBe(wurzelId('verbund'));
    expect(items[rootId]?.children).toEqual(['vb.antrag', 'vb.kommunikation']);
    expect(items['vb.antrag']?.children).toEqual(['vb.antrag.eingang']);
  });

  it('hält die Ebenen getrennt — der TV-Baum kennt keinen vb.-Ordner', () => {
    const { items } = baueKategorieBaum(KATEGORIEN, 'tv', OHNE_BELEGUNG);
    expect(Object.keys(items).filter(id => id.startsWith('vb.'))).toEqual([]);
    expect(items[wurzelId('tv')]?.children).toEqual(['tv.pruefung', 'tv.kommunikation']);
  });

  it('behandelt auch einen leeren Ordner als Ordner (gültiges Drop-Ziel)', () => {
    const { items } = baueKategorieBaum(KATEGORIEN, 'verbund', OHNE_BELEGUNG);
    expect(items['vb.kommunikation']?.isFolder).toBe(true);
    expect(items['vb.kommunikation']?.children).toEqual([]);
  });

  it('trägt die Belegung von aussen ein statt sie zu raten', () => {
    const { items } = baueKategorieBaum(
      KATEGORIEN, 'verbund', new Map([['vb.antrag', 3]]),
    );
    const a = items['vb.antrag']?.data;
    const b = items['vb.kommunikation']?.data;
    expect(a?.art === 'ordner' && a.belegt).toBe(3);
    expect(b?.art === 'ordner' && b.belegt).toBe(0);
  });

  it('liefert für eine leere Ebene nur die Wurzel', () => {
    const { items, rootId } = baueKategorieBaum([], 'verbund', OHNE_BELEGUNG);
    expect(items[rootId]?.children).toEqual([]);
    expect(Object.keys(items)).toEqual([rootId]);
  });
});

describe('belegungJeOrdner', () => {
  it('zählt je Ordner und lässt Felder ohne Zuordnung weg', () => {
    const m = belegungJeOrdner([
      { kategorieId: 'vb.antrag' }, { kategorieId: 'vb.antrag' },
      { kategorieId: null }, {}, { kategorieId: 'tv.pruefung' },
    ]);
    expect(m.get('vb.antrag')).toBe(2);
    expect(m.get('tv.pruefung')).toBe(1);
    expect(m.size).toBe(2);
  });
});

describe('Ablege-Regeln — hier nur bestätigt, dass der Baum sie unverändert nutzt', () => {
  it('sperrt den Ebenenwechsel', () => {
    expect(darfAblegen(KATEGORIEN, 'vb.antrag', 'tv.pruefung')).toBe(false);
  });

  it('sperrt den eigenen Unterbaum als neuen Elternknoten', () => {
    expect(darfAblegen(KATEGORIEN, 'vb.antrag', 'vb.antrag.eingang')).toBe(false);
    expect(darfAblegen(KATEGORIEN, 'vb.antrag', 'vb.antrag')).toBe(false);
  });

  it('erlaubt den Zug auf einen Geschwisterordner derselben Ebene', () => {
    expect(darfAblegen(KATEGORIEN, 'vb.kommunikation', 'vb.antrag')).toBe(true);
  });

  it('lässt einen Unterordner auf die oberste Ebene, einen obersten aber nicht nochmal', () => {
    expect(darfAblegen(KATEGORIEN, 'vb.antrag.eingang', null)).toBe(true);
    expect(darfAblegen(KATEGORIEN, 'vb.antrag', null)).toBe(false);
  });

  it('vergibt die Reihenfolge in Zehnerlücken hinter die Geschwister', () => {
    expect(naechsteReihenfolge(KATEGORIEN, 'verbund', null)).toBe(30);
    expect(naechsteReihenfolge(KATEGORIEN, 'verbund', 'vb.antrag')).toBe(20);
    expect(naechsteReihenfolge(KATEGORIEN, 'verbund', 'vb.kommunikation')).toBe(10);
  });
});
