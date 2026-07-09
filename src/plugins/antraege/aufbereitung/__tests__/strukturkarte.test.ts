import { describe, it, expect } from 'vitest';
import type { VbSektion } from '../gliederung';
import { baueLayout } from '../StrukturKarte';
import type { AspektMapping, AspektSubstanz } from '../aspekte';

function sektion(id: string, nummer: string | undefined, titel: string, ebene: 1 | 2 | 3): VbSektion {
  return { id, nummer, titel, ebene, start: 0, end: 100, quelle: 'heading' };
}

// Kapitel 3 (3 Kinder) und 11 (5 Kinder) sind die kinderreichsten → ausgeklappt.
const GLIEDERUNG: VbSektion[] = [
  sektion('s-toc', undefined, 'Inhalt', 1),
  sektion('s-intro', undefined, 'Einleitung', 1),
  sektion('k-1', '1', 'Ausgangssituation', 1),
  sektion('k-2', '2', 'Projektgegenstand', 1),
  sektion('k-3', '3', 'Technische Funktionalitäten', 1),
  sektion('k-3.1', '3.1', 'A', 2), sektion('k-3.2', '3.2', 'B', 2), sektion('k-3.3', '3.3', 'C', 2),
  sektion('k-5', '5', 'Wirtschaftliche Risiken', 1),
  sektion('k-5.1', '5.1', 'x', 2),
  sektion('k-11', '11', 'Markteinführung', 1),
  sektion('k-11.1', '11.1', 'a', 2), sektion('k-11.2', '11.2', 'b', 2), sektion('k-11.3', '11.3', 'c', 2),
  sektion('k-11.4', '11.4', 'd', 2), sektion('k-11.5', '11.5', 'e', 2),
];

const MAPPING: AspektMapping = { zuordnung: { A: ['k-1'], C: ['k-3'], I: ['k-11'] }, fehlend: {} };
const SUBSTANZ: AspektSubstanz[] = [
  { aspektId: 'A', sektionIds: ['k-1'], zeichen: 100, anteil: 0.5, duenn: false },
  { aspektId: 'C', sektionIds: ['k-3'], zeichen: 50, anteil: 0.1, duenn: true },
  { aspektId: 'I', sektionIds: ['k-11'], zeichen: 100, anteil: 0.4, duenn: false },
];

describe('baueLayout', () => {
  it('klappt genau die zwei kinderreichsten Ebene-1-Kapitel aus (11 mit 5, 3 mit 3)', () => {
    const { rows } = baueLayout(GLIEDERUNG, MAPPING, SUBSTANZ);
    const expanded = rows.filter(r => r.expanded).map(r => r.s.id);
    expect(new Set(expanded)).toEqual(new Set(['k-3', 'k-11']));
    // k-5 hat nur 1 Kind → eingeklappt, zeigt +1.
    const k5 = rows.find(r => r.s.id === 'k-5')!;
    expect(k5.expanded).toBe(false);
    expect(k5.kinder).toHaveLength(1);
  });

  it('lässt s-toc und s-intro aus dem Baum', () => {
    const { rows } = baueLayout(GLIEDERUNG, MAPPING, SUBSTANZ);
    expect(rows.some(r => r.s.id === 's-toc' || r.s.id === 's-intro')).toBe(false);
  });

  it('Gleichstand bei Kinderzahl → Kapitel MIT Aspekt schlägt „ohne Aspekt"', () => {
    // k-3 (3 Kinder, Aspekt C) und k-5 (3 Kinder, ohne Aspekt) — bei Gleichstand
    // gewinnt k-3; die zweite Ausklapp-Wahl ist k-11 (5 Kinder).
    const g: VbSektion[] = [
      sektion('k-3', '3', 'Technik', 1),
      sektion('k-3.1', '3.1', 'a', 2), sektion('k-3.2', '3.2', 'b', 2), sektion('k-3.3', '3.3', 'c', 2),
      sektion('k-5', '5', 'Wirtschaftliche Risiken', 1),
      sektion('k-5.1', '5.1', 'a', 2), sektion('k-5.2', '5.2', 'b', 2), sektion('k-5.3', '5.3', 'c', 2),
      sektion('k-11', '11', 'Markt', 1),
      sektion('k-11.1', '11.1', 'a', 2), sektion('k-11.2', '11.2', 'b', 2),
      sektion('k-11.3', '11.3', 'c', 2), sektion('k-11.4', '11.4', 'd', 2), sektion('k-11.5', '11.5', 'e', 2),
    ];
    const m: AspektMapping = { zuordnung: { C: ['k-3'], I: ['k-11'] }, fehlend: {} };
    const { rows } = baueLayout(g, m, []);
    const expanded = new Set(rows.filter(r => r.expanded).map(r => r.s.id));
    expect(expanded).toEqual(new Set(['k-11', 'k-3'])); // k-5 (ohne Aspekt) bleibt eingeklappt
  });

  it('ausgeklappte Knoten reservieren Kinder-Zeilen; Aspekt-Badge + dünn abgeleitet', () => {
    const { rows } = baueLayout(GLIEDERUNG, MAPPING, SUBSTANZ);
    const k3 = rows.find(r => r.s.id === 'k-3')!;
    expect(k3.kinderRows).toHaveLength(3);
    expect(k3.aspekte).toEqual(['C']);
    expect(k3.duenn).toBe(true); // Aspekt C ist dünn
    const k1 = rows.find(r => r.s.id === 'k-1')!;
    expect(k1.aspekte).toEqual(['A']);
    expect(k1.duenn).toBe(false);
    // k-2 hat keine Zuordnung → ohne Aspekt (leeres Array).
    expect(rows.find(r => r.s.id === 'k-2')!.aspekte).toEqual([]);
  });
});
