/**
 * Pure-DOM-Toast + Auto-Reload nach destruktiven Fixture-Aktionen.
 *
 * WICHTIG: darf nicht auf React oder Zustand-Stores zugreifen — wir reloaden
 * gleich und der React-Tree wird verworfen. `document.createElement` genügt.
 */

import { features } from '@/config/feature-flags';
import { getDevConfig } from './dev.config';

const TOAST_ID = 'tf-dev-reload-toast';

export function showReloadToast(label: string): void {
  // Bestehenden Toast entfernen (mehrfaches Klicken).
  document.getElementById(TOAST_ID)?.remove();
  const el = document.createElement('div');
  el.id = TOAST_ID;
  el.textContent = `✓ ${label}, lade neu …`;
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    padding: '8px 16px',
    background: '#fef3c7', // amber-100
    color: '#78350f',      // amber-900
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid #f59e0b',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
}

/**
 * Zeigt Toast, wartet kurz damit er sichtbar wird, dann Full-Page-Reload.
 * Gate über `features.devFixtures` (Compile + Runtime) + `dev.autoReloadAfterScenario`.
 *
 * Gibt eine Promise zurück die nie resolved (Reload unterbricht), damit aufrufer
 * Folge-Code nach dem `await` ausdrücklich nicht mehr laufen lassen.
 */
export async function maybeReloadAfterDestructive(label: string): Promise<void> {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) return;
  const dev = getDevConfig();
  if (!dev.autoReloadAfterScenario) return;
  showReloadToast(label);
  await new Promise(resolve => window.setTimeout(resolve, 400));
  window.location.reload();
  // Nie erreicht — aber Promise hält offen, damit kein Folge-Code läuft.
  await new Promise(() => { /* never resolves */ });
}
