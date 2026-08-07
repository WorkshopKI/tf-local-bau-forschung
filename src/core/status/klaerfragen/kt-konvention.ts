/**
 * Die **K/T-Konvention** der Kürzel — und die Prüfung, ob sie irgendwo bricht.
 *
 * Kürzelpaare, die sich nur im letzten Buchstaben unterscheiden, meinen
 * dieselbe Handlung in zwei Zuständigkeiten: `K` kaufmännisch, `T` technisch.
 * Gemessen am Bestand trägt die Konvention über **19 Paare** — und genau eines
 * war verdreht: `XVK`/`XVT` in der Spalte NW, wo FuE dasselbe Paar richtig
 * herum führt. Das ist korrigiert ([kuerzel-kuration.ts](../kuerzel-kuration.ts)).
 *
 * **Gefundene Fälle werden Klärfälle, nie Korrekturen.** `XVK`/`XVT` sind
 * belegt — die Antwort sagt ausdrücklich „immer kaufmännisch, nicht technisch".
 * Alles Weitere wäre Vermutung, und eine Vermutung als Wert einzutragen ist
 * genau der Fehler, den diese Prüfung verhindern soll.
 *
 * **Eine leere Ergebnisliste ist das gute Ergebnis** — und ohne Gegenprobe
 * nicht von einer kaputten Prüfung zu unterscheiden. Deshalb nimmt
 * {@link ktVerstoesse} die Paare als Parameter mit Vorgabe, wie es
 * `bezeichnungsAbweichungen` für die bestätigten Wortlaute tut.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import {
  alleKuerzel, kuerzelAuskunft, type Nachschlageform, type Projektform,
} from '../kuerzel-katalog';
import type { Klaerfrage } from './typen';

/** Wörter, die eine Bezeichnung als kaufmännisch bzw. technisch ausweisen. */
const KAUFMAENNISCH = ['kaufm', 'kfm', 'adm.', 'administrativ'];
const TECHNISCH = ['techn', 'tech.', 'fachl'];

/** Die vier Formen der Zuarbeit — DS antwortet die Kuration, hier irrelevant. */
const FORMEN: readonly Projektform[] = ['NW', 'FuE', 'DL', 'EP'];

export type KtSeite = 'K' | 'T';

/** Ein Kürzelpaar, das sich nur im Schluss-`K`/`T` unterscheidet. */
export interface KtPaar {
  /** Der gemeinsame Stamm, z. B. `XV`. */
  stamm: string;
  form: Projektform;
  kBezeichnung: string;
  tBezeichnung: string;
}

/** Ein Paar, dessen Bezeichnungen der Konvention widersprechen. */
export interface KtVerstoss extends KtPaar {
  /**
   * Welche Seite falsch aussieht — `'K'`, wenn das K-Kürzel technisch klingt.
   * `'beide'`, wenn sie schlicht vertauscht sind (der belegte `XVK`/`XVT`-Fall).
   */
  seite: KtSeite | 'beide';
}

function enthaelt(text: string, woerter: readonly string[]): boolean {
  const k = text.toLowerCase();
  return woerter.some(w => k.includes(w));
}

/**
 * Alle K/T-Paare des Katalogs, je Projektform — **nach** Kuration und
 * Quellkorrektur, denn geprüft wird, was die App zeigt.
 */
export function ktPaare(): KtPaar[] {
  const alle = alleKuerzel();
  const bekannt = new Set(alle);
  const out: KtPaar[] = [];
  for (const kuerzel of alle) {
    if (!kuerzel.endsWith('K')) continue;
    const stamm = kuerzel.slice(0, -1);
    if (!bekannt.has(`${stamm}T`)) continue;
    for (const form of FORMEN) {
      const k = kuerzelAuskunft(kuerzel, form as Nachschlageform);
      const t = kuerzelAuskunft(`${stamm}T`, form as Nachschlageform);
      // Nur wo BEIDE Seiten in dieser Form geführt sind: eine geliehene
      // Bezeichnung gegen eine eigene zu halten vergliche zwei Aussagen über
      // verschiedene Projektformen.
      if (k.herkunft !== 'form' || t.herkunft !== 'form') continue;
      if (k.bezeichnung === null || t.bezeichnung === null) continue;
      out.push({ stamm, form, kBezeichnung: k.bezeichnung, tBezeichnung: t.bezeichnung });
    }
  }
  return out;
}

/**
 * Paare, deren Bezeichnungen der Konvention widersprechen.
 *
 * Gewertet wird nur, wo **beide** Seiten sich eindeutig einordnen lassen: sagt
 * eine Bezeichnung weder kaufmännisch noch technisch, ist das kein Verstoß,
 * sondern eine Bezeichnung ohne Zuständigkeitswort. Schweigen ist kein Befund.
 */
export function ktVerstoesse(paare: readonly KtPaar[] = ktPaare()): KtVerstoss[] {
  const out: KtVerstoss[] = [];
  for (const p of paare) {
    const kKauf = enthaelt(p.kBezeichnung, KAUFMAENNISCH);
    const kTech = enthaelt(p.kBezeichnung, TECHNISCH);
    const tKauf = enthaelt(p.tBezeichnung, KAUFMAENNISCH);
    const tTech = enthaelt(p.tBezeichnung, TECHNISCH);
    // Beide Seiten müssen sich eindeutig einordnen lassen.
    if (kKauf === kTech || tKauf === tTech) continue;
    if (kKauf && tTech) continue;                       // richtig herum
    const seite = kTech && tKauf ? 'beide' : (kTech ? 'K' : 'T');
    out.push({ ...p, seite });
  }
  return out;
}

const SEITE_TEXT: Readonly<Record<KtSeite | 'beide', string>> = {
  K: 'Das K-Kürzel klingt technisch.',
  T: 'Das T-Kürzel klingt kaufmännisch.',
  beide: 'Die beiden Bezeichnungen sind vertauscht.',
};

/**
 * Je Verstoß eine Frage. Heute leer — die eine belegte Vertauschung ist
 * korrigiert, die 18 übrigen Paare tragen die Konvention.
 */
export function ktFragen(verstoesse: readonly KtVerstoss[] = ktVerstoesse()): Klaerfrage[] {
  return verstoesse.map(v => ({
    id: `kt-konvention:${v.stamm}:${v.form}`,
    herkunft: 'kt-konvention' as const,
    betrifft: `${v.stamm}K / ${v.stamm}T (${v.form})`,
    frage: `Sind die Bezeichnungen von „${v.stamm}K" und „${v.stamm}T" in ${v.form} richtig zugeordnet?`,
    kontext: `${v.stamm}K: „${v.kBezeichnung}" · ${v.stamm}T: „${v.tBezeichnung}". `
      + `${SEITE_TEXT[v.seite]} Nach der Konvention steht K für kaufmännisch bzw. `
      + `administrativ, T für technisch bzw. fachlich; sie trägt über die übrigen `
      + `Paare des Katalogs. Das ist ein VERDACHT — korrigiert wird nichts, bevor `
      + `die Antwort da ist.`,
    optionen: [
      'richtig so — die Konvention gilt hier nicht',
      'vertauscht — die Bezeichnungen gehören getauscht',
      'unklar',
    ],
    // Die Frage hängt am Katalog, nicht am Bestand: sie gilt für jeden Vorgang
    // dieser Projektform, der eines der beiden Kürzel trägt.
    vorkommen: null,
  }));
}
