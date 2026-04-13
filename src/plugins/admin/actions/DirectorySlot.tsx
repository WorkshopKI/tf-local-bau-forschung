import { useState } from 'react';
import { FolderOpen, X, FolderPlus } from 'lucide-react';
import { Badge, Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';

interface DirectorySlotProps {
  type: 'documents' | 'data';
  label: string;
  badgeText: string;
  badgeVariant: 'info' | 'success';
  onChanged?: () => void;
}

export function DirectorySlot({ type, label, badgeText, badgeVariant, onChanged }: DirectorySlotProps): React.ReactElement {
  const storage = useStorage();
  const [error, setError] = useState('');

  const dirs: DirectoryEntry[] = storage.getDirectories().filter(d => d.type === type);
  const dir = dirs[0] ?? null;

  const handleAdd = async (): Promise<void> => {
    setError('');
    const result = await storage.addDirectory(type);
    if (result) { onChanged?.(); }
    else { setError('Ordner konnte nicht verbunden werden.'); }
  };

  const handleRemove = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
    onChanged?.();
  };

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      {dir ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
            <FolderOpen size={13} className="text-[var(--tf-text-tertiary)]" />
            <span>{dir.folderName ?? dir.label}</span>
            <Badge variant={badgeVariant}>{badgeText}</Badge>
          </div>
          <button onClick={() => handleRemove(dir.id)}
            className="p-1 text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-danger-text)]">
            <X size={13} />
          </button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" icon={FolderPlus} onClick={handleAdd}>{label} verbinden</Button>
      )}
      {error && <p className="text-[11px] text-[var(--tf-danger-text)] mt-1">{error}</p>}
    </div>
  );
}
