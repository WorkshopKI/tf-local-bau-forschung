/**
 * Der Balken zählt einmal — nicht je Phase.
 *
 * Der gemeldete Fehler war nicht „die Zahl ist falsch", sondern „die Skala
 * wechselt mitten im Lauf". Deshalb prüft dieser Test nicht einzelne Prozentwerte,
 * sondern die EIGENSCHAFT der ganzen Folge: monoton, genau einmal bei 100.
 */
import { describe, it, expect } from 'vitest';
import {
  berechneGesamt, istZaehlbar, PHASEN_LABEL, type BauPhase, type BauPlan,
} from '../bauFortschritt';

/** Die Folge, die ein echter Lauf erzeugt — Tick für Tick. */
function laufProzente(plan: BauPlan): number[] {
  const werte: number[] = [berechneGesamt(plan, 'vorbereiten', 0).prozent];
  for (let i = 1; i <= plan.antrag; i++) werte.push(berechneGesamt(plan, 'antrag', i).prozent);
  for (let i = 1; i <= plan.verbund; i++) werte.push(berechneGesamt(plan, 'verbund', i).prozent);
  werte.push(berechneGesamt(plan, 'centroids', 0).prozent);
  werte.push(berechneGesamt(plan, 'spiegeln', 0).prozent);
  return werte;
}

describe('bauFortschritt — ein Lauf, eine Skala', () => {
  const plan: BauPlan = { antrag: 14_221, verbund: 7_535 };

  it('steigt monoton über den ganzen Lauf', () => {
    const werte = laufProzente(plan);
    for (let i = 1; i < werte.length; i++) {
      expect(werte[i]).toBeGreaterThanOrEqual(werte[i - 1] as number);
    }
  });

  it('erreicht 100 % erst am Ende — nicht schon nach der ersten Phase', () => {
    // Der Kern des Bugs: hier stand die Leiste voll, obwohl 7.535 Vektoren
    // fehlten, und fiel danach auf 0 zurück.
    const endeErstePhase = berechneGesamt(plan, 'antrag', plan.antrag).prozent;
    expect(endeErstePhase).toBeCloseTo(65.37, 2); // 14.221 von 21.756
    expect(berechneGesamt(plan, 'verbund', 1).prozent).toBeGreaterThan(endeErstePhase);
  });

  it('beginnt bei 0 und endet bei 100', () => {
    const werte = laufProzente(plan);
    expect(werte[0]).toBe(0);
    expect(werte[werte.length - 1]).toBe(100);
    expect(werte.filter(w => w === 100)).toHaveLength(3); // letzter Verbund + centroids + spiegeln
  });

  it('setzt die zweite Phase auf die erste auf, statt bei null zu beginnen', () => {
    const g = berechneGesamt(plan, 'verbund', 0);
    expect(g.gesamtDone).toBe(plan.antrag);
    expect(g.gesamtTotal).toBe(plan.antrag + plan.verbund);
  });

  it('bleibt bei einem Nachzieh-Lauf ohne Verbund-Arbeit gültig', () => {
    // `verbund: 0` kam vor: die Verbund-Phase kennt nur „fehlt", keine
    // Text-Hashes. Der Balken darf davon nicht durch null teilen.
    const klein: BauPlan = { antrag: 136, verbund: 0 };
    expect(berechneGesamt(klein, 'antrag', 68).prozent).toBeCloseTo(50, 5);
    expect(berechneGesamt(klein, 'antrag', 136).prozent).toBe(100);
  });

  it('liefert 0 statt NaN, wenn es nichts zu tun gibt', () => {
    const leer: BauPlan = { antrag: 0, verbund: 0 };
    expect(berechneGesamt(leer, 'antrag', 0).prozent).toBe(0);
  });

  it('überschreitet 100 nicht, wenn eine Phase mehr meldet als geplant', () => {
    expect(berechneGesamt(plan, 'verbund', plan.verbund + 50).prozent).toBe(100);
  });

  it('kennt genau zwei zählbare Phasen und für jede Phase ein Label', () => {
    const alle: BauPhase[] = ['vorbereiten', 'antrag', 'verbund', 'centroids', 'spiegeln'];
    expect(alle.filter(istZaehlbar)).toEqual(['antrag', 'verbund']);
    for (const phase of alle) expect(PHASEN_LABEL[phase]).toBeTruthy();
  });
});
