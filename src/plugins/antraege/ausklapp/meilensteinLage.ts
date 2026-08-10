/**
 * Die **Meilenstein-Lage einer Zeile** — was der aufgeklappte Bereich über die
 * Meilensteine dieses Vorgangs weiß, bevor irgendetwas gezeichnet wird.
 *
 * **Warum ein eigener Typ.** Drei Bausteine fragen dasselbe (Kopfkarte,
 * Meilenstein-Ebene, Gliederung), und jeder hat vier Gründe, nichts zeigen zu
 * können: das Flag ist aus, die Zeile hat keinen Verbund, der Plan lädt noch,
 * oder es gibt keinen freigegebenen. Ohne benannte Lage prüfte jeder Baustein
 * drei Nullwerte und schwiege beim vierten Fall — genau das, was Pitfall #44
 * verbietet: **Unbelegbares bekommt ein eigenes Urteil, nie Schweigen.**
 *
 * **Blatt heißt hier dasselbe wie in der Engine.** `bewertung.ts` zählt nur
 * Blätter in die Prognose („ein Sammel-Knoten aggregiert seine Kinder; würde er
 * zusätzlich selbst zählen, wäre derselbe Verzug doppelt in der Rechnung").
 * Blocker und Achse müssen dieselbe Menge nehmen — eine zweite Blattregel liefe
 * beim ersten typgefilterten Plan auseinander.
 *
 * Rein: kein React, keine IO, keine Uhr.
 */
import type {
  MeilensteinKnoten, MstErgebnis, MstZustand, VerbundMeilensteine,
} from '@/core/meilensteine/typen';

/** Warum keine Meilensteine dastehen — oder dass welche dastehen. */
export type MeilensteinLage =
  /** `features.meilensteinMonitoring` ist in dieser Variante nicht gebaut. */
  | { art: 'flagAus' }
  /** Die Zeile hängt an keinem Verbund; ohne ihn gibt es keinen Plan. */
  | { art: 'ohneVerbund' }
  | { art: 'laedt' }
  /** Kein freigegebener Plan (oder gar keiner). */
  | { art: 'ohnePlan' }
  | { art: 'da'; knoten: readonly MeilensteinKnoten[]; bewertung: VerbundMeilensteine };

/** Ein Knoten samt seiner Bewertung — das Paar, mit dem hier überall gearbeitet wird. */
export interface Stufe {
  knoten: MeilensteinKnoten;
  ergebnis: MstErgebnis;
  zustand: MstZustand;
  /** Kein relevantes Kind — zählt einzeln, nicht über eine Rolle als Sammler. */
  blatt: boolean;
}

/**
 * Paart Knoten mit Bewertung, in der Reihenfolge des Plans.
 *
 * Knoten ohne Ergebnis fallen heraus statt einen erfundenen Zustand zu
 * bekommen: eine Bewertung, die einen Knoten nicht kennt, ist eine andere
 * Fassung — dann lieber eine Stufe weniger als eine geratene.
 */
export function baueStufen(lage: MeilensteinLage): Stufe[] {
  if (lage.art !== 'da') return [];
  const nachId = new Map(lage.bewertung.ergebnisse.map(e => [e.knotenId, e]));
  const paare = lage.knoten
    .map(knoten => ({ knoten, ergebnis: nachId.get(knoten.id) }))
    .filter((p): p is { knoten: MeilensteinKnoten; ergebnis: MstErgebnis } => p.ergebnis !== undefined);

  // Dieselbe Blattregel wie `bewertung.ts`: Eltern, auf die ein RELEVANTES Kind
  // zeigt, sind Sammler. Ein Knoten, dessen Kinder alle typfremd sind, ist
  // dagegen sehr wohl ein Blatt — sonst verschwände er aus jeder Auswahl.
  const sammler = new Set<string>();
  for (const p of paare) {
    if (p.knoten.elternId === null) continue;
    if (p.ergebnis.zustand === 'nichtRelevant') continue;
    sammler.add(p.knoten.elternId);
  }

  return paare.map(p => ({
    knoten: p.knoten,
    ergebnis: p.ergebnis,
    zustand: p.ergebnis.zustand,
    blatt: !sammler.has(p.knoten.id),
  }));
}

/**
 * Ordnungsschlüssel einer Anzeige-Nummer: `1.4.3` → `[1, 4, 3]`.
 *
 * Gebraucht als Gleichstand-Brecher. Lexikographisch verglichen stünde `1.10`
 * vor `1.4`, und die Auswahl des Blockers wechselte, sobald der Plan zehn
 * Teilschritte bekommt.
 */
export function nummerSchluessel(nummer: string): number[] {
  return nummer.split('.').map(t => {
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? 0 : n;
  });
}

/** Vergleicht zwei Nummern-Schlüssel; kürzer und gleich heißt weiter oben. */
export function vergleicheNummer(a: string, b: string): number {
  const x = nummerSchluessel(a);
  const y = nummerSchluessel(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Trifft die Nummer einer Marke die einer Gliederungszeile — sie selbst oder
 * ein Nachfahre?
 *
 * Über den Punkt, nicht über den nackten Präfix: `'1.40'.startsWith('1.4')` ist
 * wahr, gemeint ist es nicht.
 */
export function trifftPraefix(marke: string, knoten: string): boolean {
  return marke === knoten || marke.startsWith(`${knoten}.`);
}
