/**
 * OfflineBanner (v2.0).
 *
 * Amber-Banner am oberen App-Rand, nicht dismissbar. Wird automatisch
 * ein-/ausgeblendet je nach ConnectionState. Liest aus `useConnectionState`.
 *
 * Anti-Pattern: NICHT als Error/rot rendern. Amber = "Information, eingeschraenkt".
 * App bleibt nutzbar (IDB-Cache).
 */

import { CloudOff, FolderX } from 'lucide-react';
import { useConnectionState } from '@/core/services/connection-status';
import { runtimeConfig } from '@/config/runtime-config';

function formatDate(iso: string | null): string {
  if (!iso) return 'unbekannt';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unbekannt';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OfflineBanner(): React.ReactElement | null {
  const mode = useConnectionState(s => s.mode);
  const persoenlichAvailable = useConnectionState(s => s.persoenlichAvailable);
  const datenShareAvailable = useConnectionState(s => s.datenShareAvailable);
  const lastSync = useConnectionState(s => s.lastSyncTimestamp);

  if (mode === 'online' && persoenlichAvailable) return null;
  // Wenn der Persoenlich-Handle gar nicht eingerichtet ist (User hat ueber-
  // sprungen), zeigen wir das nicht als Offline-Hinweis — nur wenn er da WAR
  // und jetzt nicht erreichbar ist. Aber das wissen wir hier nicht direkt;
  // wir verlassen uns auf die ConnectionState-Logik im Hintergrund.

  if (mode === 'offline') {
    return (
      <div
        className="w-full px-4 py-2 flex items-center gap-2.5 bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] border-b border-[var(--tf-warning-border)] text-[12.5px]"
        role="status"
      >
        <CloudOff size={14} className="shrink-0" />
        <span>
          Offline-Modus — Daten vom {formatDate(lastSync)}. Einige Funktionen sind
          eingeschränkt.
        </span>
      </div>
    );
  }

  // datenShare ok, aber persoenlich missing -> sanfter Hinweis
  if (datenShareAvailable && !persoenlichAvailable && runtimeConfig.personalFolder?.promptAfterProfile) {
    return (
      <div
        className="w-full px-4 py-2 flex items-center gap-2.5 bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] border-b border-[var(--tf-warning-border)] text-[12.5px]"
        role="status"
      >
        <FolderX size={14} className="shrink-0" />
        <span>
          Persönlicher Ordner nicht erreichbar — Einstellungen werden lokal gespeichert.
        </span>
      </div>
    );
  }

  return null;
}
