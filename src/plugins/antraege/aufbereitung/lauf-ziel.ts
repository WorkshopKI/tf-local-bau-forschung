/**
 * Ziel-KI der Antrag-Aufbereitung — welcher Streamlit-Tab die Bausteine fährt.
 *
 * INVARIANTE: die Aufbereitung läuft auf der **gpt-oss-120b** (`AUFBEREITUNG_ZIEL`),
 * NICHT auf der global gewählten Modellwahl (`useKiZiel`/`aktivesZielFuerLauf`).
 * Muster + Begründung wie `FEEDBACK_ZIEL` in `core/services/feedback/feedbackImprove.ts`:
 * die sechs Bausteine sind enge, einschüssige Extraktions-Aufträge mit striktem
 * Ausgabeformat (Zeilenformat bzw. JSON-Codeblock). Der agentische Chat bringt dafür
 * keinen Mehrwert, kostet aber je Baustein Minuten, antwortet häufiger in Agent-Prosa
 * statt im geforderten Format (→ „Antwort nicht parsebar") und läuft bei sechs
 * Volldurchgängen über den Antragstext in die Transport-Deadline (→ Status `fehler`).
 *
 * EINE Ausnahme, vom Nutzer bewusst gewählt: die **Notausfahrt**. Die gpt-oss-120b hat
 * das kleinere Kontextfenster (62k Token ≈ 174.000 Zeichen gegenüber 259k ≈ 774.000).
 * Passt der Korpus dort nicht hinein, sieht das Modell das Ende des Textes nicht — dann
 * darf der Prüfer für DIESEN Antrag auf Qwen3.6-35B umschalten und bezahlt die
 * Vollständigkeit mit Laufzeit. Die Entscheidung trifft er sichtbar, nicht der Code.
 *
 * Rein + import-arm (die Caps kommen als Zahlen herein, nicht aus `localStorage`) →
 * node-testbar ohne DOM.
 */
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';

/** Ziel-Tab ALLER Aufbereitungs-Bausteine — siehe Invariante im Kopfkommentar. */
export const AUFBEREITUNG_ZIEL: BridgeZiel = 'gpt-oss';

/** Wo die Bausteine laufen, gegen welchen Zeichen-Cap gemessen wird, und ob die
 *  Notausfahrt angeboten werden muss. */
export interface LaufZiel {
  /** Tab, auf dem Reset UND Submit jedes Bausteins landen. */
  ziel: BridgeZiel;
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
  /** Zeichen-Cap gpt-oss-120b (`getVbCharCap({ bridge, ziel: 'gpt-oss' })`). */
  standardCap: number;
  /** Zeichen-Cap der agentischen KI (`getVbCharCap({ bridge, ziel: 'qwen35' })`). */
  agentischCap: number;
  /** Notausfahrt vom Nutzer aktiviert (für diesen Antrag, diese Sitzung). */
  agentischErzwungen: boolean;
}): LaufZiel {
  const ziel: BridgeZiel = eingabe.agentischErzwungen ? 'qwen35' : AUFBEREITUNG_ZIEL;
  return {
    ziel,
    cap: ziel === 'qwen35' ? eingabe.agentischCap : eingabe.standardCap,
    notausfahrtAnbieten: eingabe.zeichen !== null && eingabe.zeichen > eingabe.standardCap,
  };
}
