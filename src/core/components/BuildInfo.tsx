/**
 * Build-Info-Tag mit voller Version (z.B. „v2.61.3") für die untere
 * Sidebar-Zeile — bewusst die komplette Patch-Version sichtbar, damit der
 * User bei häufigen Versionswechseln nicht den Tooltip aufrufen muss.
 * Tooltip auf Hover liefert zusätzlich das Build-Datum für Support.
 */

import { buildTime, appVersion } from '@/config/runtime-config';

export function BuildInfo(): React.ReactElement {
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
  ].join('\n');
  return (
    <span
      className="inline-flex items-center text-[10.5px] text-[var(--tf-text-tertiary)] select-none shrink-0 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-default"
      title={tooltip}
    >
      v{appVersion}
    </span>
  );
}
