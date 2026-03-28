import { useState } from 'react';
import { FolderOpen, Wifi, WifiOff } from 'lucide-react';
import { Button, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';

export function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const [connected, setConnected] = useState(storage.isFileServerConnected());
  const [fsName, setFsName] = useState(storage.getFileServerName() ?? '');

  const handleConnect = async (): Promise<void> => {
    const ok = await storage.connectFileServer();
    setConnected(ok);
    if (ok) setFsName(storage.getFileServerName() ?? '');
  };

  const handleDisconnect = async (): Promise<void> => {
    await storage.disconnectFileServer();
    setConnected(false);
    setFsName('');
  };

  return (
    <div className="space-y-4">
      <SectionHeader label="File Server" />
      <div className="flex items-center gap-3 mt-3">
        {connected ? <Wifi size={18} className="text-[var(--tf-success-text)]" /> : <WifiOff size={18} className="text-[var(--tf-text-tertiary)]" />}
        <div>
          <p className="text-[13px] font-medium text-[var(--tf-text)]">{connected ? `Verbunden: ${fsName}` : 'Nicht verbunden'}</p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">{connected ? 'Vorgänge werden auf dem File Server gespeichert' : 'Nur lokaler Speicher (IndexedDB)'}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" icon={FolderOpen} onClick={handleConnect}>
          {connected ? 'Verzeichnis wechseln' : 'Verzeichnis wählen'}
        </Button>
        {connected && <Button variant="ghost" onClick={handleDisconnect}>Trennen</Button>}
      </div>
    </div>
  );
}
