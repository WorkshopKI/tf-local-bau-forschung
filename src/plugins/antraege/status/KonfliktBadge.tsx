/**
 * Kleines Konflikt-Badge (Phase 5) — ein AlertTriangle mit dem „Warum?"-Panel
 * als Tooltip-Inhalt. Rendert NICHTS, wenn die Ableitung keinen Konflikt trägt.
 * Wiederverwendet in der Antrags-Tabelle (kompakt) und der Detailsektion.
 */
import { AlertTriangle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { AbleitungsErgebnis, MappingVersion } from '@/core/status';
import { StatusWarum } from './StatusWarum';

export function KonfliktBadge({
  ableitung,
  version,
  kompakt = false,
}: {
  ableitung: AbleitungsErgebnis;
  version: MappingVersion;
  /** Nur das Icon (Tabellen-Zelle); sonst Icon + kurzer Text. */
  kompakt?: boolean;
}): React.ReactElement | null {
  if (!ableitung.konflikt) return null;
  return (
    <Tooltip content={<StatusWarum ableitung={ableitung} version={version} />} maxWidth={380}>
      <span className="inline-flex items-center gap-1 align-middle text-[var(--tf-warning-text)] cursor-help">
        <AlertTriangle size={13} aria-hidden="true" />
        {kompakt ? null : <span className="text-[11px]">Widerspruch</span>}
      </span>
    </Tooltip>
  );
}
