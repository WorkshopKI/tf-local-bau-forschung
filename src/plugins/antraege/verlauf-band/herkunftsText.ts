/**
 * **Woher die Bahn kommt — ein Satz sichtbar, der Rest auf Abruf.**
 *
 * Unter dem Band standen bis v3.36 zwei Sätze, die dasselbe Thema hatten:
 * „Rekonstruiert aus den Datumsspalten · Achse bis …" und darunter „Aus den
 * Datumsspalten abgeleitet — die `D_`-Spalten tragen je Kürzel nur das zuletzt
 * gesetzte Datum. Belegte Änderungen führt das Journal ab …". Zweimal derselbe
 * Vorbehalt, an zwei Stellen, in zwei Formulierungen — beim zweiten Lesen
 * überspringt man beide.
 *
 * Jetzt trägt die Zeile unter der Bahn die **Kurzauskunft** (woher, und ab wann
 * es belegt ist), und die Begründung steht hinter dem Info-Zeichen daneben.
 * Weggelassen wird nichts: der Vorbehalt zu den `D_`-Spalten ist der Grund,
 * warum die Bahn eine Rekonstruktion und kein Protokoll ist, und er gehört
 * unter jede Verlaufs-Anzeige (Abschnitt 12.2).
 *
 * Rein und node-testbar — der Wortlaut ist die Zusage, nicht die Formatierung.
 */
import { formatDatumsWert } from '@/core/services/csv/dateParse';

export interface HerkunftsAngabe {
  /** Rechtes Ende der Achse. */
  bezugsZeitpunkt: string;
  /** Beschriftung der geladenen Katalogfassung, `null` wenn keine geladen ist. */
  fassung: string | null;
  /** Nullpunkt des Import-Diff-Journals, `null` wenn keins geführt wird. */
  journalAb: string | null;
  /** Ob das Journal für DIESE Bahn herangezogen wurde. */
  journalGenutzt: boolean;
}

export interface HerkunftsTexte {
  /** Die sichtbare Zeile unter der Bahn. */
  kurz: string;
  /** Die Absätze hinter dem Info-Zeichen, in Lesereihenfolge. */
  lang: string[];
}

/** Der Journal-Teil der Kurzzeile — drei Lagen, drei Auskünfte. */
function journalKurz(a: HerkunftsAngabe): string {
  if (a.journalAb === null) return 'kein Journal';
  if (!a.journalGenutzt) return 'Journal nicht herangezogen';
  return `belegt ab ${formatDatumsWert(a.journalAb)}`;
}

/** Derselbe Sachverhalt ausformuliert — mit dem Grund, den die Kurzzeile schuldig bleibt. */
function journalLang(a: HerkunftsAngabe): string {
  if (a.journalAb === null) {
    return 'Ein Import-Diff-Journal wird hier nicht geführt. Ohne seinen Nullpunkt'
      + ' ist keine Änderung belegt, sondern jede aus den Datumsspalten genähert.';
  }
  if (!a.journalGenutzt) {
    return `Das Import-Diff-Journal führt belegte Änderungen ab ${formatDatumsWert(a.journalAb)},`
      + ' ist hier aber nicht herangezogen: es wird je Teilvorhaben geführt und'
      + ' dieses Vorhaben hat mehrere.';
  }
  return `Ab ${formatDatumsWert(a.journalAb)} führt das Import-Diff-Journal die belegten`
    + ' Änderungen. Davor ist der Verlauf genähert, danach nachgewiesen.';
}

export function herkunftsTexte(a: HerkunftsAngabe): HerkunftsTexte {
  return {
    kurz: `Rekonstruiert aus den Datumsspalten · ${journalKurz(a)}`,
    lang: [
      'Die Bahn ist aus den Datumsspalten des Exports rekonstruiert, nicht aus einem'
      + ' Änderungsprotokoll: die D_-Spalten tragen je Kürzel nur das zuletzt gesetzte'
      + ' Datum. Ein Kürzel, das mehrfach gesetzt wurde, erscheint deshalb einmal.',
      journalLang(a),
      `Achse bis ${formatDatumsWert(a.bezugsZeitpunkt)}`
      + (a.fassung === null ? '' : ` · Katalogfassung ${a.fassung}`),
    ],
  };
}
