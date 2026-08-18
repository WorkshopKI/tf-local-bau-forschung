/**
 * Was die Antwort über einzelne Vorhaben sagt — abgetrennt, nicht neu erfragt.
 *
 * Die Antwortkarte oben und die Trefferliste unten stammen aus DEMSELBEN Lauf,
 * standen aber bis v4.100 unverbunden nebeneinander: der Klick auf ein
 * Kennzeichen verließ die Suche und öffnete die Antragsseite, obwohl genau
 * dieser Antrag zwei Zeilen tiefer schon in der Liste stand. Gemeldet als „wie
 * kann der User die Liste der KI ganz oben mit den Suchergebnissen darunter
 * zusammenbringen?".
 *
 * **Kein zusätzlicher KI-Aufruf.** Der Prompt verlangt ohnehin bei jeder Aussage
 * über ein Vorhaben dessen Kennzeichen (Pflicht 8 in
 * [frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts)) — und
 * damit steht der Satz, der zu einem Treffer gehört, bereits im Text. Er wird
 * hier nur aufgehoben, wo er hingehört: an die Zeile.
 *
 * Die Zerlegung ist bewusst STUMPF und arbeitet zeilenweise. Ein Modelltext ist
 * keine Datenstruktur; jede Klugheit beim Zerschneiden wäre eine Annahme, die
 * beim nächsten Lauf anders ausfällt. Was nicht eindeutig einer Zeile zuzuordnen
 * ist, bekommt keinen Satz — die Marke bleibt trotzdem, denn das Kennzeichen
 * WURDE genannt.
 *
 * Rein — kein React, kein IDB, kein Netz.
 */

/**
 * Ein Förderkennzeichen im Fließtext: `16KN065624`, auch mit Suffix.
 *
 * **Die einzige Fassung.** Karte, Marke und Beleg müssen dieselbe Menge
 * Kennzeichen sehen, sonst wäre ein Kennzeichen anklickbar, das keine Marke
 * bekommt (oder umgekehrt). `g` steht am Muster, deshalb wird `lastIndex` bei
 * jedem Gebrauch zurückgesetzt — ein geteiltes RegExp-Objekt mit `g` merkt sich
 * sonst die Position des letzten Aufrufers.
 */
const FKZ_ROH = /\b(\d{2}[A-Z]{2}\d{4,8}[A-Z0-9]{0,3})\b/g;

/** Alle Kennzeichen eines Textes, in Reihenfolge des Auftretens, ohne Dubletten. */
export function kennzeichenIn(text: string): string[] {
  FKZ_ROH.lastIndex = 0;
  const out: string[] = [];
  for (const m of text.matchAll(FKZ_ROH)) {
    if (!out.includes(m[0])) out.push(m[0]);
  }
  return out;
}

/** Ein neues Muster-Objekt für Aufrufer, die selbst über die Fundstellen laufen
 *  (die Karte macht das, um sie anklickbar zu rendern). */
export function fkzMuster(): RegExp {
  return new RegExp(FKZ_ROH.source, 'g');
}

/**
 * Wie lang der Satz an der Trefferzeile höchstens sein darf.
 *
 * Die Zeile trägt schon Titel, Einrichtung und Fundstelle. Ein voller
 * Antwortsatz daneben würde die Liste zur zweiten Antwortkarte — und die steht
 * bereits oben. Was abgeschnitten wird, steht vollständig im `title`.
 */
export const KURZFORM_ZEICHEN = 140;

export interface AntwortBeleg {
  /** Der ganze Satz, den die Antwort zu diesem Vorhaben schreibt. */
  satz: string;
  /** Dieselbe Aussage, auf Zeilenlänge gekürzt (mit „…", wenn gekürzt wurde). */
  kurz: string;
}

/**
 * Zerlegt den Antworttext in Belege je Kennzeichen.
 *
 * Zeilenweise: eine Zeile, die genau ein Kennzeichen nennt, IST die Aussage über
 * dieses Vorhaben. Nennt eine Zeile mehrere, gilt sie für alle darin — das ist
 * die ehrlichere Zuordnung, als sie an Satzzeichen auseinanderzuschneiden.
 *
 * Weggeworfen wird alles, was nach der Bereinigung kein Satz mehr ist:
 *  - der Listenstrich am Zeilenanfang (`- `, `* `, `1. `),
 *  - das Kennzeichen selbst samt umschließender Klammer,
 *  - Zeilen, die nur noch aus Zeichensetzung bestehen.
 *
 * Der Absatz mit den GEZÄHLTEN Zahlen nennt keine Kennzeichen und fällt damit
 * von selbst heraus — er gehört auch nicht an eine einzelne Zeile.
 */
export function zerlegeAntwort(antwort: string | null): ReadonlyMap<string, AntwortBeleg> {
  const out = new Map<string, AntwortBeleg>();
  if (!antwort) return out;

  for (const zeile of antwort.split('\n')) {
    const kennzeichen = kennzeichenIn(zeile);
    if (kennzeichen.length === 0) continue;
    const satz = bereinige(zeile);
    if (satz.length === 0) {
      // Kennzeichen ohne Aussage — z. B. eine reine Aufzählung. Es ist trotzdem
      // genannt worden; der Beleg bleibt leer, die Marke entsteht anderswo.
      continue;
    }
    for (const fkz of kennzeichen) {
      // Der ERSTE Satz gewinnt: nennt ein späterer Absatz dasselbe Vorhaben
      // noch einmal, ist das meist die Zusammenfassung, nicht die Aussage.
      if (!out.has(fkz)) out.set(fkz, { satz, kurz: kuerze(satz) });
    }
  }
  return out;
}

/** Listenstrich, Kennzeichen und leergelaufene Klammern weg. */
function bereinige(zeile: string): string {
  let t = zeile.replace(/^\s*(?:[-*•]|\d+\.)\s*/, '');
  t = t.replace(fkzMuster(), '');
  // Klammern, in denen nach dem Entfernen KEIN Buchstabe mehr steht — `( )`
  // ebenso wie das `(, )`, das von „(16KN042124, 16KN062342)" übrig bleibt.
  // Auf den Buchstaben zu prüfen statt auf Leere ist der Unterschied zwischen
  // „räumt auf" und „frisst den Zusatz `(Phase 2)`".
  t = t.replace(/[([][^)\]\p{L}]*[)\]]/gu, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  // Zeichensetzung, die jetzt am Rand hängt — inklusive des Punkts, der vor dem
  // Entfernen hinter der Klammer stand.
  t = t.replace(/^[\s.,;:–—-]+/, '').replace(/[\s.,;:]+$/, '').trim();
  return /\p{L}/u.test(t) ? t : '';
}

/** Auf `KURZFORM_ZEICHEN`, aber an einer Wortgrenze — mitten im Wort zu
 *  schneiden liest sich wie ein Datenfehler. */
function kuerze(satz: string): string {
  if (satz.length <= KURZFORM_ZEICHEN) return satz;
  const roh = satz.slice(0, KURZFORM_ZEICHEN);
  const luecke = roh.lastIndexOf(' ');
  return `${(luecke > KURZFORM_ZEICHEN * 0.6 ? roh.slice(0, luecke) : roh).trimEnd()}…`;
}
