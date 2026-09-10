/**
 * Der Bestandslauf rechnet nur die zwei jüngsten Richtlinien-Generationen —
 * geschnitten mit dem gewählten Bereich, auch bei der Stufe „Alle". Listen,
 * Zähler und Chip bleiben beim Bereich.
 */
import { describe, expect, it } from 'vitest';
import {
  AKTUELLE_RICHTLINIE, BETRACHTUNGSBEREICH_SEED, BESTANDSLAUF_RICHTLINIEN, RICHTLINIEN_GENERATIONEN,
  bereichsMenge, bestandslaufMenge,
} from '../betrachtungsbereich';

const sortiert = (s: ReadonlySet<string>): string[] => [...s].sort();

describe('bestandslaufMenge', () => {
  it('sind die zwei jüngsten Generationen — abgeleitet, nicht abgeschrieben', () => {
    expect(BESTANDSLAUF_RICHTLINIEN).toEqual(RICHTLINIEN_GENERATIONEN.slice(-2));
  });

  it('rechnet auch bei „Alle" (kein Bereich) nur diese zwei', () => {
    const erwartet = bereichsMenge(BESTANDSLAUF_RICHTLINIEN.flatMap(g => g.programme));
    expect(sortiert(bestandslaufMenge(null))).toEqual(sortiert(erwartet));
  });

  it('lässt die älteste Generation des Standard-Bereichs weg', () => {
    const standard = bereichsMenge(BETRACHTUNGSBEREICH_SEED);
    const lauf = bestandslaufMenge(standard);
    const aelteste = RICHTLINIEN_GENERATIONEN[RICHTLINIEN_GENERATIONEN.length - 3]?.programme ?? [];
    expect(aelteste.length).toBeGreaterThan(0);
    for (const p of bereichsMenge(aelteste)) expect(lauf.has(p)).toBe(false);
    expect(lauf.size).toBe(standard.size - bereichsMenge(aelteste).size);
  });

  it('schneidet mit einem engeren Bereich und rechnet nichts außerhalb', () => {
    expect(sortiert(bestandslaufMenge(bereichsMenge(AKTUELLE_RICHTLINIE))))
      .toEqual(sortiert(bereichsMenge(AKTUELLE_RICHTLINIE)));
    const nurAlt = bereichsMenge(RICHTLINIEN_GENERATIONEN[0]?.programme ?? []);
    expect(bestandslaufMenge(nurAlt).size).toBe(0);
  });
});
