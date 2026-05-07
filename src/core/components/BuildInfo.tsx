/**
 * Kompakter Build-Info-Tag (z.B. „v1.14") für die untere Sidebar-Zeile.
 * Tooltip auf Hover liefert das volle Set für Support: Variant, Git-Hash,
 * Build-Datum.
 */

import { runtimeConfig, buildTime, gitHash, appVersion } from '@/config/runtime-config';

export function BuildInfo(): React.ReactElement {
  const dateStr = (() => {
    try {
      return new Date(buildTime).toLocaleDateString('de-DE');
    } catch {
      return buildTime;
    }
  })();

  const shortVersion = appVersion.split('.').slice(0, 2).join('.');
  return (
    <span
      className="text-[10.5px] text-[var(--tf-text-tertiary)] select-none shrink-0 px-1"
      title={`v${appVersion} · ${runtimeConfig.variant} · ${gitHash} · ${dateStr}`}
    >
      v{shortVersion}
    </span>
  );
}
