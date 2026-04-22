/**
 * Build-Info-Footer: Variant · Git-Hash · Build-Datum.
 * Klein, dezent, unten in der Sidebar. Nützlich für Support-Fälle
 * ("welche Variante hast du, wann gebaut?") ohne große Modal-Dialoge.
 */

import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';

export function BuildInfo(): React.ReactElement {
  const dateStr = (() => {
    try {
      return new Date(buildTime).toLocaleDateString('de-DE');
    } catch {
      return buildTime;
    }
  })();

  return (
    <div
      className="px-3 py-1.5 text-[10px] text-[var(--tf-text-tertiary)] leading-tight select-none"
      title={`${runtimeConfig.build.label} · ${runtimeConfig.variant} · ${gitHash} · ${buildTime}`}
    >
      <div className="truncate">{runtimeConfig.variant} · {gitHash}</div>
      <div className="truncate">{dateStr}</div>
    </div>
  );
}
