/**
 * Ein Balken für einen Lauf — die Rechnung dahinter, ohne React.
 *
 * **Was vorher falsch war.** Die Karte rechnete `done / total` der LAUFENDEN
 * Phase. Ein Vollbau hat aber zwei zählbare Phasen, und die zweite fing wieder
 * bei null an: der Balken lief auf 100 %, sprang zurück, lief noch einmal auf
 * 100 % — davor stand er auf dem Bestandswert von VOR dem Lauf (98 %), danach
 * wieder. Vier Werte, die alle „Fortschritt" hießen und nichts miteinander zu
 * tun hatten.
 *
 * Hier steht die Rechnung deshalb einmal und als reine Funktion: ein Lauf, eine
 * Skala, monoton von 0 auf 100. Dass sie monoton ist, ist testbar — im JSX wäre
 * es nur behauptet.
 *
 * **Was eine Einheit ist**: ein eingebetteter Vektor. Beide zählbaren Phasen
 * embedden genau einen Text je Element, also wiegen sie gleich. Centroids und
 * Spiegeln sind nicht in Vektoren zählbar; sie stehen am vollen Balken und
 * sagen im Text, was sie tun.
 */

export type BauPhase = 'vorbereiten' | 'antrag' | 'verbund' | 'centroids' | 'spiegeln';

export const PHASEN_LABEL: Record<BauPhase, string> = {
  vorbereiten: 'Modell und Arbeitsliste werden vorbereitet…',
  antrag: 'Vorhaben-Vektoren',
  verbund: 'Verbund-Vektoren',
  centroids: 'Kategorie-Centroids berechnen…',
  spiegeln: 'Spiegle den Korpus auf den Datenspeicher…',
};

/** Die Phasen, die einzelne Elemente zählen — und damit den Balken tragen. */
export const ZAEHLBARE_PHASEN: readonly BauPhase[] = ['antrag', 'verbund'];

export function istZaehlbar(phase: BauPhase): boolean {
  return ZAEHLBARE_PHASEN.includes(phase);
}

/**
 * Wie viele Elemente die beiden zählbaren Phasen haben.
 *
 * Vor dem Lauf geschätzt (aus Bestand + geplanter Verbund-Queue), während des
 * Laufs von den echten `total`-Meldungen korrigiert. Die Korrektur fällt beim
 * ersten Tick an und ist deshalb unsichtbar — anders als ein Balken, der erst
 * bei Phase 2 erfährt, dass es Phase 2 gibt.
 */
export interface BauPlan {
  antrag: number;
  verbund: number;
}

export interface Gesamtstand {
  /** Erledigte Elemente über beide zählbaren Phasen. */
  gesamtDone: number;
  /** Elemente über beide zählbaren Phasen. */
  gesamtTotal: number;
  prozent: number;
}

/**
 * Der Stand des GANZEN Laufs, während Phase `phase` bei `doneInPhase` steht.
 *
 * `vorbereiten` steht vor jeder Zählung (0 %); `centroids` und `spiegeln` liegen
 * hinter beiden Zählphasen, also sind ihre Vektoren fertig (100 %).
 */
export function berechneGesamt(
  plan: BauPlan,
  phase: BauPhase,
  doneInPhase: number,
): Gesamtstand {
  const gesamtTotal = plan.antrag + plan.verbund;

  if (phase === 'vorbereiten') {
    return { gesamtDone: 0, gesamtTotal, prozent: 0 };
  }
  if (!istZaehlbar(phase)) {
    return { gesamtDone: gesamtTotal, gesamtTotal, prozent: 100 };
  }

  // Phase 2 steht auf allem, was Phase 1 erledigt hat. Genau dieser Sockel
  // fehlte — ohne ihn beginnt jede Phase wieder bei null.
  const sockel = phase === 'verbund' ? plan.antrag : 0;
  const gesamtDone = Math.min(gesamtTotal, sockel + doneInPhase);
  const prozent = gesamtTotal > 0
    ? Math.min(100, (gesamtDone / gesamtTotal) * 100)
    : 0;
  return { gesamtDone, gesamtTotal, prozent };
}
