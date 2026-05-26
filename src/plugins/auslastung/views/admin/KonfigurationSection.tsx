/**
 * Globale Auslastungs-Config: Stunden pro TV, Quartal, Gewichtungen, Frist.
 * Section im Admin-Tab.
 */
import { useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAuslastungData } from '../../hooks/useAuslastungData';

interface Props {
  storage: StorageService;
}

export function KonfigurationSection({ storage }: Props): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const updateConfig = useAuslastungData(s => s.updateConfig);
  const [busy, setBusy] = useState(false);

  async function update(partial: Parameters<typeof updateConfig>[1]): Promise<void> {
    setBusy(true);
    try { await updateConfig(storage, partial); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-3">Konfiguration</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Standard-Stunden pro Teilvorhaben">
          <input
            type="number"
            min={1}
            max={500}
            value={config.stundenProTV}
            onChange={e => void update({ stundenProTV: Number(e.target.value) || 9 })}
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
        <Field label="Aktuelles Quartal">
          <input
            type="text"
            value={config.aktuellesQuartal}
            onChange={e => void update({ aktuellesQuartal: e.target.value })}
            placeholder="2026-Q2"
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none font-mono"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
        <Field label="Selbsteintragungs-Frist (Tage)">
          <input
            type="number"
            min={0}
            max={90}
            value={config.selbsteintragungFristTage}
            onChange={e => void update({ selbsteintragungFristTage: Number(e.target.value) || 7 })}
            disabled={busy}
            className="w-full text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
        {label}
      </label>
      {children}
    </div>
  );
}
