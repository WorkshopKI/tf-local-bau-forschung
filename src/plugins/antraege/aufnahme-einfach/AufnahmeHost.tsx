/**
 * Immer gemountete Hülle (nur wenn `gutachtenWorkflow`-Flag an): besitzt den
 * Batch-Job (`useBatchJob`), damit ein laufender Lauf das Öffnen/Schließen des
 * Aufnahme-Overlays überlebt („Job läuft solange der Tab lebt"). Rendert das
 * Overlay nur, wenn es geöffnet ist.
 */
import { useBatchJob } from '../gutachten-batch';
import { useAufnahmeUiStore } from './useAufnahmeUiStore';
import { AufnahmeOverlay } from './AufnahmeOverlay';

export function AufnahmeHost(): React.ReactElement | null {
  const batch = useBatchJob();
  const open = useAufnahmeUiStore(s => s.open);
  return open ? <AufnahmeOverlay batch={batch} /> : null;
}
