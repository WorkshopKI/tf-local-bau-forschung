/**
 * Woraus der Reiter „Top Ten" seine Spalten baut.
 *
 * Rein — kein React. Die Darstellung liegt in
 * [StartStoebern.tsx](src/plugins/suche/start/StartStoebern.tsx).
 *
 * **Sieben Achsen, nicht fünf Felder** (v6.10). Bis dahin war eine Spalte
 * gleich ein Feld des Werte-Index, und was kein Feld war, konnte hier nicht
 * stehen. Zwei Dinge, die den Bestand am besten beschreiben, fielen deshalb
 * heraus: die Stichwörter aus Titel und Kurzbeschreibung (Fließtext, kein
 * aufzählbares Feld — [wort-index.ts](src/plugins/antraege/services/wort-index.ts))
 * und die Zukunftsthemen (sie stecken im Deskriptoren-Topf, ohne eigenes Feld).
 * Eine Achse ist deshalb allgemeiner als ein Feld: sie weiß, wie sie ihre Werte
 * bekommt und welche Anfrage eine Zeile ausführt — mehr braucht die Spalte nicht.
 *
 * **Zukunftsthemen werden aus den Deskriptoren HERAUSGENOMMEN**, nicht daneben
 * gestellt: am echten Bestand sind fünf der zehn häufigsten Deskriptoren
 * ZT-Themen (Digitale Wirtschaft und Gesellschaft 2 691, Energie/Ress.
 * Effizienz 2 050, Künstliche Intelligenz 1 591 …). Nebeneinander stünden die
 * Zeilen zweimal da — dieselbe Unterscheidung ohne Unterschied wie zwei
 * Schreibweisen desselben Netzwerks. Gesucht wird bei beiden weiter mit
 * `deskriptor:`; die Trennung ist eine der ANSICHT, nicht der Suche.
 */
import { FELD_PRAEFIX } from '@/core/services/search/feldpraefix';
import { TREFFERFELD_LABEL } from '@/core/services/search/trefferstelle';
import { istZukunftsthema } from '@/plugins/antraege/services/descriptor-text';
import {
  anzahlPassend, haeufigsteWerte, type WertEintrag, type WertFeld, type WertIndex,
} from '@/plugins/antraege/services/wert-index';
import { LEERER_WORT_INDEX, type WortIndex } from '@/plugins/antraege/services/wort-index';
import { alsAnfrageWert } from '../vervollstaendigung';

/**
 * Die Felder mit Wertevorrat, in der Reihenfolge „was errät man am wenigsten".
 *
 * Nur Felder mit abzählbarem Wertevorrat kommen überhaupt in Frage
 * ([wert-index.ts](src/plugins/antraege/services/wert-index.ts)) — Titel und
 * Beschreibung tragen Fließtext und stehen deshalb über die Stichwort-Achse
 * hier. `wahlkreis` fehlt bewusst: er ist abzählbar, aber niemand sucht ein
 * Vorhaben über seinen Wahlkreis, ohne den Ort schon zu kennen.
 */
export const STOEBER_FELDER: readonly WertFeld[] = [
  'deskriptoren', 'netzwerk', 'organisation', 'standort', 'bundesland',
];

/**
 * Die Achsen des Reiters in ihrer Reihenfolge.
 *
 * Stichwörter und Themen stehen vorn: sie beantworten „worum geht es in diesem
 * Bestand", und das ist die Frage, mit der jemand vor einem leeren Suchfeld
 * sitzt. Wer schon weiß, welche Einrichtung er sucht, tippt sie.
 */
export type StoeberAchse = WertFeld | 'stichwort' | 'thema';

export const STOEBER_ACHSEN: readonly StoeberAchse[] = [
  'stichwort', 'thema', ...STOEBER_FELDER,
];

/** Wie viele Werte je Achse zuerst dastehen. */
export const WERTE_JE_FELD = 10;

/** Wie viele der Nachschlag „+n weitere" höchstens dazulegt. */
export const WERTE_NACHSCHLAG = 10;

/** Die Überschrift der Spalte. */
export function stoeberLabel(achse: StoeberAchse): string {
  if (achse === 'stichwort') return 'Stichwörter';
  if (achse === 'thema') return 'Themen';
  return TREFFERFELD_LABEL[achse];
}

/** Das Präfix, das die App für dieses Feld schreibt (`ort`, `deskriptor`, …). */
export function stoeberPraefix(feld: WertFeld): string {
  return FELD_PRAEFIX[feld] ?? feld;
}

/**
 * Die Anfrage, die eine Zeile ausführt.
 *
 * Mehrwortige Werte kommen in Anführungszeichen — ohne sie zerfiele der Wert an
 * den Leerzeichen und suchte etwas anderes, als in der Zeile stand. Bei den
 * Namensfeldern entscheidet `alsAnfrageWert` anders (Kern statt Zitat); das
 * Feld wird deshalb durchgereicht, damit „Top Ten" und Vorschlagsliste dieselbe
 * Anfrage bauen.
 *
 * Die zwei neuen Achsen fügen sich ein, ohne eine eigene Mechanik zu brauchen:
 * ein Thema ist ein Deskriptor-Wert, ein Stichwort ist ein Wort — die
 * Volltextsuche über alle Felder ist genau das, was der Klick meint.
 */
export function stoeberAnfrage(achse: StoeberAchse, wert: string): string {
  if (achse === 'stichwort') return wert;
  const feld: WertFeld = achse === 'thema' ? 'deskriptoren' : achse;
  return `${stoeberPraefix(feld)}:${alsAnfrageWert(wert, feld)}`;
}

/** Stabiler Schlüssel für React und für die Trefferzahl-Karte. */
export function stoeberKey(achse: StoeberAchse, wert: string): string {
  return `${achse}:${wert.toLowerCase()}`;
}

export interface StoeberSpalte {
  achse: StoeberAchse;
  /** Wie viele Werte die Achse im ganzen Bestand führt. */
  gesamt: number;
  /**
   * Die häufigsten, gekappt auf `WERTE_JE_FELD + WERTE_NACHSCHLAG` — die Spalte
   * zeigt zunächst nur die erste Hälfte und blättert die zweite auf Klick nach.
   */
  werte: WertEintrag[];
  /**
   * Das Präfix, mit dem sich der VOLLE Vorrat im Suchfeld durchblättern lässt,
   * oder `null`. Die Stichwörter haben keines: sie sind kein Feld, und der
   * Bestand führt sie in keiner Liste, die man aufklappen könnte.
   */
  praefix: string | null;
  /**
   * Welche Zahl rechts an der Zeile steht.
   *
   * `treffer` — ein echter Probelauf, also die Zahl, die nach dem Klick auch
   * dasteht. Für Feldwerte stimmt sie fast auf den Wert mit dem, wonach die
   * Spalte sortiert ist: `ort:Berlin` findet, was der Index unter Berlin zählt.
   *
   * `vorhaben` — die Zahl aus dem Index selbst. Bei den Stichwörtern MUSS es
   * diese sein, denn die beiden Maße gehen dort weit auseinander: der Index
   * zählt groß geschriebene Wortformen in Titel und Kurzbeschreibung, die Suche
   * findet dieselbe Zeichenfolge irgendwo in jedem Feld — „Daten" steht in 646
   * Vorhaben und findet 2 414 Treffer (auch in „Datenbank", auch in den
   * Deskriptoren). Stünde die Trefferzahl dort, liefe die nach Häufigkeit
   * sortierte Liste sichtbar durcheinander: 530 über 2 711, gemessen. Die Zahl
   * ist deshalb die, nach der sortiert wird — und sie ist anders beschriftet,
   * damit sie nicht als Trefferzusage gelesen wird.
   */
  zahlArt: 'treffer' | 'vorhaben';
}

/** Wie viele Werte eine Spalte höchstens vorhält. */
const VORRAT = WERTE_JE_FELD + WERTE_NACHSCHLAG;

/**
 * Die Spalten des Reiters. Achsen ohne einen einzigen Wert fallen weg — eine
 * Überschrift über einer leeren Spalte behauptet einen Vorrat, den es nicht
 * gibt.
 *
 * **Gezeigt werden die HÄUFIGSTEN, wie die Fußzeile es sagt** (`haeufigsteWerte`,
 * v4.111). Bis dahin stand hier der Anschnitt der alphabetischen Liste: unter
 * „Bundesland" erschien Bremen (306 Anträge), Sachsen (2 742) nicht, und unter
 * „Netzwerk" waren vier der fünf „häufigsten" Einzeltreffer. Die vollständige,
 * alphabetische Liste bleibt das Dropdown im Suchfeld — dort sucht man einen
 * Namen, hier sieht man den Bestand.
 *
 * @param wortIndex Die Stichwörter, bereits nach Häufigkeit sortiert und
 *                  gekappt (`verdichteWortIndex`). Leer, solange der Korpus
 *                  lädt — dann fehlt die Spalte, statt leer dazustehen.
 */
export function baueStoeberSpalten(
  index: WertIndex | null,
  wortIndex: WortIndex = LEERER_WORT_INDEX,
): StoeberSpalte[] {
  if (!index) return [];
  const deskriptoren = index.get('deskriptoren') ?? [];
  const themen = deskriptoren.filter(e => istZukunftsthema(e.wert));
  return STOEBER_ACHSEN
    .map((achse): StoeberSpalte => {
      if (achse === 'stichwort') {
        return {
          achse,
          gesamt: wortIndex.gesamt,
          werte: wortIndex.liste.slice(0, VORRAT),
          praefix: null,
          zahlArt: 'vorhaben',
        };
      }
      if (achse === 'thema') {
        return {
          achse,
          gesamt: themen.length,
          werte: sortiereNachHaeufigkeit(themen).slice(0, VORRAT),
          praefix: stoeberPraefix('deskriptoren'),
          zahlArt: 'treffer',
        };
      }
      // Die Deskriptoren-Spalte zeigt, was NICHT schon als Thema dasteht.
      if (achse === 'deskriptoren') {
        const rest = deskriptoren.filter(e => !istZukunftsthema(e.wert));
        return {
          achse,
          gesamt: rest.length,
          werte: sortiereNachHaeufigkeit(rest).slice(0, VORRAT),
          praefix: stoeberPraefix('deskriptoren'),
          zahlArt: 'treffer',
        };
      }
      return {
        achse,
        gesamt: anzahlPassend(index, achse, ''),
        werte: haeufigsteWerte(index, achse, VORRAT),
        praefix: stoeberPraefix(achse),
        zahlArt: 'treffer',
      };
    })
    .filter(s => s.werte.length > 0);
}

/** Häufigste zuerst, bei Gleichstand alphabetisch — wie `haeufigsteWerte`. */
function sortiereNachHaeufigkeit(liste: readonly WertEintrag[]): WertEintrag[] {
  return [...liste].sort((a, b) => (b.anzahl - a.anzahl) || a.wert.localeCompare(b.wert, 'de'));
}
