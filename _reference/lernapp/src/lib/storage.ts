/* ── Zentraler localStorage-Zugriff ──
 * Ersetzt die über 10+ Dateien verstreuten try/catch + JSON.parse/stringify Pattern.
 *
 * Verwendete localStorage Keys:
 *
 * App-Konfiguration:
 *   org_scope                          — Gewählte Abteilung (OrgContext)
 *   theme / theme_mode                 — Theme-Preset / Light-Dark
 *
 * Benutzer-Einstellungen:
 *   platform_settings                  — Allgemeine Plattform-Einstellungen
 *   compliance_settings                — Compliance-Konfiguration
 *   ai_routing_config                  — KI-Routing (Intern/Extern)
 *   thinking_enabled                   — Denkprozess aktiv
 *   custom_openrouter_models           — Eigene OpenRouter-Modelle
 *
 * Benutzer-Daten:
 *   my_skills                          — Gespeicherte Skills (SavedSkill[])
 *   prompt_ratings                     — Stern-Bewertungen pro Prompt
 *   playground_conversations           — Chat-Verläufe im Prompt-Labor
 *   playground_active_id               — Aktive Conversation
 *   daily_challenge_history            — Tagesaufgaben-Verlauf + Streak
 *   iteration_nudge_dismissed          — Nudge permanent ausgeblendet
 *   guest_banner_dismissed             — Gast-Banner ausgeblendet
 *
 * Progress (SyncContext):
 *   user_progress_v2                   — Übungen, Lektionen, Quiz-Scores
 *
 * Legacy:
 *   playground_history                 — Alter Single-Verlauf (migriert)
 */

/** Wert aus localStorage laden mit Fallback auf defaults. */
export function loadFromStorage<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) } as T;
  } catch {
    return defaults;
  }
}

/** JSON-Array oder primitiven Wert aus localStorage laden. */
export function loadArrayFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Wert in localStorage speichern. */
export function saveToStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Schlüssel aus localStorage entfernen. */
export function removeFromStorage(key: string): void {
  localStorage.removeItem(key);
}

/** Einfachen String-Wert laden (ohne JSON). */
export function loadStringFromStorage(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
