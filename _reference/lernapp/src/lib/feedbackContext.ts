/* ── Automatische Feedback-Kontext-Erfassung ──
 * Wird beim Öffnen des Feedback-Panels aufgerufen.
 */

import { LS_KEYS } from "@/lib/constants";
import type { FeedbackContext } from "@/types";
import { getRecentActions, getLastAction, getLastFeature, getCapturedErrors } from "./actionTracker";

const sessionStart = Date.now();

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/library": "Prompt-Sammlung",
  "/playground": "Prompt-Labor",
  "/onboarding": "Onboarding",
  "/settings": "Einstellungen",
  "/admin/teilnehmer": "Admin: Teilnehmer",
  "/admin/feedback": "Admin: Feedback",
};

function getDevice(width: number): string {
  if (width < 768) return "Mobile";
  if (width < 1024) return "Tablet";
  return "Desktop";
}

/** Erfasst den aktuellen App-Kontext für ein Feedback-Ticket */
export function captureFeedbackContext(): FeedbackContext {
  const route = window.location.pathname;
  return {
    route,
    page: ROUTE_LABELS[route] ?? route,
    mode: localStorage.getItem(LS_KEYS.APP_MODE) ?? "standalone",
    lastFeature: getLastFeature(),
    lastAction: getLastAction(),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    device: getDevice(window.innerWidth),
    timestamp: new Date().toISOString(),
    errors: getCapturedErrors(),
    sessionDuration: Math.round((Date.now() - sessionStart) / 1000),
  };
}
