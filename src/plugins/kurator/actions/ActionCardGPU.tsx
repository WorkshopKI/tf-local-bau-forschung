import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui';
import { ActionCard } from './ActionCard';
import { unloadAllGPU, getGPUStatus } from '../utils/gpu-utils';

export function ActionCardGPU(): React.ReactElement {
  const [msg, setMsg] = useState<string | null>(null);

  const handleUnload = (): void => {
    const unloaded = unloadAllGPU();
    const text = unloaded.length > 0
      ? `Entladen: ${unloaded.join(', ')}`
      : 'Keine GPU-Modelle geladen';
    setMsg(text);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <ActionCard title="GPU-Speicher" status={msg ?? getGPUStatus()}>
      <Button variant="secondary" size="sm" icon={Trash2} onClick={handleUnload}>Modelle entladen</Button>
    </ActionCard>
  );
}
