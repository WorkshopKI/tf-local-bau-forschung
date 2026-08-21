/**
 * Kanonischer Chat-Reset-Helfer (frischer Kontext vor einem stateless LLM-Lauf).
 *
 * Nur die Streamlit-Bridge implementiert `resetChat` (klickt den „Neuer Chat"/
 * Reset-Button via `tf-reset`); andere Transporte (DirectLLM/llama.cpp) sind
 * stateless und brauchen es nicht (→ `'nicht-unterstuetzt'`, KEINE Warnung).
 * Fehlschlag bricht den Lauf NIE ab — der Reset ist best-effort. Jeder
 * dokument-tragende Einzel-Skill-Lauf ruft dies VOR dem Submit (Pitfall #36);
 * mehrturnige Chat-Nutzung (Such-Chat-Panel) ist ausgenommen.
 */
import type { AITransport } from './transports/streamlit';
import type { KiRolle } from './modell-katalog';

/** Status eines Chat-Resets. `'ok'`/`'nicht-unterstuetzt'` = unkritisch;
 *  `'nicht-gefunden'`/`'timeout'` = Reset nicht bestätigt → das Ergebnis kann
 *  durch alten Verlauf kontaminiert sein und wird dem Nutzer markiert. */
export type ChatResetStatus = 'ok' | 'nicht-gefunden' | 'timeout' | 'nicht-unterstuetzt';

/**
 * Startet einen frischen Chat (best-effort). Wirft NIE. `nicht-unterstuetzt`,
 * wenn der Transport kein `resetChat` anbietet (stateless API → keine Warnung).
 * `ziel` trifft denselben Tab wie der nachfolgende Submit (produktive Läufe setzen
 * kein `ziel` → aktiver/gpt-oss; nur die dev-Aufbereitungs-Eval reicht optional
 * `'agentisch'` durch, um den Qwen3.6 zu A/B-testen).
 */
export async function starteFrischenChat(transport: AITransport, ziel?: KiRolle): Promise<ChatResetStatus> {
  if (typeof transport.resetChat !== 'function') return 'nicht-unterstuetzt';
  try {
    return await transport.resetChat(ziel);
  } catch (err) {
    console.warn('[ai] Chat-Reset fehlgeschlagen:', err);
    return 'timeout';
  }
}

/** True, wenn ein Reset-Status auf mögliche Verlaufskontamination hindeutet
 *  (Reset nicht bestätigt) — das UI markiert genau diese Läufe. */
export function resetHatVerlaufsrisiko(status: ChatResetStatus): boolean {
  return status === 'nicht-gefunden' || status === 'timeout';
}

/** Fire-and-forget-Wrapper (Rückgabe verworfen) für Pfade, die den Status nicht
 *  auswerten (z.B. Auslastungs-Klassifizierung über den callLLM-Pfad). */
export async function safeResetChat(transport: AITransport): Promise<void> {
  await starteFrischenChat(transport);
}
