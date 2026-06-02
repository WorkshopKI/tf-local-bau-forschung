/**
 * NeueAntraegeAlleModal — „Alle"-Overlay der Homepage-Sektion „Neue Anträge für
 * dich". Listet alle offenen Verbünde kompakt; aus NeueAntraegeFuerDich.tsx
 * extrahiert (300-Zeilen-Regel, CLAUDE.md).
 */
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-[12px] flex flex-col"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <h2 className="text-[14px] font-medium">Alle neuen Anträge ({alle.length})</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] text-[18px] leading-none px-1"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        {/* Scrollbarer Body — kompakte Verbund-Zeilen, damit möglichst viele
            ohne Scrollen sichtbar sind. */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
        </div>
      </div>
    </div>
  );
}
