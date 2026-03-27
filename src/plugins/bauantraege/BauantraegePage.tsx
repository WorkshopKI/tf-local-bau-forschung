import { useBauantraegeStore } from './store';
import { BauantraegeListe } from './BauantraegeListe';
import { BauantragDetail } from './BauantragDetail';

export function BauantraegePage(): React.ReactElement {
  const selectedId = useBauantraegeStore(s => s.selectedId);
  return selectedId ? <BauantragDetail /> : <BauantraegeListe />;
}
