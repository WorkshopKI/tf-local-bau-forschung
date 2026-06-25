/**
 * Best-effort Chat-Reset (frischer Kontext vor einem LLM-Lauf).
 *
 * Nur die Streamlit-Bridge implementiert `resetChat` (klickt den „Neuer Chat"/
 * Reset-Button via `tf-reset`); andere Transporte (DirectLLM) sind stateless und
 * brauchen es nicht. Fehlschlag / fehlende Unterstützung / kein Reset-Button bricht
 * den Lauf NIE ab — der Reset ist Komfort, kein Muss. Spiegelt das Muster
 * `safeReset` aus plugins/suche/analyse/stages/begruendung.ts.
 */
import type { AITransport } from './transports/streamlit';

export async function safeResetChat(transport: AITransport): Promise<void> {
  try {
    await transport.resetChat?.();
  } catch (err) {
    console.warn('[ai] Chat-Reset fehlgeschlagen:', err);
  }
}
