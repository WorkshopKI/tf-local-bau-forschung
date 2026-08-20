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
  /**
   * Warum es nicht herangezogen wurde — nur nötig, wenn `journalGenutzt` falsch
   * ist.
   *
   * `'mehrereTv'`: die Chronik gehört EINEM Teilvorhaben, das Vorhaben hat
   * mehrere. `'ganzesVorhaben'`: die Anzeige gilt dem ganzen Vorhaben, nicht
   * einem Teilvorhaben — dann gibt es gar keine Chronik zu ziehen, auch bei
   * genau einem TV. `'ohneChronik'`: dieses Teilvorhaben steht nicht im Journal.
   *
   * Bis v4.122 nannte der Text nur den ersten Grund. Auf der Verbund-Detailseite
   * ist `journalGenutzt` aber strukturell immer falsch (der Hook läuft dort ohne
   * Aktenzeichen) — bei jedem Ein-TV-Verbund stand deshalb „dieses Vorhaben hat
   * mehrere [Teilvorhaben]", während die Seite darüber genau eines zeigte.
   */
  journalGrund?: 'mehrereTv' | 'ganzesVorhaben' | 'ohneChronik';
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
    const grund = a.journalGrund === 'ganzesVorhaben'
      ? ' es wird je Teilvorhaben geführt, diese Ansicht gilt dem ganzen Vorhaben.'
      : a.journalGrund === 'ohneChronik'
        ? ' für dieses Teilvorhaben liegt keine Chronik vor.'
        : ' es wird je Teilvorhaben geführt und dieses Vorhaben hat mehrere.';
    return `Das Import-Diff-Journal führt belegte Änderungen ab ${formatDatumsWert(a.journalAb)},`
      + ' ist hier aber nicht herangezogen:' + grund;
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
