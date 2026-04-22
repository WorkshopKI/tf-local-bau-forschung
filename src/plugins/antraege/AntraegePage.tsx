import { AntraegeListe } from './AntraegeListe';
import { AntragDetail } from './AntragDetail';
import { VerbundDetail } from './VerbundDetail';
import { useAntraegeStore } from './store';

export function AntraegePage(): React.ReactElement {
  const selectedAz = useAntraegeStore(s => s.selectedAktenzeichen);
  const selectedVb = useAntraegeStore(s => s.selectedVerbundId);
  if (selectedVb) return <VerbundDetail verbundId={selectedVb} />;
  if (selectedAz) return <AntragDetail aktenzeichen={selectedAz} />;
  return <AntraegeListe />;
}
