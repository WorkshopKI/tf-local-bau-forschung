/**
 * Build-Info-Tag mit voller Version (z.B. „v2.61.3") für die untere
 * Sidebar-Zeile — bewusst die komplette Patch-Version sichtbar, damit der
 * User bei häufigen Versionswechseln nicht den Tooltip aufrufen muss.
 * Tooltip auf Hover liefert zusätzlich das Build-Datum für Support.
 *
 * Klick öffnet das Nutzer-Changelog-Modal (ChangelogDialog) — „Was ist neu?".
 */

import { useState } from 'react';
import { buildTime, appVersion } from '@/config/runtime-config';
import { ChangelogDialog } from './changelog/ChangelogDialog';

export function BuildInfo(): React.ReactElement {
  const [open, setOpen] = useState(false);

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
    'Klick: Änderungen & Updates',
  ].join('\n');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center text-[11px] tabular-nums text-[var(--tf-text-tertiary)] select-none shrink-0 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors cursor-pointer"
        title={tooltip}
        aria-label={`Version v${appVersion} — Änderungen und Updates anzeigen`}
      >
        v{appVersion}
      </button>
      <ChangelogDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
