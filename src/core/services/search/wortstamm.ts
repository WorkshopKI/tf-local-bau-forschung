/**
 * Wortstamm-Vergleich — die Grundlage von „Wortformen mitsuchen".
 *
 * Der Handoff zeigt an dieser Stelle abwählbare Synonym-Chips (Regelwerk,
 * Richtlinie, Normung). Eine Synonymquelle hat die App nicht: das Glossar führt
 * 41 Abkürzungen und kein Synonymfeld, und die Ähnlichkeitssuche ist ein
 * Embedding-Modell — sie kann Nachbarschaft messen, aber keine Begriffe
 * BENENNEN, und ohne benennbare Begriffe gibt es nichts abzuwählen.
 *
 * Was sich benennen lässt, ist der Wortstamm: „Normen" und „Normung" teilen
 * ihn, „Kalibrierung" und „Kalibrierstandards" auch. Das ist deterministisch,
 * kostenlos, im Text belegbar — und die Chips zeigen anschließend die Wörter,
 * die im Bestand TATSÄCHLICH gefunden wurden, keine erfundene Liste.
 *
 * Bewusst ein Suffix-Abschneider, kein Stemmer-Paket: die Suche darf ruhig
 * etwas zu viel finden (sie zeigt ja, warum ein Treffer kam), aber sie darf
 * nicht von einer Bibliothek abhängen, die unter `file://` nachgeladen würde.
 *
 * Rein — kein React, kein IDB.
 */

/**
 * Ablösbare Endungen, längste zuerst. Die Reihenfolge entscheidet: „Normungen"
 * muss „ungen" verlieren, nicht erst „en" und dann nichts mehr.
 */
const SUFFIXE: readonly string[] = ['ungen', 'ung', 'en', 'er', 'es', 'em', 'e', 's', 'n'];

/**
 * Kürzester zulässiger Stamm. Vier Zeichen, weil darunter jede Suche zur
 * Rauschquelle wird: „Bau" → „ba" träfe die halbe Datenbank.
 */
const MIN_STAMM = 4;

/** Wortgrenzen für das Einsammeln der Varianten. `\p{L}` statt `\w`, sonst
 *  zerfällt „Kalibrier-Standards" an Umlauten und Bindestrich. */
const WORT_MUSTER = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/**
 * Kürzester Rest VOR dem Stamm, der noch ein Wortteil sein kann.
 *
 * Gemeldet (v4.68): „Normen" schlug „enormes" als Wortform vor. Der Stamm lautet
 * `norm`, und bis dahin genügte `klein.includes(stamm)` — der Stamm durfte an
 * JEDER Stelle stehen, auch mitten im Wort. „e-norm-es" erfüllt das, ist aber
 * kein Wortform-Treffer, sondern ein Buchstaben-Treffer.
 *
 * Die naheliegende Gegenregel — „muss am Wortanfang stehen" — wäre falsch: im
 * Deutschen steht das Grundwort HINTEN, und der Kopfkommentar dieser Datei nennt
 * „Kalibrierstandards" ausdrücklich als den Fall, den die Suche finden soll.
 * Unterscheidbar sind die beiden am Rest davor: bei „enormes" ist er ein
 * einzelnes „e", bei „kalibrierstandards" ein ganzes Wort.
 *
 * Zwei Zeichen, nicht vier: „ge-normt" und „vor-norm" sind echte Wortformen mit
 * kurzer Vorsilbe, und die dürfen nicht mit dem Buchstabensalat verschwinden.
 * Ein einzelner Buchstabe ist nie ein Morphem — genau dort verläuft die Grenze.
 */
const MIN_VORSILBE = 2;

/** Buchstabe oder Ziffer? Der Bindestrich zählt bewusst NICHT dazu: er trennt
 *  hart, „Kalibrier-Standards" beginnt hinter ihm ein neues Wort.
 *
 *  Modul-global compiliert, nicht je Aufruf: diese Prüfung läuft im heißesten
 *  Pfad der App (14 000 Einträge × Felder × Nadeln). */
const WORTZEICHEN = /[\p{L}\p{N}]/u;

/**
 * Enthält der Text die Nadel an einer Stelle, an der ein Wort beginnen kann?
 *
 * Gemessen wird der Buchstaben-Rest DIREKT vor dem Fund, bis zur nächsten
 * Wortgrenze — nicht alles, was links davon steht. Der Unterschied ist der
 * ganze Punkt: in „die enorme Normung" stünden vor dem ersten Fund fünf
 * Zeichen („die e"), aber nur eines davon gehört zum Wort. Genau das eine „e"
 * ist die Auskunft, die zählt, und der zweite Fund („Normung") wird richtig
 * angenommen.
 *
 * Geprüft wird deshalb JEDES Vorkommen, nicht nur das erste.
 */
export function enthaeltAlsWortteil(text: string, nadel: string): boolean {
  if (nadel.length === 0) return false;
  for (let i = text.indexOf(nadel); i !== -1; i = text.indexOf(nadel, i + 1)) {
    let j = i;
    while (j > 0 && WORTZEICHEN.test(text[j - 1] as string)) j--;
    const vorsilbe = i - j;
    if (vorsilbe === 0 || vorsilbe >= MIN_VORSILBE) return true;
  }
  return false;
}

/**
 * Der Platzhalter für GENAU EIN Zeichen.
 *
 * **Er gilt überall außer am Wortende.** `mobi?nspec` ist eine Suche mit
 * Platzhalter, `Normung?` ist eine Frage. Diese eine Regel trägt den ganzen
 * Unterschied: ein Suchwort zerfällt an den Leerzeichen, also steht das
 * Fragezeichen einer Frage IMMER am Ende seines Wortes — „Welche Vorhaben
 * drehen sich um Normung?" bleibt damit eine Frage und wird nicht stillschweigend
 * zur Muster-Suche.
 *
 * Die frühere, engere Fassung („nur zwischen zwei Wortzeichen") war zu streng:
 * sie verwarf `gmb?.de`, wo der Nutzer offensichtlich ein Zeichen meint.
 */
const PLATZHALTER = '?';

/**
 * Der Platzhalter für BELIEBIG VIELE Zeichen — auch für keines.
 *
 * `?` verlangt, dass man abzählt: `mobi?nspec` findet die beiden Schreibweisen
 * dieses Netzwerks nur, weil sie sich in GENAU einem Zeichen unterscheiden.
 * Wer das nicht weiß, tippt `mob?nspec` und bekommt null Treffer — an einer
 * Namensdrift, die man ja gerade deshalb sucht, weil man sie nicht kennt.
 * `mob*spec` stellt dieselbe Frage, ohne die Antwort schon zu kennen.
 *
 * **Der Stern bleibt INNERHALB eines Wortes** (`[\p{L}\p{N}]*`, nicht `.*`).
 * Sonst spannte `mob*spec` über Leerzeichen hinweg und „Mobile Messtechnik für
 * die Spektroskopie" wäre ein Treffer — ein Muster, das über den halben
 * Abstract reicht, findet alles und erklärt nichts. Der Bindestrich trennt
 * hart wie überall in dieser Datei: `mobi-Inspec` erreicht er nicht.
 *
 * Anders als `?` gilt er auch am Wortende — dort kostet er nur nichts, weil
 * ohnehin als Teilstring gesucht wird (`mobi*` ist `mobi`). Ein Satzzeichen,
 * mit dem er verwechselt werden könnte, gibt es nicht: kein Mensch beendet
 * eine Frage mit einem Stern.
 */
const STERN = '*';

/** Der Stern als Muster-Stück: beliebig viele Zeichen, aber keine Wortgrenze. */
const STERN_MUSTER = '[\\p{L}\\p{N}]*';

/**
 * Wie viele FESTE Zeichen eine Nadel mit Platzhalter mindestens tragen muss.
 *
 * Gemessen am echten Bestand: `????` trifft alle 12 358 Anträge — nicht weil
 * es teuer wäre (0,8 ms, die Regex bricht beim ersten Fund ab), sondern weil
 * die Trefferliste dann der ganze Bestand ist. Die Grenze schützt nicht die
 * Rechenzeit, sondern die Auskunft: eine Anfrage, die alles trifft, ist keine.
 */
const MIN_FESTE_ZEICHEN = 3;

/** Steht an dieser Stelle ein Platzhalter — also ein `?`, das NICHT das letzte
 *  Zeichen der Nadel ist? */
function istPlatzhalter(nadel: string, i: number): boolean {
  return nadel[i] === PLATZHALTER && i + 1 < nadel.length;
}

/**
 * Übersetzt eine Nadel mit Platzhaltern in ein Muster — oder `null`, wenn sie
 * keine trägt oder zu wenig Festes.
 *
 * `null` ist der NORMALFALL und der Grund, warum der heiße Pfad unverändert
 * bleibt: ohne Platzhalter compiliert nichts, und `enthaeltAlsWortteil` läuft
 * Zeichen für Zeichen wie zuvor. Gemessen über 12 358 Einträge × 6 Felder
 * kostet der Muster-Pfad übrigens nicht mehr als der heutige (4,7 ms gegen
 * 5,8 ms) — teuer ist an einer Platzhalter-Suche nichts außer einer zu weiten.
 *
 * **Beide Platzhalter laufen durch diese eine Übersetzung.** Wer `*` an einer
 * zweiten Stelle nachbaute, hätte zwei Wahrheiten darüber, was eine Nadel
 * bedeutet — und die Trefferstufe, die Feldzuordnung und die Markierung lesen
 * alle hier.
 */
export function baueNadelMuster(nadel: string): RegExp | null {
  let quelle = '';
  let platzhalter = 0;
  for (let i = 0; i < nadel.length; i++) {
    if (istPlatzhalter(nadel, i)) { quelle += '.'; platzhalter++; continue; }
    if (nadel[i] === STERN) {
      platzhalter++;
      // `**` würde zu `[…]*[…]*` — dieselbe Menge, aber quadratisches
      // Zurücklaufen an einem langen Wort. Der zweite Stern fällt weg.
      if (nadel[i - 1] !== STERN) quelle += STERN_MUSTER;
      continue;
    }
    quelle += (nadel[i] as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (platzhalter === 0) return null;
  if (nadel.length - platzhalter < MIN_FESTE_ZEICHEN) return null;
  return new RegExp(quelle, 'gu');
}

/**
 * Wie `enthaeltAlsWortteil`, nur mit einem Muster statt einer festen Nadel —
 * dieselbe Wortanfang-Regel, damit ein Platzhalter nicht plötzlich Treffer
 * liefert, die eine feste Nadel nie geliefert hätte.
 */
export function enthaeltMusterAlsWortteil(text: string, muster: RegExp): boolean {
  muster.lastIndex = 0;
  for (let m = muster.exec(text); m !== null; m = muster.exec(text)) {
    const i = m.index;
    let j = i;
    while (j > 0 && WORTZEICHEN.test(text[j - 1] as string)) j--;
    if (i - j === 0 || i - j >= MIN_VORSILBE) return true;
    // Ohne dieses Zurücksetzen übersprünge die Suche bei einem abgelehnten Fund
    // den ganzen Rest des Wortes — „die enorme normung" fände `norm` nicht mehr.
    muster.lastIndex = i + 1;
  }
  return false;
}

/** Unverankert — für die Feldzuordnung, die den Beleg sucht und nicht den
 *  Treffer entscheidet. Sie darf nicht strenger sein als der Treffer selbst,
 *  sonst stünde eine Zeile ohne Trefferstelle da. */
export function musterTrifft(text: string, muster: RegExp): boolean {
  muster.lastIndex = 0;
  return muster.test(text);
}

/**
 * Kürzt ein Suchwort auf seinen Stamm. Passt keine Endung oder bliebe der Rest
 * zu kurz, kommt das Wort unverändert zurück — der Aufrufer muss also nie
 * prüfen, ob „gestammt" wurde.
 */
export function wortStamm(wort: string): string {
  const klein = wort.toLowerCase();
  for (const suffix of SUFFIXE) {
    if (klein.length - suffix.length >= MIN_STAMM && klein.endsWith(suffix)) {
      return klein.slice(0, klein.length - suffix.length);
    }
  }
  return klein;
}

/**
 * Sammelt die Wörter, die ein Text über den Stamm mitbringt — genau die
 * Begriffe, die in der Deutungszeile als abwählbare Chips erscheinen.
 *
 * `ausser` ist das ursprüngliche Suchwort: es steht bereits als eigener Chip da
 * und wäre als „ähnlicher Begriff" eine Tautologie. Verglichen wird klein
 * geschrieben, zurückgegeben wird die Schreibweise aus dem Text — die Chips
 * sollen aussehen wie das, was im Antrag steht.
 */
export function sammleVarianten(
  text: string,
  stamm: string,
  ausser: string,
  max: number,
): string[] {
  if (stamm.length === 0 || text.length === 0 || max <= 0) return [];
  const ausgeschlossen = ausser.toLowerCase();
  const gesehen = new Set<string>();
  const out: string[] = [];
  for (const treffer of text.matchAll(WORT_MUSTER)) {
    const wort = treffer[0];
    const klein = wort.toLowerCase();
    if (klein === ausgeschlossen) continue;
    if (!enthaeltAlsWortteil(klein, stamm)) continue;
    if (gesehen.has(klein)) continue;
    gesehen.add(klein);
    out.push(wort);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Die Nadel, mit der ein Suchwort im Volltext gesucht wird: der Stamm, wenn
 * „Wortformen mitsuchen" an ist, sonst das Wort selbst.
 *
 * Eine Funktion statt einer Bedingung an jeder Aufrufstelle — sonst sucht eine
 * Stelle mit Stamm und eine andere ohne, und niemand merkt es.
 */
export function suchNadel(wort: string, stammSuche: boolean): string {
  return stammSuche ? wortStamm(wort) : wort.toLowerCase();
}
