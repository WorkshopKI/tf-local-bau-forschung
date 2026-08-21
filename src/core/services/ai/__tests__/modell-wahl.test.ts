/**
 * Tests für den Auto-Wechsel des Modells nach Umfang (siehe modell-wahl.ts).
 *
 * Die Kapazitäten sind hier ZEICHEN, nicht Tokens — gemessen wird gegen Zeichen,
 * weil das die Größe ist, die an beiden Aufrufstellen wirklich vorliegt. Die
 * Werte entsprechen grob dem, was `getVbCharCap` aus 62k bzw. 259k Tokens macht.
 */
import { describe, it, expect } from 'vitest';
import { waehleModell } from '../modell-wahl';
import type { KiRolle } from '../modell-katalog';

const KAP: Record<KiRolle, number> = { 'standard': 238_000, stark: 1_185_000 };

describe('waehleModell', () => {
  it('passt hinein → nichts passiert', () => {
    const w = waehleModell('standard', 100_000, KAP);
    expect(w.modell).toBe('standard');
    expect(w.eskaliert).toBe(false);
    expect(w.reichtTrotzdemNicht).toBe(false);
  });

  it('passt NICHT hinein → hebt auf das grosse Modell und meldet es', () => {
    const w = waehleModell('standard', 500_000, KAP);
    expect(w.modell).toBe('stark');
    expect(w.eskaliert).toBe(true);
    expect(w.reichtTrotzdemNicht).toBe(false);
    // Die Meldung braucht beide Zahlen, sonst steht dort „wurde gewechselt" ohne Grund.
    expect(w.zeichen).toBe(500_000);
    expect(w.kapazitaetGewuenscht).toBe(238_000);
  });

  it('genau auf der Grenze passt noch (<=, nicht <)', () => {
    expect(waehleModell('standard', 238_000, KAP).eskaliert).toBe(false);
    expect(waehleModell('standard', 238_001, KAP).eskaliert).toBe(true);
  });

  /**
   * Die Wahl ist eine Untergrenze, keine Schätzung. Wer Qwen3.6 eingestellt hat,
   * hat sich entschieden — ein kurzer Text ist kein Anlass, ihn zu überstimmen.
   */
  it('nie abwaerts: Qwen3.6 bleibt Qwen3.6, auch bei kurzem Text', () => {
    const w = waehleModell('stark', 500, KAP);
    expect(w.modell).toBe('stark');
    expect(w.eskaliert).toBe(false);
  });

  it('reicht auch das grosse Fenster nicht: Wechsel JA, aber als unvollstaendig markiert', () => {
    const w = waehleModell('standard', 2_000_000, KAP);
    expect(w.modell).toBe('stark');
    expect(w.eskaliert).toBe(true);
    // Der Unterschied ist für den Leser wesentlich: gewechselt UND trotzdem gekürzt.
    expect(w.reichtTrotzdemNicht).toBe(true);
  });

  it('schon auf dem groessten Modell und es reicht nicht: kein Wechsel, aber ehrlich', () => {
    const w = waehleModell('stark', 2_000_000, KAP);
    expect(w.modell).toBe('stark');
    expect(w.eskaliert).toBe(false);        // es gibt nichts, wohin gewechselt werden könnte
    expect(w.reichtTrotzdemNicht).toBe(true);
  });

  it('gleich grosse Fenster: kein Wechsel auf ein Modell ohne Zugewinn', () => {
    const gleich: Record<KiRolle, number> = { 'standard': 238_000, stark: 238_000 };
    const w = waehleModell('standard', 500_000, gleich);
    expect(w.modell).toBe('standard');
    expect(w.eskaliert).toBe(false);
    expect(w.reichtTrotzdemNicht).toBe(true);
  });

  it('leerer Text eskaliert nie', () => {
    expect(waehleModell('standard', 0, KAP).eskaliert).toBe(false);
  });

  /**
   * Idempotenz ist keine Kosmetik: `runSkill` UND der Transport treffen dieselbe
   * Entscheidung (der eine früher für den Zeichen-Cap, der andere auf der
   * fertigen Nutzlast). Ein zweiter Durchlauf darf nicht weiter anheben.
   */
  it('idempotent: die Wahl auf sich selbst angewandt aendert nichts mehr', () => {
    const erst = waehleModell('standard', 500_000, KAP);
    const nochmal = waehleModell(erst.modell, 500_000, KAP);
    expect(nochmal.modell).toBe(erst.modell);
    expect(nochmal.eskaliert).toBe(false);
  });
});
