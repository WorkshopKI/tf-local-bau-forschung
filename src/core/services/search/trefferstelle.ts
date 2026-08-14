/**
 * Trefferstellen und Relevanz der Wortlaut-Suche.
 *
 * Bis v4.4.4 bekam JEDER Wortlaut-Treffer den festen Score `1.0`
 * ([useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts), Stage 1). Da die
 * Ähnlichkeitssuche opt-in ist und jede Sitzung auf AUS startet und der
 * Dokumentenindex auf vielen Rechnern leer ist, war der Normalfall: alle Treffer
 * exakt 1.00, die Score-Spalte eine Reihe gleicher Zahlen — und die
 * Standard-Sortierung „nach Score" sortierte nichts, sondern lieferte die
 * Reihenfolge des IDB-Cursors.
 *
 * Dieses Modul rechnet stattdessen aus, WO ein Treffer lag, und leitet daraus
 * eine Relevanz ab. Beides fällt in derselben Prüfung an: der Korpus hält die
 * Felder ohnehin getrennt vor (`AntragTextEntry` in
 * [search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)) — die
 * Feld-Zuordnung ist praktisch geschenkt, sie wurde nur nie mitgeführt.
 *
 * Liegt in der Such-SCHICHT, nicht im Anträge-Plugin: der Ergebnistyp
 * ([search-result.ts](src/core/types/search-result.ts)) und die übergreifende
 * Suche brauchen ihn ebenso, und `core` darf nicht auf ein Plugin zeigen.
 *
 * Rein und ohne IDB/React, damit die Formel ohne Korpus testbar bleibt.
 */

/** Wo ein Treffer lag. `dokument` und `aehnlichkeit` kommen nicht aus dem
 *  Antrags-Korpus, sondern aus dem Orama-Index bzw. dem Embedding-Vergleich —
 *  sie stehen hier, weil sie in derselben Zeile als Herkunft erscheinen. */
export type Trefferfeld =
  | 'titel'
  | 'kurzbeschreibung'
  | 'dokument'
  | 'deskriptoren'
  | 'akronym'
  | 'aktenzeichen'
  | 'organisation'
  | 'domain'
  | 'standort'
  | 'aehnlichkeit';

/** Beschriftung der Trefferstellen-Tags. Kurz, weil sie zu mehreren in einer
 *  Zeile stehen. */
export const TREFFERFELD_LABEL: Record<Trefferfeld, string> = {
  titel: 'Titel',
  kurzbeschreibung: 'Kurzbeschr.',
  dokument: 'Dokument',
  deskriptoren: 'Deskriptoren',
  akronym: 'Akronym',
  aktenzeichen: 'Aktenzeichen',
  organisation: 'Einrichtung',
  domain: 'Web-Adresse',
  standort: 'Ort',
  aehnlichkeit: 'ähnliche Bedeutung',
};

/**
 * Feldgewichte. Die Staffelung sagt, wie stark eine Fundstelle für das Thema des
 * Vorhabens spricht: im Titel steht, worum es geht; in der Einrichtung steht,
 * wer es macht. „HPC Standards GmbH" ist kein fachlicher Standards-Treffer.
 *
 * Die Zahlen sind Gewichte, keine Wahrscheinlichkeiten — nur ihr Verhältnis
 * zählt, und `MAX_GEWICHT` normiert sie auf 0..1.
 */
const GEWICHT: Record<Trefferfeld, number> = {
  titel: 3,
  akronym: 3,
  aktenzeichen: 3,
  kurzbeschreibung: 2,
  dokument: 2,
  deskriptoren: 1.5,
  aehnlichkeit: 1.5,
  organisation: 1,
  // Wie die Einrichtung: sagt WER, nicht worum es geht. Und schwaecher belegt —
  // die Domain ist aus der Kontakt-Mail abgeleitet, nicht erhoben.
  domain: 1,
  standort: 1,
};

const MAX_GEWICHT = 3;

/** Ab wie vielen ZUSÄTZLICHEN Fundstellen die Breite voll zählt. Zwei, weil drei
 *  getroffene Felder (z. B. Titel + Kurzbeschreibung + Dokument) bereits die
 *  deutlichste Form von „das Vorhaben handelt davon" ist. */
const BREITE_SAETTIGUNG = 2;

/** Anteil der Relevanz, den die stärkste Fundstelle trägt. Der Rest kommt aus
 *  der Breite — eine Fundstelle im Titel wiegt schwerer als drei in Randfeldern. */
const ANTEIL_STAERKE = 0.75;

/** Deckel für reine Ähnlichkeitstreffer: ein Vorhaben, in dem KEIN Suchwort
 *  wörtlich vorkommt, kann nie „hoch" werden. Wortlaut schlägt Bedeutung —
 *  sonst verdrängt ein Modellurteil die belegbaren Treffer. */
const AEHNLICHKEIT_DECKEL = 0.5;

/** Anzeige-Reihenfolge der Tags: stärkste Fundstelle zuerst, bei gleichem
 *  Gewicht in fester Reihenfolge (stabil über Renders). */
const REIHENFOLGE: readonly Trefferfeld[] = [
  'titel', 'akronym', 'aktenzeichen', 'kurzbeschreibung', 'dokument',
  'deskriptoren', 'aehnlichkeit', 'organisation', 'domain', 'standort',
];

/** Relevanzstufe. Drei Stufen, weil mehr niemand unterscheiden kann. */
export type RelevanzStufe = 1 | 2 | 3;

export const RELEVANZ_LABEL: Record<RelevanzStufe, string> = {
  3: 'hoch',
  2: 'mittel',
  1: 'gering',
};

const SCHWELLE_HOCH = 0.66;
const SCHWELLE_MITTEL = 0.4;

/**
 * Relevanz eines Wortlaut-Treffers, 0..1.
 *
 * `abdeckung` ist der Anteil der Suchwörter, die überhaupt irgendwo trafen — bei
 * UND immer 1, bei ODER der entscheidende Unterschied zwischen „ein Wort von
 * dreien" und „alle drei".
 *
 * Leere Feldmenge ⇒ 0: ein Treffer ohne benennbare Fundstelle ist kein Treffer.
 */
export function berechneRelevanz(
  felder: Iterable<Trefferfeld>,
  abdeckung: number,
): number {
  let maxGewicht = 0;
  let anzahl = 0;
  for (const f of felder) {
    anzahl++;
    const g = GEWICHT[f];
    if (g > maxGewicht) maxGewicht = g;
  }
  if (anzahl === 0) return 0;
  const staerke = maxGewicht / MAX_GEWICHT;
  const breite = Math.min(1, (anzahl - 1) / BREITE_SAETTIGUNG);
  const roh = staerke * ANTEIL_STAERKE + breite * (1 - ANTEIL_STAERKE);
  return klemme(roh * klemme(abdeckung));
}

/**
 * Relevanz eines reinen Ähnlichkeitstreffers aus der Cosine-Ähnlichkeit.
 * Gedeckelt (siehe `AEHNLICHKEIT_DECKEL`), damit ein Modellurteil nie über einem
 * wörtlichen Titeltreffer landet.
 */
export function relevanzAusAehnlichkeit(cosine: number): number {
  return klemme(cosine) * AEHNLICHKEIT_DECKEL;
}

/** Drei Stufen aus der Relevanz. Monoton — Schwellen als Konstanten oben. */
export function relevanzStufe(relevanz: number): RelevanzStufe {
  if (relevanz >= SCHWELLE_HOCH) return 3;
  if (relevanz >= SCHWELLE_MITTEL) return 2;
  return 1;
}

/** Sortiert die Fundstellen für die Anzeige: stärkste zuerst, stabil. */
export function sortiereFelder(felder: Iterable<Trefferfeld>): Trefferfeld[] {
  const vorhanden = new Set(felder);
  return REIHENFOLGE.filter(f => vorhanden.has(f));
}

/**
 * Zählt, wie oft die Suchwörter in einem Text vorkommen (klein geschrieben,
 * überlappungsfrei). Wird NUR für sichtbare Zeilen gerufen — über 14 000
 * Einträge wäre das Zählen zu teuer, die Feld-Zuordnung dagegen nicht.
 *
 * Ein leeres Wort zählt nie: `''.indexOf('')` ist 0 und würde endlos laufen.
 */
export function zaehleVorkommen(text: string, woerter: readonly string[]): number {
  if (text.length === 0) return 0;
  const hay = text.toLowerCase();
  let summe = 0;
  for (const wort of woerter) {
    if (wort.length === 0) continue;
    let ab = hay.indexOf(wort);
    while (ab !== -1) {
      summe++;
      ab = hay.indexOf(wort, ab + wort.length);
    }
  }
  return summe;
}

function klemme(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
