import { useNavigate } from 'react-router-dom';
import { AntraegeMain } from './AntraegeMain';
import { AntragDetail } from './AntragDetail';
import { VerbundDetail } from './VerbundDetail';
import { useAntraegeStore } from './store';

export function AntraegePage(): React.ReactElement {
  const navigate = useNavigate();
  const selectedAz = useAntraegeStore(s => s.selectedAktenzeichen);
  const selectedVb = useAntraegeStore(s => s.selectedVerbundId);
  const hasDetail = !!(selectedAz || selectedVb);
  const closeDetail = (): void => navigate('/antraege');
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <AntraegeMain narrow={hasDetail} />
      {selectedVb ? (
        <VerbundDetail verbundId={selectedVb} onClose={closeDetail} onOpenAntrag={openAntrag} />
      ) : selectedAz ? (
        <AntragDetail aktenzeichen={selectedAz} onClose={closeDetail} onOpenVerbund={openVerbund} />
      ) : null}
    </div>
  );
}
