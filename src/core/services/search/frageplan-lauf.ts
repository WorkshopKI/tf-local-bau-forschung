/**
 * Der eine KI-Aufruf hinter der Suche mit natürlicher Sprache.
 *
 * Vorbild ist `submitInline` in
 * [feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts) — ein
 * kurzer, einschüssiger Lauf mit JSON-Antwort, nicht der mehrstufige
 * Assistenten-Turn. Sechs Dinge sind dabei nicht verhandelbar:
 *
 *  1. **Nur intern.** Über `getTransportForDatenLauf`, nie über den rohen
 *     aktiven Transport. Die Frage selbst trägt zwar keine Dokumentinhalte, der
 *     Plan wird aber aus dem Bestand heraus beantwortet — und ein externer
 *     Provider ist hier strukturell unerreichbar, nicht bloß unerwünscht
 *     (Pitfall #30).
 *  2. **Passiver Ping vor dem Lauf.** `kiVerbindungGeprueft` fragt die Bridge
 *     wirklich (öffnet KEINEN Tab, Konventionstest `kein-oeffnender-ping`) und
 *     öffnet bei `false` den app-weiten Verbinden-Dialog statt eines eigenen
 *     Fehlerbanners.
 *  3. **Frischer Chat vor dem Submit.** Der Streamlit-Chat ist stateful; ohne
 *     Reset deutet der vorige Verlauf in den Plan hinein (Pitfall #36).
 *  4. **Ziel ausdrücklich auf `standard`.** `undefined` heißt an der Bridge
 *     „aktiver Tab", nicht „Standard-Tab" — der Denkfehler, den
 *     [ki-ziel.ts](src/core/services/ai/ki-ziel.ts) beschreibt. Das ist auch die
 *     Antwort auf „nimm die Standard-KI": welches Modell dort läuft, setzt der
 *     Server, die App wählt den Tab.
 *  5. **System-Prompt in die Message inlinen.** `StreamlitBridgeTransport`
 *     verwirft den zweiten Parameter; er bleibt trotzdem gesetzt, damit
 *     DirectLLM-Transporte ihn als System-Rolle bekommen.
 *  6. **Ein Aufruf, kein Retry, wirft nie.** Fehler kommen als Ergebnis zurück.
 *     Ein zweiter Lauf kostete den Nutzer die Wartezeit noch einmal und lieferte
 *     bei einem Modell, das gerade Prosa schreibt, wieder Prosa.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { baueFrageplanPrompt, parseFrageplan, type Frageplan } from './frageplan';

/** Ziel-Tab für den Frageplan — siehe Pflicht 4 im Kopfkommentar. */
const FRAGEPLAN_ZIEL: BridgeZiel = 'standard';

/** Benennt den Lauf in der Fehlermeldung der Transport-Policy. */
const ZWECK = 'Die Suche mit natürlicher Sprache';

export type FrageplanErgebnis =
  | { ok: true; plan: Frageplan }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

/**
 * Meldungen. Ausformuliert und ohne Schuldzuweisung — sie stehen im Suchfeld-
 * Bereich, wo der Nutzer gerade eine Antwort erwartet hat.
 */
const MELDUNG = {
  leer: 'Bitte eine Frage eingeben.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — die Frage konnte nicht übersetzt werden.',
  keinPlan: 'Aus dieser Frage ließen sich keine Suchbegriffe ableiten. Es wurde nach dem eingegebenen Text gesucht.',
  abgebrochen: 'Die Übersetzung wurde abgebrochen.',
} as const;

/**
 * Übersetzt eine Frage in einen Frageplan.
 *
 * `heuteJahr` kommt von außen, damit der reine Prompt-Bau ohne Uhr auskommt und
 * testbar bleibt. `signal` bricht einen laufenden Aufruf ab, wenn der Nutzer
 * weitertippt.
 */
export async function ermittleFrageplan(
  bridge: AIBridge,
  frage: string,
  heuteJahr: number,
  signal?: AbortSignal,
): Promise<FrageplanErgebnis> {
  if (frage.trim().length === 0) return { ok: false, fehler: MELDUNG.leer };

  // Pflicht 1. Wirft bei externem Provider — das ist der einzige Wurf, den diese
  // Funktion abfängt und in eine lesbare Meldung übersetzt.
  let transport;
  try {
    transport = bridge.getTransportForDatenLauf(ZWECK);
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  // Pflicht 2. Öffnet bei `false` selbst den Verbinden-Dialog; der Aufrufer muss
  // dafür nichts tun ausser die Eingabe stehen zu lassen.
  if (!await kiVerbindungGeprueft(bridge, transport.name)) {
    return { ok: false, fehler: MELDUNG.nichtVerbunden, verbindungFehlt: true };
  }

  const { systemPrompt, userPrompt } = baueFrageplanPrompt(frage, heuteJahr);

  let roh: string;
  try {
    // Pflicht 3 und 4.
    await starteFrischenChat(transport, FRAGEPLAN_ZIEL);
    if (signal?.aborted) return { ok: false, fehler: MELDUNG.abgebrochen };
    // Pflicht 5 und 6.
    roh = await transport.submitMessage(`${systemPrompt}\n\n${userPrompt}`, systemPrompt, {
      ziel: FRAGEPLAN_ZIEL,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return { ok: false, fehler: MELDUNG.abgebrochen };
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  const plan = parseFrageplan(roh, frage);
  if (!plan) return { ok: false, fehler: MELDUNG.keinPlan };
  return { ok: true, plan };
}

/** Für die Tests der Aufrufer — die Meldungen sind Teil des Verhaltens. */
export const FRAGEPLAN_MELDUNG = MELDUNG;
