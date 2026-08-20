/**
 * Trennzeichen-blinder Vergleich — für NAMENSFELDER, nicht für Fließtext.
 *
 * Am echten Bestand ausgezählt (v4.123, [suche-relevanz.md §12](docs/architecture/suche-relevanz.md)):
 * die Schreibweisen-Drift der Netzwerknamen ist fast nie ein Tippfehler. Von 377
 * Paaren Haupt-↔-Nebenschreibweise war die Menge, die NUR ein Abstandsmaß
 * („meintest du …?") gerettet hätte, **leer** — 17 Paare VERSCHIEDENER Netzwerke
 * liegen dagegen bei Abstand 1. Was übrig blieb, ist eine Klasse, die kein Raten
 * braucht: dieselbe Sache, anders getrennt.
 *
 *     "sws energie"  ↔  "swsenergie"
 *     "nafa-tech"    ↔  "nafa tech"
 *     "f.i.t."       ↔  "f.i.t"
 *     "h2 apply"     ↔  "h2apply"  ↔  "h2-apply"
 *
 * Der Stern aus v4.123 hilft hier ausdrücklich NICHT: er bleibt im Wort, und
 * genau die Wortfuge ist ja der Unterschied.
 *
 * ## Die Regel
 *
 * Verglichen wird der **Kern** — der Wert ohne alles, was kein Buchstabe und
 * keine Ziffer ist. Die Nadel darf damit über eine Fuge laufen, **muss aber an
 * einem Wortanfang des Originals beginnen**.
 *
 * Diese zweite Hälfte ist die eigentliche Leitplanke. Ohne sie fände `bona` das
 * Netzwerk „lab on a chip" (`la·bona·chip`) — der Kern hat keine Wortgrenzen
 * mehr, an denen ein Fund scheitern könnte. Mit ihr muss die Nadel dort
 * anfangen, wo im Original ein Wort anfängt; `bona` beginnt mitten in „lab" und
 * fällt durch.
 *
 * Der Kern ist damit in der Wortmitte STRENGER als der gewöhnliche Vergleich
 * (`enthaeltAlsWortteil` lässt zwei Zeichen Vorsilbe zu, für deutsche
 * Zusammensetzungen). Das ist Absicht: die Fuge zu überspringen ist die neue
 * Fähigkeit, das Wort aufzubrechen war nie eine.
 *
 * ## Warum nur Namen
 *
 * Fiele im Abstract auch das Leerzeichen weg, könnte eine Nadel über einen
 * Satzpunkt hinweg treffen — `einlaser` fände „…ein. Laser…". Das ist derselbe
 * Fehler, den `.*` beim Stern gemacht hätte. `KERN_FELDER` hält deshalb genau
 * die zwei Felder, deren Inhalt EIN Name ist.
 *
 * Rein — kein React, kein IDB.
 */
import type { Trefferfeld } from './trefferstelle';

/** Buchstabe oder Ziffer — alles andere ist eine Fuge. Modul-global compiliert:
 *  die Faltung läuft über 14 000 Einträge beim Laden des Korpus. */
const WORTZEICHEN = /[\p{L}\p{N}]/u;

/** Alles, was KEIN Wortzeichen ist. Ein nativer `replace` statt einer Schleife —
 *  gemessen 28 ms für den ganzen Korpus. */
const FUGEN = /[^\p{L}\p{N}]/gu;

/**
 * Wie viele Zeichen der Kern einer Nadel mindestens tragen muss.
 *
 * Drei, wie die Untergrenze der Platzhalter (`MIN_FESTE_ZEICHEN` in
 * [wortstamm.ts](./wortstamm.ts)) und aus demselben Grund: eine zweistellige
 * Nadel, die über Fugen laufen darf, trifft die halbe Namensliste. Am Bestand
 * kostet die Grenze nichts Nennenswertes und rettet `f.i.t` (Kern `fit`,
 * 20 Anträge) und `e-nv` (Kern `env`, 5) gerade noch.
 */
const MIN_KERN = 3;

/**
 * Die Felder, die trennzeichen-blind verglichen werden: die beiden, deren
 * ganzer Inhalt ein NAME ist.
 *
 * `organisation` steht bewusst nicht dabei, obwohl auch dort Namen stehen — der
 * Wert ist dort ein ganzer Satz („Gesellschaft zur Förderung von Medizin-, Bio-
 * und Umwelt-Technologien e.V.") und damit näher am Fließtext als am Namen.
 */
export const KERN_FELDER: ReadonlySet<Trefferfeld> = new Set<Trefferfeld>(['akronym', 'netzwerk']);

/**
 * Der Kern eines Wertes: alles ohne Fugen.
 *
 * Erwartet KLEIN geschriebenen Text — wie `enthaeltAlsWortteil` auch. Der Korpus
 * hält seine `*Lower`-Formen ohnehin vor, und ein `toLowerCase()` hier liefe im
 * heißesten Pfad der App noch einmal.
 */
export function namensKern(klein: string): string {
  return klein.replace(FUGEN, '');
}

/**
 * Der Kern einer NADEL — oder `''`, wenn diese Nadel keinen Kern-Pfad bekommt.
 *
 * Zwei Gründe für `''`, und beide stehen genau hier, damit sie nicht an zwei
 * Aufrufstellen auseinanderlaufen:
 *
 *  1. **Zu kurz** (< `MIN_KERN`).
 *  2. **Sie trägt einen Platzhalter.** Ein `?`/`*` fragt nach unbekannten
 *     ZEICHEN, die Trennzeichen-Blindheit nach unbekannten FUGEN. Zusammen wäre
 *     `mob*technik` auf dem Kern wieder so weit wie `.*` — es fände „mobile
 *     Messtechnik", genau das Muster über den halben Namen, das v4.123
 *     ausgeschlossen hat. Und die Faltung würde den Stern ohnehin wegwerfen,
 *     denn er ist kein Wortzeichen.
 */
export function nadelKern(nadel: string, muster: RegExp | null | undefined): string {
  if (muster !== null && muster !== undefined) return '';
  const kern = namensKern(nadel);
  return kern.length >= MIN_KERN ? kern : '';
}

/**
 * Trifft die Nadel dieses Namensfeld, wenn man in beiden die Fugen wegdenkt?
 *
 * `roh` ist der Wert wie gesucht (klein), `kern` seine Faltung — beide liegen im
 * Korpus vorberechnet nebeneinander. Ohne die Vorberechnung kostete derselbe
 * Vergleich das Neunfache (8,4 ms je Nadel statt 0,9 über 14 225 Einträge), weil
 * er dann Zeichen für Zeichen durch beide Felder laufen müsste.
 *
 * Der Wortanfang wird am ROHEN Wert nachgeprüft, nicht vorberechnet: er ist nur
 * für die wenigen Einträge zu klären, in denen der Kern die Nadel überhaupt
 * enthält — eine Liste von Wortanfängen je Eintrag kostete Speicher für eine
 * Frage, die fast nie gestellt wird.
 */
export function trifftNamensKern(roh: string, kern: string, nadelKernForm: string): boolean {
  if (nadelKernForm.length === 0 || nadelKernForm.length > kern.length) return false;
  for (let i = kern.indexOf(nadelKernForm); i !== -1; i = kern.indexOf(nadelKernForm, i + 1)) {
    if (istWortanfang(roh, i)) return true;
  }
  return false;
}

/** Ist das `i`-te Wortzeichen von `roh` der Anfang eines Wortes? `i` zählt im
 *  KERN, läuft hier also über die Fugen hinweg mit. */
function istWortanfang(roh: string, i: number): boolean {
  let n = 0;
  for (let k = 0; k < roh.length; k++) {
    if (!WORTZEICHEN.test(roh[k] as string)) continue;
    if (n === i) return k === 0 || !WORTZEICHEN.test(roh[k - 1] as string);
    n++;
  }
  return false;
}

/**
 * Die Fundstellen einer Kern-Nadel im ROHEN Wert — für die Markierung.
 *
 * Gibt Paare `[von, bis)` in Zeichen des Originals zurück; die übersprungenen
 * Fugen liegen mit drin, damit `NAFA-Tech` als ein Stück markiert wird und nicht
 * als zwei mit einer Lücke.
 */
export function kernFundstellen(roh: string, nadelKernForm: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (nadelKernForm.length === 0) return out;
  const n = nadelKernForm.length;
  const laenge = roh.length;
  let i = 0;
  while (i < laenge) {
    while (i < laenge && !WORTZEICHEN.test(roh[i] as string)) i++;
    if (i >= laenge) break;
    let j = i;
    let k = 0;
    while (j < laenge && k < n) {
      const c = roh[j] as string;
      if (!WORTZEICHEN.test(c)) { j++; continue; }
      if (c !== nadelKernForm[k]) break;
      j++; k++;
    }
    if (k === n) out.push([i, j]);
    // Weiter beim nächsten Wortanfang — die Nadel MUSS an einem beginnen.
    while (i < laenge && WORTZEICHEN.test(roh[i] as string)) i++;
  }
  return out;
}
