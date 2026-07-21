/**
 * Normalisierung der Auslöser-Texte.
 *
 * Sowohl die Präzisions-Nachforderungen als auch die Zielkriterien werden über
 * einen Text identifiziert, den ein Modell geliefert hat (Delta-Parameter,
 * Unschärfe-Begriff). Ein Neu-Lauf formuliert denselben Sachverhalt leicht anders
 * — mal mit Leerzeichen zu viel, mal gross geschrieben. Ohne Normalisierung
 * verlöre die Abwahl eines Zielkriteriums nach jedem Lauf ihre Wirkung.
 *
 * Bewusst konservativ: nur Grosskleinschreibung und Leerraum. Weiter zu
 * normalisieren (Stammformen, Synonyme) würde verschiedene Parameter
 * zusammenwerfen, und eine falsch geteilte Abwahl fiele niemandem auf.
 *
 * Rein.
 */

/** Vergleichsform eines Auslöser-Textes. Rein. */
export function normalisiere(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
