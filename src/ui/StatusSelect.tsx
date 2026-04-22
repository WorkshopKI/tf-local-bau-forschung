import { useState } from 'react';
import { Dialog, Button } from './index';
import { getAvailableTransitions } from '@/core/services/workflow/engine';

interface StatusSelectProps {
  currentStatus: string;
  type: 'bauantrag';
  labels: Record<string, string>;
  onChange: (status: string, comment?: string) => void;
  disabled?: boolean;
}

export function StatusSelect({ currentStatus, type, labels, onChange, disabled }: StatusSelectProps): React.ReactElement {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [comment, setComment] = useState('');

  const available = getAvailableTransitions(currentStatus, type);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const target = e.target.value;
    if (target === currentStatus) return;
    setPendingStatus(target);
    setComment('');
    setShowConfirm(true);
  };

  const handleConfirm = (): void => {
    onChange(pendingStatus, comment || undefined);
    setShowConfirm(false);
  };

  return (
    <>
      <select
        value={currentStatus}
        onChange={handleSelect}
        disabled={disabled || available.length === 0}
        className="px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <option value={currentStatus} disabled>{labels[currentStatus] ?? currentStatus}</option>
        {available.map(s => (
          <option key={s} value={s}>{labels[s] ?? s}</option>
        ))}
      </select>

      <Dialog open={showConfirm} onClose={() => setShowConfirm(false)}
        title={`Status ändern zu "${labels[pendingStatus] ?? pendingStatus}"?`}
        footer={<><Button variant="secondary" onClick={() => setShowConfirm(false)}>Abbrechen</Button><Button onClick={handleConfirm}>Bestätigen</Button></>}>
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--tf-text-secondary)]">
            {labels[currentStatus]} → {labels[pendingStatus]}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--tf-text)]">Kommentar (optional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              placeholder="Grund für die Änderung..."
              className="w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
              style={{ border: '0.5px solid var(--tf-border)' }} />
          </div>
        </div>
      </Dialog>
    </>
  );
}
