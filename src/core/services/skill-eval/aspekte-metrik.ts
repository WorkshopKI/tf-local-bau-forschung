/**
 * Geteilte, IO-freie Metrik für den Aspekt-Mapping-Baustein der Antrag-Aufbereitung.
 *
 * Precision/Recall/F1 der Sektion→Aspekt-Zuordnung gegen ein handkuratiertes
 * **partielles** Goldset (nur annotierte Sektionen zählen; Zuordnungen zu nicht
 * annotierten Sektionen sind KEIN Fehler). Herausgelöst aus `aufbereitung-eval.ts`
 * (Node-CLI), damit die Node-CLI UND das In-App-Eval-Panel (Browser, Bridge)
 * dieselbe Rechnung verwenden — byte-vergleichbare Zahlen, eine Quelle der Wahrheit.
 *
 * Rein: keine IO, kein Transport, kein DOM. Node- wie Browser-testbar.
 */

/** Ein Goldset-Eintrag: erwartete Aspekt-Buchstaben je Sektions-ID. */
export interface GoldFixture {
  vbFile: string;
  erwartung: Record<string, string[]>;
}

/** Das partielle Goldset (fiktive Fixtures). */
export interface Goldset {
  beschreibung?: string;
  fixtures: GoldFixture[];
}

/** Kennzahlen eines einzelnen Fixtures. */
export interface AspektMetrik {
  /** Getroffene Gold-Paare (Schnitt Gold ∩ Prediction). */
  treffer: number;
  /** Anzahl Gold-Paare (Nenner Recall). */
  goldPaare: number;
  /** Vorhergesagte Paare AUF Gold-Sektionen (Nenner Precision). */
  predAufGold: number;
  precision: number;
  recall: number;
  f1: number;
}

/** Aggregat über mehrere Fixtures (Makro = Mittel je Fixture, Mikro = gepoolt). */
export interface AspektZusammenfassung {
  fixtures: number;
  makroPrecision: number;
  makroRecall: number;
  mikroPrecision: number;
  mikroRecall: number;
  mikroF1: number;
}

/** Sektion→Aspekt-Paare als „sid|A"-Strings (für Mengen-Metriken). */
export function paare(zuAspekte: Record<string, string[]>): Set<string> {
  const s = new Set<string>();
  for (const [sid, aspekte] of Object.entries(zuAspekte)) for (const a of aspekte) s.add(`${sid}|${a}`);
  return s;
}

/**
 * Precision/Recall über die vom Goldset ABGEDECKTEN Sektionen (partielles Goldset):
 * Recall = getroffene Gold-Paare ÷ Gold-Paare; Precision = getroffene Gold-Paare ÷
 * vorhergesagte Paare AUF Gold-Sektionen (Zuordnungen zu nicht annotierten Sektionen
 * zählen nicht als Fehler). F1 = harmonisches Mittel.
 */
export function metriken(gold: Record<string, string[]>, pred: Record<string, string[]>): AspektMetrik {
  const goldSektionen = new Set(Object.keys(gold));
  const goldPaare = paare(gold);
  const predPaare = paare(pred);
  const predAufGold = new Set([...predPaare].filter(p => goldSektionen.has(p.split('|')[0]!)));
  const treffer = [...goldPaare].filter(p => predPaare.has(p)).length;
  const recall = goldPaare.size ? treffer / goldPaare.size : 1;
  const precision = predAufGold.size ? treffer / predAufGold.size : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { treffer, goldPaare: goldPaare.size, predAufGold: predAufGold.size, precision, recall, f1 };
}

/**
 * Aggregiert die Einzel-Metriken zu Makro- (Mittel je Fixture) und Mikro-Werten
 * (gepoolte Zähler/Nenner). Verhaltensgleich mit der bisherigen Inline-Aggregation
 * der CLI (`aufbereitung-eval.ts` `main`).
 */
export function fasseZusammen(einzel: AspektMetrik[]): AspektZusammenfassung {
  const n = einzel.length;
  const gesamt = einzel.reduce(
    (acc, m) => ({
      treffer: acc.treffer + m.treffer,
      goldPaare: acc.goldPaare + m.goldPaare,
      predAufGold: acc.predAufGold + m.predAufGold,
    }),
    { treffer: 0, goldPaare: 0, predAufGold: 0 },
  );
  const precisionSumme = einzel.reduce((s, m) => s + m.precision, 0);
  const recallSumme = einzel.reduce((s, m) => s + m.recall, 0);
  const mikroPrecision = gesamt.predAufGold ? gesamt.treffer / gesamt.predAufGold : 1;
  const mikroRecall = gesamt.goldPaare ? gesamt.treffer / gesamt.goldPaare : 1;
  return {
    fixtures: n,
    makroPrecision: n ? precisionSumme / n : 0,
    makroRecall: n ? recallSumme / n : 0,
    mikroPrecision,
    mikroRecall,
    mikroF1: mikroPrecision + mikroRecall > 0 ? (2 * mikroPrecision * mikroRecall) / (mikroPrecision + mikroRecall) : 0,
  };
}

/**
 * Menschenlesbare Fehlzuordnungen je annotierter Gold-Sektion (für den Report-Block):
 * `k-7: erwartet F, erhalten E`. Nur Sektionen, deren erwartete Buchstaben von den
 * erhaltenen abweichen; leere Seite als „–". Vergleich mengen-basiert (dedupe + sortiert).
 */
export function fehlzuordnungen(gold: Record<string, string[]>, pred: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const sid of Object.keys(gold)) {
    const erwartet = [...new Set(gold[sid] ?? [])].sort();
    const erhalten = [...new Set(pred[sid] ?? [])].sort();
    if (erwartet.join(',') !== erhalten.join(',')) {
      out.push(`${sid}: erwartet ${erwartet.join('') || '–'}, erhalten ${erhalten.join('') || '–'}`);
    }
  }
  return out;
}
