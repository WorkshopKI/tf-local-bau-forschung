/**
 * Der Konfigurationsbaum hängt `kinderVon` auf das Baum-Format um; das
 * Umhängen selbst liegt in `core/meilensteine`. Geprüft wird beides an den
 * Stellen, an denen ein Fehler den Plan verfälschen würde:
 *
 *  - **Waisen verschwinden nicht.** Ein Knoten, dessen Elternteil gelöscht
 *    wurde, hängt an der Wurzel — dieselbe Zusage wie in `sortiereKnoten`.
 *  - **Kein Ast an sich selbst.** Der eigene Unterbaum ist als neuer
 *    Elternknoten gesperrt.
 *  - **Die Nummer folgt der Baumposition**, nie der Oberfläche.
 */
import { describe, it, expect } from 'vitest';
import { MEILENSTEIN_BAUM_ROOT, baueMeilensteinBaum } from '../meilensteinBaum';
import { darfUmhaengen, haengeKnotenUm, istNachfahre } from '@/core/meilensteine';
import type { MeilensteinKnoten } from '@/core/meilensteine';

const n = (
  id: string, elternId: string | null, nummer: string, label: string, sortierung: number,
): MeilensteinKnoten => ({
  id, elternId, nummer, label, sollWoche: 1, relevantFuerFrist: true,
  nurTypen: [], aktiv: true, bedingung: { einige: [] }, sortierung,
});

const PLAN: MeilensteinKnoten[] = [
  n('a', null, '1', 'Eingang', 10),
  n('a1', 'a', '1.1', 'Formalpruefung', 10),
  n('a2', 'a', '1.2', 'Vollstaendigkeit', 20),
  n('b', null, '2', 'Fachpruefung', 20),
];

describe('baueMeilensteinBaum', () => {
  it('hängt Unter-Meilensteine unter ihren Knoten, in Sortier-Reihenfolge', () => {
    const { items, rootId } = baueMeilensteinBaum(PLAN);
    expect(rootId).toBe(MEILENSTEIN_BAUM_ROOT);
    expect(items[rootId]?.children).toEqual(['a', 'b']);
    expect(items['a']?.children).toEqual(['a1', 'a2']);
    expect(items['b']?.children).toEqual([]);
  });

  it('nimmt die Nummer in die Beschriftung — sonst hießen zwei Knoten gleich', () => {
    const { items } = baueMeilensteinBaum(PLAN);
    expect(items['a1']?.name).toBe('1.1 Formalpruefung');
  });

  it('behandelt jeden Knoten als Ordner — auch ohne Kinder ist er ein Drop-Ziel', () => {
    const { items } = baueMeilensteinBaum(PLAN);
    expect(items['b']?.isFolder).toBe(true);
  });

  it('hängt Waisen an die Wurzel statt sie verschwinden zu lassen', () => {
    const mitWaise = [...PLAN, n('x', 'gibt-es-nicht', '', 'Waise', 10)];
    const { items } = baueMeilensteinBaum(mitWaise);
    expect(items[MEILENSTEIN_BAUM_ROOT]?.children).toContain('x');
    expect(items['x']?.name).toBe('Waise');
  });

  it('liefert bei leerem Plan nur die Wurzel', () => {
    const { items } = baueMeilensteinBaum([]);
    expect(items[MEILENSTEIN_BAUM_ROOT]?.children).toEqual([]);
    expect(Object.keys(items)).toEqual([MEILENSTEIN_BAUM_ROOT]);
  });
});

describe('darfUmhaengen', () => {
  it('erlaubt den Zug auf einen fremden Knoten', () => {
    expect(darfUmhaengen(PLAN, 'a1', 'b')).toBe(true);
  });

  it('erlaubt die oberste Ebene', () => {
    expect(darfUmhaengen(PLAN, 'a1', null)).toBe(true);
  });

  it('sperrt den Selbstbezug', () => {
    expect(darfUmhaengen(PLAN, 'a', 'a')).toBe(false);
  });

  it('sperrt den eigenen Nachfahren als Elternknoten', () => {
    expect(istNachfahre(PLAN, 'a', 'a1')).toBe(true);
    expect(darfUmhaengen(PLAN, 'a', 'a1')).toBe(false);
  });

  it('sperrt unbekannte Knoten in beide Richtungen', () => {
    expect(darfUmhaengen(PLAN, 'gibt-es-nicht', 'a')).toBe(false);
    expect(darfUmhaengen(PLAN, 'a1', 'gibt-es-nicht')).toBe(false);
  });
});

describe('haengeKnotenUm', () => {
  it('setzt den neuen Elternknoten und nummeriert neu', () => {
    const neu = haengeKnotenUm(PLAN, 'a1', 'b');
    const k = neu.find(x => x.id === 'a1')!;
    expect(k.elternId).toBe('b');
    expect(k.nummer).toBe('2.1');
    // Der zurückgebliebene Geschwisterknoten rückt auf.
    expect(neu.find(x => x.id === 'a2')!.nummer).toBe('1.1');
  });

  it('fügt an der gewünschten Position ein', () => {
    const neu = haengeKnotenUm(PLAN, 'b', 'a', 0);
    const kinderVonA = neu
      .filter(x => x.elternId === 'a')
      .sort((x, y) => x.sortierung - y.sortierung)
      .map(x => x.id);
    expect(kinderVonA).toEqual(['b', 'a1', 'a2']);
  });

  it('vergibt kollisionsfreie Sortierungen in der Zielreihe', () => {
    const neu = haengeKnotenUm(PLAN, 'b', 'a', 1);
    const sortierungen = neu.filter(x => x.elternId === 'a').map(x => x.sortierung);
    expect(new Set(sortierungen).size).toBe(sortierungen.length);
  });

  it('ist bei einem unzulässigen Zug ein No-op mit gleicher Referenz', () => {
    expect(haengeKnotenUm(PLAN, 'a', 'a1')).toBe(PLAN);
  });

  it('sortiert innerhalb derselben Geschwisterreihe um, ohne den Elternteil zu ändern', () => {
    const neu = haengeKnotenUm(PLAN, 'a2', 'a', 0);
    expect(neu.find(x => x.id === 'a2')!.elternId).toBe('a');
    expect(neu.find(x => x.id === 'a2')!.nummer).toBe('1.1');
    expect(neu.find(x => x.id === 'a1')!.nummer).toBe('1.2');
  });
});
