/**
 * Kompakter Build-Info-Tag (z.B. „v1.14") für die untere Sidebar-Zeile.
 * Tooltip auf Hover liefert das volle Set für Support: Variant, Git-Hash,
 * Build-Datum.
 */

import { runtimeConfig, buildTime, appVersion } from '@/config/runtime-config';

const VARIANT_LABEL: Record<string, string> = {
  production: 'Standard',
  development: 'Entwicklung',
  demo: 'Demo',
};

export function BuildInfo(): React.ReactElement {
  const dateStr = (() => {
    try {
      return new Date(buildTime).toLocaleDateString('de-DE');
    } catch {
      return buildTime;
    }
  })();

  const shortVersion = appVersion.split('.').slice(0, 2).join('.');
  const variantLabel = VARIANT_LABEL[runtimeConfig.variant] ?? runtimeConfig.variant;
  const tooltip = [
    `App-Version: v${appVersion}`,
    `Variante: ${variantLabel}`,
    `Build vom: ${dateStr}`,
  ].join('\n');
  return (
    <span
      className="inline-flex items-center text-[10.5px] text-[var(--tf-text-tertiary)] select-none shrink-0 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-default"
      title={tooltip}
    >
      v{shortVersion}
    </span>
  );
}
