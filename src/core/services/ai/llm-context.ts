/**
 * LLM-Kontextlänge (Tokens) → abgeleiteter VB-Zeichen-Cap.
 *
 * Drei Quellen mit Präzedenz (höchste zuerst):
 *  1. **manuell** — der Bearbeiter trägt in den Einstellungen (KI-Assistent) einen
 *     Wert ein (`teamflow_llm_context_tokens`). Explizite Übersteuerung gewinnt.
 *  2. **erkannt** — automatisch vom lokalen llama.cpp-Server geprobt (`/props`,
 *     `teamflow_llm_context_detected`). Solange der Bearbeiter nichts eingetragen
 *     hat, gilt der echte Server-Wert (kein Nachpflegen im Code bei LLM-Wechsel).
 *  3. **Default** — `DEFAULT_LLM_CONTEXT_TOKENS`, wenn weder manuell noch erkannt.
 *
 * Daraus wird der Schwellwert berechnet, ab dem die Vorhabensbeschreibung vor dem
 * Senden gekürzt wird (`capVbMarkdown` in [run-skill.ts]).
 *
 * Persistenz: `localStorage` — die Einstellung ist **per-Maschine** (das LLM läuft
 * lokal/maschinen-spezifisch), synchron lesbar (fließt ohne Async-State direkt in
 * `runSkill` + die proaktiven UI-Checks) und ein simpler Skalar.
 */

import type { BridgeZiel } from './transports/streamlit';

const LLM_CONTEXT_TOKENS_KEY = 'teamflow_llm_context_tokens';
const LLM_CONTEXT_DETECTED_KEY = 'teamflow_llm_context_detected';

/** Default-Voreinstellung, falls weder manuell gesetzt noch vom Server erkannt
 *  (entspricht der internen llama.cpp-Qwen-Konfiguration, `kontext_groesse` 81920). */
export const DEFAULT_LLM_CONTEXT_TOKENS = 81_920;

/**
 * Kontextfenster der Modelle der internen KI, in **Tokens** — nur noch der
 * RÜCKFALL, falls die Seite gerade nichts sagt.
 *
 * Bis v5.0 waren das die einzige Quelle, und sie sind still gedriftet: im Code
 * standen 262k, die Seite zeigte 259k. Ein zu gross angesetztes Fenster fällt
 * nicht auf — das Modell schiebt dann den Anfang des Prompts heraus, das Ergebnis
 * ist still falsch statt sichtbar gekürzt. Seit das Bookmarklet die angezeigte
 * Chatlänge mitmeldet (`speichereGelernteBridgeTokens`), sind die Zahlen hier nur
 * noch die Antwort auf „bevor wir es zum ersten Mal gesehen haben".
 */
export const BRIDGE_KONTEXT_TOKENS: Record<BridgeZiel, number> = {
  'gpt-oss': 62_000,
  qwen35: 259_000,
};
export const MIN_LLM_CONTEXT_TOKENS = 2_048;
export const MAX_LLM_CONTEXT_TOKENS = 1_000_000;

/**
 * Token-Reserve: alles, was neben der Vorhabensbeschreibung im Fenster liegt.
 *
 * Bemessen am **teuersten** Fall, weil ein Überlauf nicht auffällt: llama.cpp
 * schiebt dann den ANFANG aus dem Fenster (System-Prompt), das Ergebnis ist still
 * falsch statt sichtbar gekürzt. Bei aktivem Thinking belegt allein der Output
 * `DEFAULT_MAX_TOKENS + THINKING_OUTPUT_HEADROOM` = 2.048 + 8.192 = 10.240 Tokens
 * ([run-skill.ts]); dazu kommen System-Prompt, Qualitätsregeln und die
 * (Workflow-)Vorabschnitte. 12.288 deckt das mit Marge.
 *
 * Exportiert, weil die Kopplung an das Output-Budget sonst nur eine Behauptung
 * im Kommentar wäre: der Guard `reserve-deckt-output-budget` rechnet sie nach.
 */
export const RESERVE_TOKENS = 12_288;
/**
 * Zeichen/Token-Quote — **gemessen, nicht geschätzt**.
 *
 * Referenzmessung (v4.113, interne KI / gpt-oss): ein deutscher Förderantrag
 * mit 220.000 Zeichen (~20.000 Wörter, 23 Tabellen) belegt in der Chatoberfläche
 * 42k von 62k Tokens → **5,24 Zeichen/Token**. Der wahre Wert liegt eher darüber,
 * weil die angezeigten 42k den Overhead der Streamlit-Seite mitzählen.
 *
 * Angesetzt sind 4,8 — rund 8 % Abzug, der Puffer für Material, das schlechter
 * tokenisiert als Fließtext (Zahlenkolonnen, Tabellen-Pipes, Kennzeichen).
 *
 * Vorher stand hier 3, eine bewusst gesetzte Sicherheitsmarge ohne Messung. Sie
 * unterschätzte um Faktor 1,7 und warnte damit bei Dokumenten, die bequem ins
 * Fenster passten. Wer sie erneut anfasst, misst vorher genauso: ein reales
 * Dokument in die interne KI laden und Zeichenzahl gegen die angezeigte Belegung
 * rechnen.
 *
 * Modellabhängig — bei einem Wechsel des internen Modells (anderer Tokenizer) neu
 * messen.
 */
const CHARS_PER_TOKEN = 4.8;
/** Untergrenze des abgeleiteten Caps, falls jemand eine winzige Kontextgröße einträgt. */
const MIN_VB_CHAR_CAP = 4_000;

/** Woraus der aktuell wirksame Kontextwert stammt (für die Einstellungs-Anzeige). */
export type LlmContextSource = 'manuell' | 'erkannt' | 'default';

/** Gespeicherten Token-Wert lesen, validieren + clampen; `null` wenn ungesetzt/ungültig. */
function readClampedTokens(key: string): number | null {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, MIN_LLM_CONTEXT_TOKENS), MAX_LLM_CONTEXT_TOKENS);
}

/**
 * Wo der Lauf hingeht — entscheidet, welches Kontextfenster gilt.
 *
 * Über die Bridge gilt das Fenster **des gewählten Modells** — abgelesen von der
 * KI-Seite, ersatzweise die Konstante; lokal (llama.cpp/Cloud) gilt weiter
 * manuell > erkannt > Default. Ohne Angabe bleibt es beim lokalen Verhalten.
 */
export interface KontextZiel {
  /** true = die Bridge zur internen KI ist der aktive Provider. */
  bridge?: boolean;
  /** Gewähltes Modell; `undefined` zählt wie `'gpt-oss'` (das kleinere Fenster —
   *  im Zweifel lieber zu früh warnen als zu spät). */
  ziel?: BridgeZiel;
}

/** LS-Schlüssel des von der KI-Seite abgelesenen Fensters, je Modell. */
function gelerntKey(ziel: BridgeZiel): string {
  return `teamflow_bridge_ctx_${ziel}`;
}

/**
 * Das vom Bookmarklet abgelesene Kontextfenster festhalten („Chatlänge [Token]:
 * 0k von 62k"). Wird nach jedem Lauf gemeldet; lesbar ist immer nur das gerade
 * AKTIVE Modell, die App lernt also eins nach dem anderen dazu.
 *
 * `0`/Unsinn wird verworfen — ein Lesefehler darf die Rechnung nicht kapern.
 */
export function speichereGelernteBridgeTokens(ziel: BridgeZiel, tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  if (!Number.isFinite(tokens) || tokens < MIN_LLM_CONTEXT_TOKENS || tokens > MAX_LLM_CONTEXT_TOKENS) return;
  localStorage.setItem(gelerntKey(ziel), String(Math.round(tokens)));
}

/** Abgelesenes Fenster eines Modells; `null`, wenn wir es noch nie gesehen haben. */
export function getGelernteBridgeTokens(ziel: BridgeZiel): number | null {
  return readClampedTokens(gelerntKey(ziel));
}

/**
 * Wirksame LLM-Kontextlänge (Tokens).
 *
 * Präzedenz: **manuell > abgelesen > Konstante > erkannt > Default.** Die manuelle
 * Übersteuerung gewinnt auch über die Bridge-Werte — wer sie gesetzt hat, weiss,
 * was er tut, und soll sie nicht stillschweigend überschrieben bekommen. Direkt
 * darunter steht, was die KI-Seite selbst anzeigt; die Konstanten greifen nur,
 * solange wir das Modell noch nie gesehen haben.
 */
export function getLlmContextTokens(ziel?: KontextZiel): number {
  const manuell = readClampedTokens(LLM_CONTEXT_TOKENS_KEY);
  if (manuell !== null) return manuell;
  if (ziel?.bridge === true) {
    const modell = ziel.ziel ?? 'gpt-oss';
    return getGelernteBridgeTokens(modell) ?? BRIDGE_KONTEXT_TOKENS[modell];
  }
  return readClampedTokens(LLM_CONTEXT_DETECTED_KEY) ?? DEFAULT_LLM_CONTEXT_TOKENS;
}

/** Quelle des aktuell wirksamen Werts (manuell übersteuert erkannt übersteuert Default). */
export function getLlmContextSource(): LlmContextSource {
  if (readClampedTokens(LLM_CONTEXT_TOKENS_KEY) !== null) return 'manuell';
  if (readClampedTokens(LLM_CONTEXT_DETECTED_KEY) !== null) return 'erkannt';
  return 'default';
}

/** Manuelle LLM-Kontextlänge (Tokens) persistieren (übersteuert die Server-Erkennung). */
export function setLlmContextTokens(tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_CONTEXT_TOKENS_KEY, String(tokens));
}

/** Manuelle Übersteuerung löschen → zurück auf erkannt/Default (Automatik). */
export function clearManualLlmContextTokens(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LLM_CONTEXT_TOKENS_KEY);
}

/** Vom Server (llama.cpp `/props`) erkannten Kontextwert persistieren. */
export function setDetectedLlmContextTokens(tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_CONTEXT_DETECTED_KEY, String(tokens));
}

/**
 * Aus dem Kontextfenster (Tokens) den sicheren VB-Zeichen-Cap ableiten.
 *
 * `Math.floor`, weil `CHARS_PER_TOKEN` gebrochen ist — ohne das stünde in der
 * Oberfläche „~233.433,6 Zeichen", und der Cap wäre keine Zeichenzahl mehr.
 */
export function computeVbCharCap(contextTokens: number): number {
  return Math.max(MIN_VB_CHAR_CAP, Math.floor((contextTokens - RESERVE_TOKENS) * CHARS_PER_TOKEN));
}

/**
 * Grobe Token-Schätzung einer Zeichenzahl — die Umkehrung derselben Quote, mit der
 * der Cap gerechnet wird. Nur für Anzeigen (Prompt-Ansicht, Kontext-Warnung); eine
 * zweite Quote an der Anzeigestelle würde gegen die Cap-Rechnung driften.
 */
export function schaetzeTokens(zeichen: number): number {
  return Math.round(zeichen / CHARS_PER_TOKEN);
}

/**
 * Aktueller VB-Zeichen-Cap. Ohne `ziel` gilt das lokale Kontextfenster
 * (manuell > erkannt > Default) — genau wie bisher.
 */
export function getVbCharCap(ziel?: KontextZiel): number {
  return computeVbCharCap(getLlmContextTokens(ziel));
}
