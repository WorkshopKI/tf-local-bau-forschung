/**
 * Overlay-Hülle für Aufnahme (Teil A) UND Batch-Generierung (Teil B). Hält die
 * `useAufnahme`-Instanz; der Batch-Job (`batch`) lebt eine Ebene höher
 * (AufnahmeHost) und überlebt das Schließen des Overlays. Phasen: Aufnahme →
 * Abschluss → Start-Dialog → Monitor (Monitor hat Vorrang, sobald ein Job läuft).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAufnahmeUiStore } from './useAufnahmeUiStore';
import { useAufnahme } from './useAufnahme';
import { AufnahmePanel } from './AufnahmePanel';
import { AbschlussPanel } from './AbschlussPanel';
import { StartDialog, BatchMonitor, type UseBatchJob } from '../gutachten-batch';

export function AufnahmeOverlay({ batch }: { batch: UseBatchJob }): React.ReactElement {
  const close = useAufnahmeUiStore(s => s.close);
  const navigate = useNavigate();
  const a = useAufnahme();
  const [phase, setPhase] = useState<'aufnahme' | 'start'>('aufnahme');
  const [batchFkz, setBatchFkz] = useState<string[]>([]);

  const schliessen = (): void => { a.reset(); close(); };
  const openAntrag = (fkz: string): void => { close(); navigate(`/antraege/${encodeURIComponent(fkz)}`); };

  const inhalt = phase === 'start' ? (
    <StartDialog
      batch={batch}
      fkzListe={batchFkz}
      onStarted={() => setPhase('aufnahme')}
      onAbbrechen={() => setPhase('aufnahme')}
    />
  ) : batch.job ? (
    <BatchMonitor batch={batch} onClose={schliessen} onOpenAntrag={openAntrag} />
  ) : a.abschluss ? (
    <AbschlussPanel
      info={a.abschluss}
      onNeu={a.reset}
      onClose={schliessen}
      onBatchStart={fkz => { setBatchFkz(fkz); setPhase('start'); }}
    />
  ) : (
    <AufnahmePanel a={a} />
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" // allow-raw-modal: Multi-Phasen-Wizard-Host (phasenabhängige Überschrift, kein statischer Dialog-Titel) — Klasse-7-Custom-Referenz
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) schliessen(); }}
    >
      <div className="relative w-full max-w-3xl mx-4 rounded-2xl bg-[var(--tf-bg)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col max-h-[85vh] overflow-hidden">
        <button
          type="button"
          onClick={schliessen}
          aria-label="Schließen"
          className="absolute top-4 right-4 z-10 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
        >
          <X size={18} />
        </button>
        <div className="overflow-y-auto p-6">
          {inhalt}
        </div>
      </div>
    </div>
  );
}
