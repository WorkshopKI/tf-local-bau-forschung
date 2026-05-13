/* ── Proaktive Feedback-Trigger ──
 * Max. 1 Trigger pro Session. Sprechblase erscheint neben dem FAB.
 */

import type { FeedbackTrigger, FeedbackCategory } from "@/types";

const SESSION_KEY = "ps-feedback-trigger-shown";

export const TRIGGERS: FeedbackTrigger[] = [
  {
    event: "error_displayed",
    delay: 2000,
    message: "Etwas schiefgelaufen? Sag uns Bescheid.",
    category: "problem" as FeedbackCategory,
  },
  {
    event: "prompt_iteration_5",
    delay: 1000,
    message: "Schon 5 Iterationen — läuft es rund?",
  },
  {
    event: "first_feature_use",
    delay: 5000,
    message: "Erste Erfahrung — wie war's?",
  },
  {
    event: "quality_check_failed",
    delay: 2000,
    message: "Prüfung nicht bestanden — ist das Feedback klar genug?",
    category: "question" as FeedbackCategory,
  },
  {
    event: "daily_challenge_complete",
    delay: 1000,
    message: "Geschafft! Wie fandest du die Aufgabe?",
    category: "praise" as FeedbackCategory,
  },
  {
    event: "session_duration_15min",
    delay: 0,
    message: "Schon 15 Minuten dabei — Feedback?",
  },
  {
    event: "export_completed",
    delay: 2000,
    message: "Export fertig — alles wie erwartet?",
  },
];

/** Prüft ob ein Trigger ausgelöst werden soll. Gibt null zurück wenn bereits ein Trigger gezeigt wurde. */
export function emitTrigger(event: string): FeedbackTrigger | null {
  if (sessionStorage.getItem(SESSION_KEY)) return null;

  const trigger = TRIGGERS.find((t) => t.event === event);
  if (!trigger) return null;

  sessionStorage.setItem(SESSION_KEY, "true");
  return trigger;
}

/** Trigger-Anzeige für diese Session stumm schalten */
export function dismissTrigger(): void {
  sessionStorage.setItem(SESSION_KEY, "true");
}

/** Prüft ob bereits ein Trigger in dieser Session gezeigt wurde */
export function wasTriggerShown(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY);
}
