/**
 * Ausgabe der finalen (de-anonymisierten) Antwort. Phase 7: read-only Anzeige.
 * Phase 8 ergänzt Clipboard (primär) + mailto (sekundär).
 *
 * Hinweis: die finale Antwort enthält BEWUSST die echten Originaldaten — sie geht
 * als normale Antwort an den ursprünglichen Absender (kein externer Leak), läuft
 * daher NICHT durch pruefeExportSicher.
 */
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

export function FinaleAntwortAusgabe({ anfrage }: Props): React.ReactElement {
  return (
    <div className="mt-4">
      <h4 className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-1.5">Finale Antwort</h4>
      <div className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 max-h-[40vh] overflow-y-auto">
        {anfrage.finaleAntwort || <span className="text-[var(--tf-text-tertiary)]">— leer —</span>}
      </div>
    </div>
  );
}
