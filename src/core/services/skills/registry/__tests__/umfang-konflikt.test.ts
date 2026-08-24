/**
 * `findeUmfangKonflikte` — der Editor-Warnhinweis, der die Doppelquelle sichtbar macht:
 * eine feste Umfangs-Zahl in der Prompt-PROSA, die von der zugeordneten Regel abweicht.
 * Genau dieser Drift ließ Regel-Edits ins Leere laufen (der Prompt trug den alten Wert
 * weiter). Konservativ: nur harte Total-Formulierungen, keine weichen Teil-Richtwerte.
 */
import { describe, it, expect } from 'vitest';
import { findeUmfangKonflikte } from '../check-engine';
import type { QualitaetsRegel } from '../types';

function regel(typ: string, params: Record<string, unknown>, over: Partial<QualitaetsRegel> = {}): QualitaetsRegel {
  const name = typ === 'wortanzahl' ? 'Wortanzahl' : typ === 'satzanzahl' ? 'Satzanzahl' : 'Absätze';
  return { id: `r-${typ}`, name, typ, params, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't', ...over };
}

describe('findeUmfangKonflikte', () => {
  it('Prosa „mindestens 750 Wörter" vs. Regel 450–550 → Konflikt', () => {
    const k = findeUmfangKonflikte('Gesamtumfang **mindestens 750 Wörter**.', [regel('wortanzahl', { min: 450, max: 550 })]);
    expect(k.length).toBe(1);
    expect(k[0]).toContain('750');
    expect(k[0]).toContain('450–550');
  });

  it('Prosa restated den Regel-Wert (mindestens 750 vs. Regel min 750) → KEIN Konflikt', () => {
    expect(findeUmfangKonflikte('Gesamtumfang mindestens 750 Wörter.', [regel('wortanzahl', { min: 750 })])).toEqual([]);
  });

  it('de-duplizierte Prosa (keine Zahl) → KEIN Konflikt', () => {
    const text = 'Der finale Fließtext: Hintergrund, Stand der Technik und Lösungsweg.';
    expect(findeUmfangKonflikte(text, [regel('wortanzahl', { min: 450, max: 550 })])).toEqual([]);
  });

  it('weiche Teil-Richtwerte („Richtwert ≥ 150 Wörter", „(1–2 Sätze)") → KEIN Fehlalarm', () => {
    const text = '1. Hintergrund (Richtwert ≥ 150 Wörter)\n2. Ziel (1–2 Sätze)';
    const k = findeUmfangKonflikte(text, [regel('wortanzahl', { min: 450, max: 550 }), regel('satzanzahl', { min: 8, max: 12 })]);
    expect(k).toEqual([]);
  });

  it('„ca. 10 Sätze" + „Toleranz 8–12 Sätze" konsistent mit Regel {8,12} → KEIN Konflikt', () => {
    const text = 'Fasse zu ca. 10 Sätzen zusammen (Toleranz 8–12 Sätze).';
    expect(findeUmfangKonflikte(text, [regel('satzanzahl', { min: 8, max: 12 })])).toEqual([]);
  });

  it('„ca. 10 Sätze" bei Regel {5,7} → Konflikt (10 > 7)', () => {
    const k = findeUmfangKonflikte('Fasse zu ca. 10 Sätzen zusammen.', [regel('satzanzahl', { min: 5, max: 7 })]);
    expect(k.length).toBeGreaterThan(0);
  });

  it('„mindestens vier Absätze" (ausgeschrieben) vs. Regel min 3 → Konflikt', () => {
    const k = findeUmfangKonflikte('Gliedere in **mindestens vier Absätze**.', [regel('absatz_min', { min: 3 })]);
    expect(k.length).toBe(1);
    expect(k[0]).toContain('vier');
  });

  it('„mindestens vier Absätze" vs. Regel min 4 → KEIN Konflikt', () => {
    expect(findeUmfangKonflikte('Gliedere in mindestens vier Absätze.', [regel('absatz_min', { min: 4 })])).toEqual([]);
  });

  it('inaktive Regel wird übersprungen', () => {
    expect(findeUmfangKonflikte('mindestens 750 Wörter', [regel('wortanzahl', { min: 450 }, { aktiv: false })])).toEqual([]);
  });
});

/**
 * Die Lücke, die Abschnitt B durchfallen ließ: EINZELN ist jeder Teil-Richtwert
 * harmlos (und wird oben bewusst nicht gemeldet), aber Teile SUMMIEREN sich. B trug
 * „≥ 150 + ≥ 150 + ≥ 450 Wörter" in der Prosa, während die kuratierte Regel auf
 * „400–500" stand — die Untergrenze der Teile lag über der Obergrenze des Ganzen.
 * Gemessen lieferte Haiku 360–364 Wörter: das Modell brach beide Vorgaben und wurde
 * kürzer, statt sich für eine zu entscheiden.
 */
describe('findeUmfangKonflikte — Teil-Richtwerte, die sich zum Widerspruch summieren', () => {
  const B_PROSA = '1. **Hintergrund / Ausgangssituation** (Richtwert ≥ 150 Wörter): Problem, Bedarf, Motivation.\n'
    + '2. **Stand der Technik** (Richtwert ≥ 150 Wörter): bestehende Ansätze/Lösungen und ihre Grenzen.\n'
    + '3. **Lösungsweg** (Richtwert ≥ 450 Wörter): der im Antrag beschriebene Lösungsansatz.';

  it('≥150 + ≥150 + ≥450 gegen Regel 400–500 → Konflikt, mit Summe und Einzelwerten im Text', () => {
    const k = findeUmfangKonflikte(B_PROSA, [regel('wortanzahl', { min: 400, max: 500 })]);
    expect(k.length).toBe(1);
    expect(k[0]).toContain('750');
    expect(k[0]).toContain('150 + 150 + 450');
    expect(k[0]).toContain('400–500');
  });

  it('dieselben Teile gegen Regel „mindestens 750" → KEIN Konflikt (der Stand vor der Kuration)', () => {
    expect(findeUmfangKonflikte(B_PROSA, [regel('wortanzahl', { min: 750 })])).toEqual([]);
  });

  it('Summe innerhalb der Obergrenze → KEIN Konflikt', () => {
    const text = 'A (Richtwert ≥ 100 Wörter) und B (Richtwert ≥ 200 Wörter).';
    expect(findeUmfangKonflikte(text, [regel('wortanzahl', { min: 400, max: 500 })])).toEqual([]);
  });

  it('EIN Teil-Richtwert allein bleibt stumm — auch über der Obergrenze (bewusst konservativ)', () => {
    const text = 'Lösungsweg (Richtwert ≥ 600 Wörter): der Ansatz.';
    expect(findeUmfangKonflikte(text, [regel('wortanzahl', { min: 400, max: 500 })])).toEqual([]);
  });
});
