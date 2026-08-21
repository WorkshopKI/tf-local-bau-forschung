/**
 * Der **einschüssige KI-Lauf**: ein Prompt, eine Antwort, kein Gespräch.
 *
 * Vorbild ist `submitInline` in
 * [feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts) — ein
 * kurzer Lauf mit strukturierter Antwort, nicht der mehrstufige
 * Assistenten-Turn. Sechs Dinge sind dabei nicht verhandelbar, und sie stehen
 * **hier**, weil sie sonst bei jedem neuen Aufrufer als Prosa mitwandern:
 *
 *  1. **Nur intern.** Über `getTransportForDatenLauf`, nie über den rohen
 *     aktiven Transport. Auch wo die Frage selbst keine Dokumentinhalte trägt,
 *     wird sie aus dem Bestand heraus beantwortet — ein externer Provider ist
 *     hier strukturell unerreichbar, nicht bloß unerwünscht (Pitfall #30).
 *  2. **Passiver Ping vor dem Lauf.** `kiVerbindungGeprueft` fragt den Transport
 *     wirklich (öffnet KEINEN Tab, Konventionstest `kein-oeffnender-ping`) und
 *     öffnet bei `false` den app-weiten Verbinden-Dialog statt eines eigenen
 *     Fehlerbanners. Fällt die Verbindung ZWISCHEN Ping und Antwort aus, fängt
 *     `istVerbindungsFehler` das unten ab — ein roher „Failed to fetch" darf den
 *     Nutzer nie erreichen.
 *  3. **Frischer Chat vor dem Submit.** Der Streamlit-Chat ist stateful; ohne
 *     Reset deutet der vorige Verlauf in die Antwort hinein (Pitfall #36).
 *  4. **Ziel ausdrücklich auf `standard`.** `undefined` heißt an der Bridge
 *     „aktiver Tab", nicht „gpt-oss" — der Denkfehler, den
 *     [ki-ziel.ts](src/core/services/ai/ki-ziel.ts) beschreibt. Das ist auch die
 *     Antwort auf „nimm gpt-oss-120b": welches Modell dort läuft, setzt der
 *     Server, die App wählt den Tab.
 *  5. **System-Prompt in die Message inlinen.** `StreamlitBridgeTransport`
 *     verwirft den zweiten Parameter; er bleibt trotzdem gesetzt, damit
 *     DirectLLM-Transporte ihn als System-Rolle bekommen.
 *  6. **Ein Aufruf, kein Retry, wirft nie.** Fehler kommen als Ergebnis zurück.
 *     Ein zweiter Lauf kostete den Nutzer die Wartezeit noch einmal und lieferte
 *     bei einem Modell, das gerade Prosa schreibt, wieder Prosa.
 *
 * **Was hier NICHT lebt**: das Deuten der Antwort. Dieser Lauf gibt den Rohtext
 * zurück; jeder Aufrufer parst ihn selbst und entscheidet selbst, was „nichts
 * Verwertbares" heißt. Ein gemeinsamer Parser wäre die Stelle, an der ein
 * Frageplan die Regeln einer Freitext-Antwort erbt.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { kiVerbindungGeprueft, istVerbindungsFehler, useKiConnectPrompt } from '@/core/services/ai/ki-guard';
import type { KiRolle } from '@/core/services/ai/modell-katalog';

/** Ziel-Tab jedes einschüssigen Laufs — siehe Pflicht 4. */
const EIN_SCHUSS_ZIEL: KiRolle = 'standard';

/**
 * Die Regel gegen mehrstufige Plan-/Werkzeug-Schleifen.
 *
 * `nurDas` benennt, was am Ende dastehen soll — „der JSON-Block" bei einem
 * strukturierten Lauf, „die Antwort" bei einem Text. Der Rest ist wortgleich;
 * die Regel stand bis v4.104 in drei Dateien und wäre beim nächsten Aufrufer ein
 * viertes Mal abgeschrieben worden.
 */
export function einZugRegel(nurDas: string): string {
  return 'Antworte in EINEM Zug: kein Plan, keine Zwischenschritte, keine Werkzeuge,'
    + ` kein sichtbares Nachdenken — nur ${nurDas}.`;
}

/**
 * Die beiden Meldungen, die je Lauf anders lauten müssen.
 *
 * Sie stehen dort, wo der Nutzer gerade eine Antwort erwartet hat, und sagen
 * deshalb, was der Ausfall für SEINE Sicht bedeutet („die Treffer stehen, eine
 * Antwort dazu nicht"). Eine gemeinsame Formulierung wäre an jeder Stelle
 * ungefähr richtig und an keiner genau.
 */
export interface EinSchussMeldungen {
  nichtVerbunden: string;
  abgebrochen: string;
}

export type EinSchussErgebnis =
  | { ok: true; roh: string }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

export interface EinSchussAuftrag {
  bridge: AIBridge;
  /** Benennt den Lauf in der Fehlermeldung der Transport-Policy (Pflicht 1). */
  zweck: string;
  systemPrompt: string;
  userPrompt: string;
  meldungen: EinSchussMeldungen;
  /** Bricht einen laufenden Aufruf ab, wenn der Nutzer weitertippt. */
  signal?: AbortSignal;
}

/**
 * Führt die sechs Pflichten aus und gibt den Rohtext des Modells zurück.
 *
 * Wirft nie (Pflicht 6) — auch nicht bei externem Transport, fehlender
 * Verbindung oder Abbruch.
 */
export async function fuehreEinSchussLauf(a: EinSchussAuftrag): Promise<EinSchussErgebnis> {
  const { bridge, zweck, systemPrompt, userPrompt, meldungen, signal } = a;

  // Pflicht 1. Wirft bei externem Provider — das ist der einzige Wurf, den diese
  // Funktion in eine lesbare Meldung übersetzt.
  let transport;
  try {
    transport = bridge.getTransportForDatenLauf(zweck);
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  // Pflicht 2. Öffnet bei `false` selbst den Verbinden-Dialog; der Aufrufer muss
  // dafür nichts tun außer die Eingabe stehen zu lassen.
  if (!await kiVerbindungGeprueft(bridge, transport.name)) {
    return { ok: false, fehler: meldungen.nichtVerbunden, verbindungFehlt: true };
  }

  try {
    // Pflicht 3 und 4.
    await starteFrischenChat(transport, EIN_SCHUSS_ZIEL);
    if (signal?.aborted) return { ok: false, fehler: meldungen.abgebrochen };
    // Pflicht 5 und 6.
    const roh = await transport.submitMessage(`${systemPrompt}\n\n${userPrompt}`, systemPrompt, {
      ziel: EIN_SCHUSS_ZIEL,
      signal,
    });
    return { ok: true, roh };
  } catch (err) {
    if (signal?.aborted) return { ok: false, fehler: meldungen.abgebrochen };
    // Der Preflight oben hat gerade noch „erreichbar" gesagt — ein Server kann
    // trotzdem zwischen Ping und Submit verschwinden. Dann darf hier NICHT der
    // rohe Browser-Text stehen („Failed to fetch"), sondern dieselbe
    // Aufforderung, die der Preflight gezeigt hätte.
    if (istVerbindungsFehler(err)) {
      useKiConnectPrompt.getState().oeffnen();
      return { ok: false, fehler: meldungen.nichtVerbunden, verbindungFehlt: true };
    }
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }
}
