/**
 * Zwei Prompt-Defekte, die `findeUmfangKonflikte` bauartbedingt nicht sieht, weil
 * keine Zahl von einer anderen ABWEICHT:
 *
 *  - **Dopplung** — der Prompt-Text nennt exakt den Wert, den der Auto-Block
 *    „Formale Vorgaben" ohnehin aus der Regel erzeugt. Heute korrekt, beim nächsten
 *    Regel-Edit die alte Doppelquelle.
 *  - **Rechnerischer Widerspruch** — jede Zahl stimmt für sich, aber die Obergrenzen
 *    sind gemeinsam nicht erfüllbar (der Fall aus Abschnitt A: 8–9 Sätze à 25 Wörter
 *    gegen 1000 Zeichen).
 *
 * Dazu der Vorrang-Satz, den `buildPromptVorgaben` in genau dieser Lage anhängt.
 */
import { describe, it, expect } from 'vitest';
import { buildPromptVorgaben, findeUmfangDopplungen, findeVorgabenWidersprueche } from '../check-engine';
import { SEED_SKILL, SEED_REGELN } from '../seed';
import { resolveRegeln } from '../selectors';
import type { QualitaetsRegel, SkillRegistryFile } from '../types';

function regel(id: string, name: string, typ: string, params: Record<string, unknown>, aktiv = true): QualitaetsRegel {
  return { id, name, typ, params, schweregrad: 'fehler', aktiv, erstellt_am: 't', geaendert_am: 't' };
}

/** Die echten Vorgaben des Kurzfassungs-Skills A (materialisiert wie zur Laufzeit). */
function regelnVonA(): QualitaetsRegel[] {
  const file: SkillRegistryFile = { version: 1, updated_at: 't', skills: [SEED_SKILL], regeln: SEED_REGELN };
  return resolveRegeln(file, SEED_SKILL);
}

describe('findeUmfangDopplungen', () => {
  it('meldet eine Satzzahl, die schon aus der Regel kommt', () => {
    const d = findeUmfangDopplungen(
      'Fasse zu ca. 8 Sätzen zusammen (Toleranz 8–9 Sätze).',
      [regel('r', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 })],
    );
    expect(d.length).toBe(2); // „ca. 8 Sätze" + „Toleranz 8–9 Sätze"
    expect(d[0]).toContain('Formale Vorgaben');
  });

  it('meldet denselben Wortlaut nur EINMAL, auch bei mehreren Fundstellen', () => {
    // Der Live-Seed nennt „ca. 10 Sätze" zweimal (Aufgabe + Ausgabeformat); zwei
    // identische Warnzeilen lesen sich als Render-Fehler.
    const d = findeUmfangDopplungen(
      'Fasse zu ca. 10 Sätzen zusammen.\n\nDer finale Text (ca. 10 Sätze, kein Listenformat).',
      [regel('r', 'Satzanzahl', 'satzanzahl', { min: 9, max: 11 })],
    );
    expect(d.length).toBe(1);
  });

  it('schweigt bei ABWEICHUNG — das ist Sache des Konflikt-Checks', () => {
    expect(findeUmfangDopplungen('Toleranz 3–4 Sätze.', [regel('r', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 })]))
      .toEqual([]);
  });

  it('meldet ein doppeltes Zeichenlimit', () => {
    const d = findeUmfangDopplungen('Maximal 1000 Zeichen.', [regel('r', 'Zeichenlimit', 'zeichen_max', { max: 1000 })]);
    expect(d.length).toBe(1);
  });

  it('bleibt bei weichen Teil-Richtwerten still', () => {
    const text = '1. Projektziel (2 Sätze)\n2. Anwendungsbereich (1 Satz)';
    expect(findeUmfangDopplungen(text, [regel('r', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 })])).toEqual([]);
  });

  it('ignoriert inaktive Regeln', () => {
    expect(findeUmfangDopplungen('Toleranz 8–9 Sätze.', [regel('r', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 }, false)]))
      .toEqual([]);
  });
});

describe('findeVorgabenWidersprueche', () => {
  it('erkennt die Kombination aus Abschnitt A als unerfüllbar', () => {
    const w = findeVorgabenWidersprueche(regelnVonA());
    expect(w.length).toBeGreaterThan(0);
    expect(w[0]).toContain('nicht gleichzeitig erfüllbar');
  });

  it('schweigt, wenn das Zeichenlimit zum Satzbudget passt', () => {
    const w = findeVorgabenWidersprueche([
      regel('z', 'Zeichenlimit', 'zeichen_max', { max: 5000 }),
      regel('sa', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 }),
      regel('sl', 'Satzlänge', 'satzlaenge_max', { maxWoerter: 25 }),
    ]);
    expect(w).toEqual([]);
  });

  it('meldet auch eine Mindest-Wortzahl, die das Zeichenlimit sprengt', () => {
    const w = findeVorgabenWidersprueche([
      regel('z', 'Zeichenlimit', 'zeichen_max', { max: 1000 }),
      regel('wo', 'Wortanzahl', 'wortanzahl', { min: 450 }),
    ]);
    expect(w.length).toBe(1);
    expect(w[0]).toContain('schließen einander aus');
  });

  it('ohne Zeichenlimit gibt es nichts zu melden', () => {
    expect(findeVorgabenWidersprueche([regel('sa', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 })])).toEqual([]);
  });
});

describe('buildPromptVorgaben — Vorrang der Zeichenzahl', () => {
  it('benennt den Vorrang, wenn Zeichenlimit und Satz-Vorgabe zusammentreffen', () => {
    const block = buildPromptVorgaben(regelnVonA());
    expect(block).toContain('hat die Zeichenzahl Vorrang');
    // Genau einmal — sonst stünde die Auflösung mehrfach im Prompt.
    expect(block.split('hat die Zeichenzahl Vorrang').length - 1).toBe(1);
  });

  it('schweigt ohne Zeichenlimit (Bestands-Skills bleiben unverändert)', () => {
    const block = buildPromptVorgaben([regel('sa', 'Satzanzahl', 'satzanzahl', { min: 8, max: 9 })]);
    expect(block).toContain('Schreibe 8 bis 9 Sätze.');
    expect(block).not.toContain('Vorrang');
  });

  it('schweigt bei einem Zeichenlimit ohne konkurrierende Vorgabe', () => {
    const block = buildPromptVorgaben([regel('z', 'Zeichenlimit', 'zeichen_max', { max: 1000 })]);
    expect(block).not.toContain('Vorrang');
  });
});
