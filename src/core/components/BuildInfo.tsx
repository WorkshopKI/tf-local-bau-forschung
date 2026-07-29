/**
 * Build-Info-Tag mit voller Version (z.B. „v2.61.3") für die untere
 * Sidebar-Zeile — bewusst die komplette Patch-Version sichtbar, damit der
 * User bei häufigen Versionswechseln nicht den Tooltip aufrufen muss.
 * Tooltip auf Hover liefert zusätzlich das Build-Datum für Support.
 *
 * Klick öffnet „Über die App" (Überblick + Version + Änderungen) über den
 * geteilten `useUeberAppDialog`-Store; gemountet wird der Dialog einmal im
 * ShellLayout, nicht hier.
 */

import { buildTime, appVersion } from '@/config/runtime-config';
import { useUeberAppDialog } from './changelog/useUeberAppDialog';

export function BuildInfo(): React.ReactElement {
  const openDialog = useUeberAppDialog(s => s.openDialog);

  const dateStr = (() => {
    try {
      return new Date(buildTime).toLocaleDateString('de-DE');
    } catch {
      return buildTime;
    }
  })();

  const tooltip = [
    `App-Version: v${appVersion}`,
    `Build vom: ${dateStr}`,
    '',
    'Klick: Über die App',
  ].join('\n');

  return (
    <button
      type="button"
      onClick={() => openDialog()}
      className="inline-flex items-center text-[11px] tabular-nums text-[var(--tf-text-tertiary)] select-none shrink-0 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors cursor-pointer"
      title={tooltip}
      aria-label={`Version v${appVersion} — Über die App`}
    >
      v{appVersion}
    </button>
  );
}
