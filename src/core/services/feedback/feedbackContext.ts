// Erfasst automatisch App-Kontext für Feedback-Tickets.
// Registriert idempotent window.onerror + unhandledrejection für Ring-Buffer der letzten 5 Fehler.

import type { FeedbackContext } from '@/core/types/feedback';

const sessionStart = Date.now();
const errorBuffer: string[] = [];
const MAX_ERRORS = 5;
let registered = false;

function pushError(msg: string): void {
  if (!msg) return;
  errorBuffer.push(msg.slice(0, 200));
  if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
}

function ensureRegistered(): void {
  if (registered) return;
  registered = true;
  try {
    window.addEventListener('error', (e) => {
      pushError(`${e.message ?? 'Fehler'} (${e.filename ?? '?'}:${e.lineno ?? '?'})`);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unhandled promise rejection');
      pushError(reason);
    });
  } catch {
    // SSR oder Test-Umgebung — ignorieren
  }
}

ensureRegistered();

function getDevice(width: number): 'Mobile' | 'Tablet' | 'Desktop' {
  if (width < 768) return 'Mobile';
  if (width < 1024) return 'Tablet';
  return 'Desktop';
}

export function captureFeedbackContext(activePluginId: string, activePluginName: string): FeedbackContext {
  return {
    route: activePluginId,
    page: activePluginName,
    device: getDevice(window.innerWidth),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    lastAction: getLastAction(),
    sessionDuration: Math.round((Date.now() - sessionStart) / 1000),
    errors: [...errorBuffer],
    timestamp: new Date().toISOString(),
  };
}

export function getCapturedErrors(): string[] {
  return [...errorBuffer];
}

export function getLastAction(): string | undefined {
  // Stub: ActionTracker kommt erst in Phase 3.
  return undefined;
}
