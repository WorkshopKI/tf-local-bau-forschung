/**
 * Der Satz, mit dem die Ähnlichkeitsstufe Rechenschaft ablegt.
 *
 * Rein, weil er eine Entscheidung mit drei Fällen ist und keine Auszeichnung —
 * gerendert wird er von [AehnlichkeitsZeile.tsx](./AehnlichkeitsZeile.tsx).
 *
 * Gemeldet wurde: „ich schalte ‚auch ähnliche Themen' ein, die Trefferzahl
 * ändert sich nicht". Sie hatte sich auch nicht zu ändern — was über der
 * Schwelle liegt, steht bei einer breiten Anfrage meist **schon** im
 * Wortlaut-Ergebnis. Nur sagte das niemand: die Stufe lief zwanzig Sekunden und
 * legte keine Rechenschaft ab, und aus „nichts Neues" wurde „kaputt".
 *
 * Ein falscher Rechenschaftsbericht ist schlimmer als keiner — deshalb nennt
 * `kandidaten` seit v4.113 die Zahl VOR dem Deckel, und was der Deckel verworfen
 * hat, steht dabei.
 */
import type { SemantikBefund } from '@/core/hooks/useUnifiedSearch';
import type { AbgleichBefund } from '@/core/services/embedding-corpus';

/**
 * Wohin der Ausweg zeigt.
 *
 * Bis v4.127 stand hier „(„Vom Datenspeicher laden", sonst „Corpus aufbauen")" —
 * zwei Knöpfe aus dem Auslastungs-Modul. Der eine lag hinter einem
 * Zusatzpasswort, den anderen gab es in `zah-pl` gar nicht (er hing an
 * `isDevContext()`), und in `zim-dashboard` existiert das ganze Modul nicht. Ein
 * Ausweg, den der Leser nicht gehen kann, ist keiner.
 *
 * Jetzt zeigt der Satz auf die Stelle, an der der Index wirklich gepflegt wird —
 * und nur dem, der sie öffnen kann. Alle anderen erfahren, WER es tut.
 */
function ausweg(kannKuratieren: boolean): string {
  return kannKuratieren
    ? ' Neu aufbauen lässt er sich in der Kuration unter „Suche & Index“.'
    : ' Neu aufgebaut wird er in der Kuration.';
}

/**
 * Die **Reichweite** steht in jedem Fall dabei, solange sie nicht vollständig
 * ist: der Korpus liegt gerätelokal und deckt selten den ganzen Bestand ab. Ein
 * Vorhaben ohne Vektor kann nie ähnlich sein — das ist die halbe Antwort auf
 * „warum findet er nichts", und sie stand nirgends.
 */
function reichweite(
  befund: SemantikBefund,
  bestand: number,
  abgleich: AbgleichBefund | null,
  laeuft: boolean,
): Teilsatz {
  if (befund.korpus >= bestand || bestand === 0) return { text: '', brauchtAusweg: false };
  const kopf = ` Vergleichbar sind ${befund.korpus.toLocaleString('de-DE')} von `
    + `${bestand.toLocaleString('de-DE')} Vorhaben — nur sie haben auf diesem Rechner einen `
    + 'Vektor.';
  // Läuft gerade ein Download, ist das die Antwort — nicht ein Handgriff.
  if (laeuft) {
    return { text: `${kopf} Die übrigen werden gerade vom Datenspeicher geholt.`, brauchtAusweg: false };
  }
  if (abgleich?.aktion === 'ergaenzen' || abgleich?.aktion === 'ersetzen') {
    return { text: `${kopf} Die übrigen holt die App beim nächsten Start vom Datenspeicher.`, brauchtAusweg: false };
  }
  return { text: `${kopf} Die übrigen hat auch der Datenspeicher nicht.`, brauchtAusweg: true };
}

/**
 * Der Fall, der bis v4.127 überhaupt keine Stimme hatte: der Korpus ist
 * VOLLSTÄNDIG und trotzdem falsch.
 *
 * Die Reichweite schweigt dann (`korpus >= bestand`), die Trefferzahl sieht
 * plausibel aus — und die Vektoren stammen aus einer Textfassung, in der die
 * Projektbeschreibung in **0 von 14 225** Sätzen vorkam. Der Vektor eines
 * Vorhabens kannte nur seinen Titel und die Deskriptoren.
 */
function veraltet(abgleich: AbgleichBefund | null): Teilsatz {
  if (abgleich === null || !abgleich.neuaufbauNoetig) return { text: '', brauchtAusweg: false };
  const v = abgleich.versionDanach;
  return {
    text: ` Achtung: die Vektoren stammen aus einer überholten Textfassung${v === null ? '' : ` (v${v})`}`
      + ' — sie kennen Titel und Deskriptoren eines Vorhabens, nicht seinen Inhalt.',
    brauchtAusweg: true,
  };
}

/**
 * Ein Teilsatz sagt, ob er den Ausweg BRAUCHT — angehängt wird er genau einmal,
 * am Ende.
 *
 * Beide Teilsätze hängten ihn sich bis zur Abnahme selbst an, und wo beide
 * zutrafen (unvollständiger UND überholter Korpus — der Normalfall auf einem
 * Rechner mit v2-Bestand), stand „Neu aufbauen lässt er sich in der Kuration
 * unter „Suche & Index“." zweimal in derselben Zeile.
 */
interface Teilsatz { text: string; brauchtAusweg: boolean }

/**
 * Was der Deckel verworfen hat. Steht nur da, wenn etwas verworfen wurde — und
 * dann mit dem Grund, nicht als Zahl ohne Urteil.
 */
function deckel(befund: SemantikBefund): string {
  if (befund.verworfen <= 0) return '';
  return ` ${befund.verworfen} weitere lagen über der Schwelle, kamen aber nicht in die `
    + 'Liste — je Suche werden höchstens 50 neue Zeilen ergänzt.';
}

export interface KorpusLage {
  /** Ergebnis des letzten Abgleichs mit dem Datenspeicher; `null` = lief nicht. */
  abgleich: AbgleichBefund | null;
  /** Läuft gerade ein Download? */
  laeuft: boolean;
  /** Darf der Leser die Kuration öffnen? Entscheidet, wie konkret der Ausweg wird. */
  kannKuratieren: boolean;
}

const OHNE_LAGE: KorpusLage = { abgleich: null, laeuft: false, kannKuratieren: false };

export function aehnlichkeitsSatz(
  befund: SemantikBefund,
  bestand: number,
  lage: KorpusLage = OHNE_LAGE,
): string {
  const weite = reichweite(befund, bestand, lage.abgleich, lage.laeuft);
  const alt = veraltet(lage.abgleich);
  const rest = weite.text + alt.text
    + (weite.brauchtAusweg || alt.brauchtAusweg ? ausweg(lage.kannKuratieren) : '');
  if (befund.kandidaten === 0) {
    return `Ähnlichkeit: kein Vorhaben lag über der Schwelle.${rest}`;
  }
  // Der gemeldete Fall — und er ist eine Auskunft, kein Fehler: die Stufe hat
  // gearbeitet, ihr Ergebnis war nur schon da.
  if (befund.neu === 0) {
    return `Ähnlichkeit: ${befund.kandidaten} thematisch verwandte Vorhaben — alle standen schon im `
      + `Wortlaut-Ergebnis, die Trefferzahl ändert sich dadurch nicht.${deckel(befund)}${rest}`;
  }
  return `Ähnlichkeit: ${befund.kandidaten} thematisch verwandte Vorhaben, ${befund.neu} davon neu in der `
    + `Liste (Fundstelle „ähnliche Bedeutung").${deckel(befund)}${rest}`;
}
