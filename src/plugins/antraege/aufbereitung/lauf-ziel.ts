/**
 * Ziel-Rolle der Antrag-Aufbereitung — mit welchem Modell der internen KI die
 * Bausteine fahren.
 *
 * INVARIANTE: die Aufbereitung läuft auf der Rolle **`standard`**
 * (`AUFBEREITUNG_ZIEL`), NICHT auf der global gewählten Modellwahl
 * (`useKiZiel`/`aktivesZielFuerLauf`). Muster + Begründung wie `FEEDBACK_ZIEL` in
 * `core/services/feedback/feedbackImprove.ts`: die sechs Bausteine sind enge,
 * einschüssige Extraktions-Aufträge mit striktem Ausgabeformat (Zeilenformat bzw.
 * JSON-Codeblock). Das starke Modell bringt dafür keinen Mehrwert, kostet aber je
 * Baustein Minuten, antwortet häufiger in Agent-Prosa statt im geforderten Format
 * (→ „Antwort nicht parsebar") und läuft bei sechs Volldurchgängen über den
 * Antragstext in die Transport-Deadline (→ Status `fehler`).
 *
 * EINE Ausnahme, vom Nutzer bewusst gewählt: die **Notausfahrt**. Das
 * Standard-Modell hat das kleinere Kontextfenster. Passt der Korpus dort nicht
 * hinein, sieht es das Ende des Textes nicht — dann darf der Prüfer für DIESEN
 * Antrag auf `stark` umschalten und bezahlt die Vollständigkeit mit Laufzeit. Die
 * Entscheidung trifft er sichtbar, nicht der Code.
 *
 * Rein + import-arm (die Caps kommen als Zahlen herein, nicht aus `localStorage`) →
 * node-testbar ohne DOM.
 */
import type { KiRolle } from '@/core/services/ai/modell-katalog';

/** Ziel-Tab ALLER Aufbereitungs-Bausteine — siehe Invariante im Kopfkommentar. */
export const AUFBEREITUNG_ZIEL: KiRolle = 'standard';

/** Wo die Bausteine laufen, gegen welchen Zeichen-Cap gemessen wird, und ob die
 *  Notausfahrt angeboten werden muss. */
export interface LaufZiel {
  /** Tab, auf dem Reset UND Submit jedes Bausteins landen. */
  ziel: KiRolle;
  /** Zeichen-Cap des gewählten Ziels — Grundlage der Korpus-Warnung. */
  cap: number;
  /**
   * true, sobald der Korpus das **Standard**-Fenster sprengt. Bewusst unabhängig vom
   * aktuell gewählten Ziel: sonst verschwände der Schalter in dem Moment, in dem er
   * benutzt wurde, und der Weg zurück wäre weg.
   */
  notausfahrtAnbieten: boolean;
}

/**
 * Bestimmt das Lauf-Ziel der Bausteine. Ohne aktivierte Notausfahrt immer
 * `AUFBEREITUNG_ZIEL`; `zeichen === null` (Korpus noch nicht aufgelöst) heißt nur,
 * dass die Notausfahrt noch nicht angeboten wird — am Ziel ändert es nichts.
 */
export function bestimmeLaufZiel(eingabe: {
  /** Umfang des Korpus in Zeichen; `null`, solange er nicht aufgelöst ist. */
  zeichen: number | null;
  /** Zeichen-Cap der Rolle standard (`getVbCharCap({ bridge, ziel: 'standard' })`). */
  standardCap: number;
  /** Zeichen-Cap der Rolle stark (`getVbCharCap({ bridge, ziel: 'stark' })`). */
  starkCap: number;
  /** Notausfahrt vom Nutzer aktiviert (für diesen Antrag, diese Sitzung). */
  starkErzwungen: boolean;
}): LaufZiel {
  const ziel: KiRolle = eingabe.starkErzwungen ? 'stark' : AUFBEREITUNG_ZIEL;
  return {
    ziel,
    cap: ziel === 'stark' ? eingabe.starkCap : eingabe.standardCap,
    notausfahrtAnbieten: eingabe.zeichen !== null && eingabe.zeichen > eingabe.standardCap,
  };
}
