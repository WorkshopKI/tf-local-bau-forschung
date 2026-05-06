import { FlaskConical, Search } from 'lucide-react';
import { Button } from '@/ui';
import { ActionCard } from './ActionCard';

interface ActionCardQualityProps {
  qualityPct: number | null;
  hasMetadataLLM: boolean;
  onStartEval: () => void;
  onStartSmokeTest: () => void;
}

export function ActionCardQuality({
  qualityPct, hasMetadataLLM, onStartEval, onStartSmokeTest,
}: ActionCardQualityProps): React.ReactElement {
  const statusText = qualityPct !== null
    ? `Letzte: ${qualityPct}% Trefferquote`
    : 'Nicht geprueft';

  return (
    <ActionCard title="Qualitaet pruefen" status={statusText}>
      <Button variant="secondary" size="sm" icon={Search} onClick={onStartEval}>Eval starten</Button>
      {hasMetadataLLM && (
        <Button variant="secondary" size="sm" icon={FlaskConical} onClick={onStartSmokeTest}>Smoke-Test</Button>
      )}
    </ActionCard>
  );
}
