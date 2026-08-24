import { describe, it, expect } from 'vitest';
import { chooseRetryModifier, retryKorrekturAnweisung } from '../retry-policy';
import type { CheckResult, QualitaetsRegel } from '@/core/services/skills';

const check = (over: Partial<CheckResult>): CheckResult => ({ id: 'r', level: 'fehler', label: 'L', ...over });

describe('chooseRetryModifier — deterministische Modifier-Wahl', () => {
  it('keine Fehler (leer / nur ok / nur hinweis) → null (kein Retry)', () => {
    expect(chooseRetryModifier([])).toBeNull();
    expect(chooseRetryModifier([check({ level: 'ok' })])).toBeNull();
    expect(chooseRetryModifier([check({ level: 'hinweis', richtung: 'zu_lang' })])).toBeNull();
  });

  it('alle Fehler „zu lang" → kuerzer', () => {
    expect(chooseRetryModifier([check({ richtung: 'zu_lang' })])).toBe('kuerzer');
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b', richtung: 'zu_lang' }),
    ])).toBe('kuerzer');
  });

  it('alle Fehler „zu kurz" → laenger', () => {
    expect(chooseRetryModifier([check({ richtung: 'zu_kurz' })])).toBe('laenger');
  });

  it('Fehler ohne Richtung (verbotenes Muster etc.) → neu', () => {
    expect(chooseRetryModifier([check({})])).toBe('neu');
    // gemischt: Größen-Fehler + richtungsloser Fehler → neu
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b' }),
    ])).toBe('neu');
  });

  it('widersprüchliche Richtungen (zu lang UND zu kurz) → neu', () => {
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b', richtung: 'zu_kurz' }),
    ])).toBe('neu');
  });

  it('ignoriert hinweis-Level-Checks bei der Richtungsbestimmung', () => {
    // Ein zu_lang-Fehler + ein hinweis (mit Gegenrichtung) → nur der Fehler zählt → kuerzer
    expect(chooseRetryModifier([
      check({ id: 'a', level: 'fehler', richtung: 'zu_lang' }),
      check({ id: 'b', level: 'hinweis', richtung: 'zu_kurz' }),
    ])).toBe('kuerzer');
  });
});

/**
 * Loop-Terminierung: simuliert den Hook-Orchestrator als reine Schleife über
 * chooseRetryModifier — er endet IMMER nach höchstens N Versuchen (harte Decke).
 */
describe('Auto-Retry-Loop — Terminierung (Decke N)', () => {
  function simulate(persistentChecks: CheckResult[], max: number): number {
    let checks: CheckResult[] | null = persistentChecks;
    let attempt = 0;
    while (checks && attempt < max) {
      const mod = chooseRetryModifier(checks);
      if (!mod) break;
      attempt += 1;
      checks = persistentChecks; // Fehler bleibt bestehen (worst case)
    }
    return attempt;
  }

  it('läuft höchstens N-mal bei dauerhaftem Fehler', () => {
    expect(simulate([check({ richtung: 'zu_lang' })], 2)).toBe(2);
    expect(simulate([check({ richtung: 'zu_lang' })], 0)).toBe(0);
    expect(simulate([check({ richtung: 'zu_lang' })], 3)).toBe(3);
  });

  it('kein Retry, wenn nur Hinweise/ok bestehen', () => {
    expect(simulate([check({ level: 'ok' })], 3)).toBe(0);
  });
});

/**
 * Der Modifier allein sagt nur die RICHTUNG („länger"), nicht das Ziel. Gemessen
 * (Haiku, Abschnitt C, 08/2026): 270 → 363 Wörter bei einem Band von 300–350 — die
 * Korrektur schoss über und riss die Vorgabe auf der anderen Seite. Der Zielwert ist
 * deterministisch bekannt und stand schon am manuellen Korrektur-Knopf zur Verfügung.
 */
describe('retryKorrekturAnweisung — der Zielwert zum Modifier', () => {
  const wortRegel = (over: Partial<QualitaetsRegel> = {}): QualitaetsRegel => ({
    id: 'r-wort', name: 'Wortanzahl', typ: 'wortanzahl',
    params: { min: 300, max: 350 }, schweregrad: 'fehler', aktiv: true,
    erstellt_am: 't', geaendert_am: 't', ...over,
  });

  it('„zu kurz" nennt die Untergrenze und den Ist-Wert', () => {
    const k = retryKorrekturAnweisung(
      [check({ id: 'r-wort', regelId: 'r-wort', richtung: 'zu_kurz', messwert: 270 })],
      [wortRegel()],
      'laenger',
    );
    expect(k?.anweisung).toContain('300');
    expect(k?.anweisung).toContain('270');
    expect(k?.regelId).toBe('r-wort');
  });

  it('„zu lang" nennt die Obergrenze', () => {
    const k = retryKorrekturAnweisung(
      [check({ id: 'r-wort', regelId: 'r-wort', richtung: 'zu_lang', messwert: 420 })],
      [wortRegel()],
      'kuerzer',
    );
    expect(k?.anweisung).toContain('350');
  });

  it('nimmt NUR den Check, dessen Korrektur zum gewählten Modifier passt', () => {
    // Zwei Fehler, gegenläufig: der Modifier ist bereits auf „laenger" gefallen,
    // die Anweisung darf dann nicht die Kürzungs-Vorgabe nachreichen.
    const k = retryKorrekturAnweisung(
      [
        check({ id: 'r-zeichen', regelId: 'r-zeichen', richtung: 'zu_lang', messwert: 9000 }),
        check({ id: 'r-wort', regelId: 'r-wort', richtung: 'zu_kurz', messwert: 270 }),
      ],
      [wortRegel(), { ...wortRegel(), id: 'r-zeichen', typ: 'zeichen_max', params: { max: 1100 } }],
      'laenger',
    );
    expect(k?.regelId).toBe('r-wort');
  });

  it('kein passender Check (z.B. Modifier „neu") → null, der Lauf bleibt wie bisher', () => {
    expect(retryKorrekturAnweisung([check({ id: 'r-muster', regelId: 'r-muster' })], [wortRegel()], 'neu')).toBeNull();
  });

  it('Hinweise zaehlen nicht — nur was den Retry ausgeloest hat', () => {
    expect(retryKorrekturAnweisung(
      [check({ id: 'r-wort', regelId: 'r-wort', level: 'hinweis', richtung: 'zu_kurz', messwert: 270 })],
      [wortRegel()],
      'laenger',
    )).toBeNull();
  });

  it('fehlende Regel zum Check → null (kein Raten)', () => {
    expect(retryKorrekturAnweisung(
      [check({ id: 'r-wort', regelId: 'r-wort', richtung: 'zu_kurz', messwert: 270 })],
      [],
      'laenger',
    )).toBeNull();
  });
});
