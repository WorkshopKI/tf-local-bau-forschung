/**
 * NeueAntraegeAlleModal — „Alle"-Overlay der Homepage-Sektion „Neue Anträge für
 * dich". Listet alle offenen Verbünde kompakt; aus NeueAntraegeFuerDich.tsx
 * extrahiert (Datei-Größe / Kohäsion, CLAUDE.md → File Size Limit).
 */
import { Dialog } from '@/components/ui/dialog';
import { NeueAntraegeVerbundRow } from './NeueAntraegeVerbundRow';
import type { VerbundEintrag } from './neueAntraegeVerbund';

interface ModalProps {
  alle: VerbundEintrag[];
  onClose: () => void;
  onUebernehmen: (leadAktenzeichen: string) => void;
  busy?: boolean;
}

export function NeueAntraegeAlleModal({ alle, onClose, onUebernehmen, busy }: ModalProps): React.ReactElement {
  return (
    <Dialog open onClose={onClose} size="lg" align="top" title={`Alle neuen Anträge (${alle.length})`}>
      {/* Kompakte Verbund-Zeilen, damit möglichst viele ohne Scrollen sichtbar sind. */}
      <div className="flex flex-col gap-1.5">
        {alle.map(v => (
          <NeueAntraegeVerbundRow
            key={v.verbundId}
            verbund={v}
            onUebernehmen={() => onUebernehmen(v.leadAktenzeichen)}
            disabled={busy}
            compact
          />
        ))}
      </div>
    </Dialog>
  );
}
