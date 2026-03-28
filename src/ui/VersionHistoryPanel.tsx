import { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { Button, Badge, Dialog } from '@/ui';
import { DiffView } from './DiffView';
import { versionService } from '@/core/services/versioning/version-service';
import { useStorage } from '@/core/hooks/useStorage';
import type { VersionEntry } from '@/core/types/version';

interface VersionHistoryPanelProps {
  documentId: string;
  currentText: string;
  onRestore: (text: string) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({ documentId, currentText, onRestore, onClose }: VersionHistoryPanelProps): React.ReactElement {
  const storage = useStorage();
  const [history, setHistory] = useState<VersionEntry[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [viewingText, setViewingText] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showRestore, setShowRestore] = useState(false);

  useEffect(() => {
    versionService.getHistory(documentId, storage).then(setHistory);
  }, [documentId, storage]);

  const handleSave = async (): Promise<void> => {
    await versionService.createVersion(documentId, currentText, storage, saveMessage || undefined);
    setSaveMessage('');
    const updated = await versionService.getHistory(documentId, storage);
    setHistory(updated);
  };

  const handleViewVersion = async (version: number): Promise<void> => {
    const text = await versionService.reconstructVersion(documentId, version, currentText, history);
    setViewingText(text);
    setViewingVersion(version);
  };

  const handleRestore = async (): Promise<void> => {
    if (viewingVersion === null) return;
    const text = await versionService.restoreVersion(documentId, viewingVersion, currentText, storage);
    onRestore(text);
    setShowRestore(false);
    setViewingVersion(null);
    const updated = await versionService.getHistory(documentId, storage);
    setHistory(updated);
  };

  const formatRelative = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours}h`;
    return `vor ${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="w-[240px] shrink-0 flex flex-col h-full" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Versionen</span>
        <button onClick={onClose} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"><X size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {viewingVersion !== null && (
          <div className="mb-4">
            <DiffView textA={viewingText} textB={currentText} labelA={`v${viewingVersion}`} labelB="Aktuell" />
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" icon={RotateCcw} size="sm" onClick={() => setShowRestore(true)}>Wiederherstellen</Button>
              <Button variant="ghost" size="sm" onClick={() => setViewingVersion(null)}>Schließen</Button>
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-[12px] text-[var(--tf-text-tertiary)] py-4 text-center">Noch keine Versionen</p>
        ) : (
          <div className="space-y-1">
            {history.map(entry => (
              <button key={entry.version}
                onClick={() => handleViewVersion(entry.version)}
                className={`w-full text-left px-2 py-2 rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
                  viewingVersion === entry.version ? 'bg-[var(--tf-hover)]' : 'hover:bg-[var(--tf-hover)]'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)]" />
                  <span className="text-[12px] text-[var(--tf-text)]">v{entry.version}</span>
                  <Badge variant="default">{formatRelative(entry.timestamp)}</Badge>
                </div>
                <p className="text-[11px] text-[var(--tf-text-tertiary)] ml-3.5 mt-0.5 truncate">{entry.message}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <input value={saveMessage} onChange={e => setSaveMessage(e.target.value)} placeholder="Versions-Notiz..."
          className="w-full px-2 py-1.5 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none mb-2 placeholder:text-[var(--tf-text-tertiary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
        <Button variant="secondary" icon={Save} size="sm" onClick={handleSave} className="w-full">Version speichern</Button>
      </div>

      <Dialog open={showRestore} onClose={() => setShowRestore(false)} title="Version wiederherstellen?"
        footer={<><Button variant="secondary" onClick={() => setShowRestore(false)}>Abbrechen</Button><Button onClick={handleRestore}>Wiederherstellen</Button></>}>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          Der aktuelle Text wird durch Version {viewingVersion} ersetzt. Eine neue Version wird automatisch erstellt.
        </p>
      </Dialog>
    </div>
  );
}
