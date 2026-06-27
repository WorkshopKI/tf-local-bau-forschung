/**
 * Start-Dialog der Batch-Generierung: Mengen-Zusammenfassung inkl. Ausschlüsse,
 * Abschnitts-Pills (Nur A / A–G), Transport-Status. Starten nur, wenn interner
 * Transport erreichbar + mind. ein Antrag bereit. Nur Entwürfe — Freigaben einzeln.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { BatchAbschnitte } from '@/core/services/gutachten-batch';
import type { UseBatchJob, StartInfo } from './useBatchJob';

interface Props {
  batch: UseBatchJob;
  fkzListe: string[];
  onStarted: () => void;
  onAbbrechen: () => void;
}

export function StartDialog({ batch, fkzListe, onStarted, onAbbrechen }: Props): React.ReactElement {
  const [abschnitte, setAbschnitte] = useState<BatchAbschnitte>('nur_a');
  const [info, setInfo] = useState<StartInfo | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const fkzKey = fkzListe.join(',');

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setLadefehler(null);
    (async () => {
      try {
        const r = await batch.ladeStartInfo(fkzListe, abschnitte);
        if (!cancelled) setInfo(r);
      } catch (err) {
        if (!cancelled) setLadefehler(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fkzKey, abschnitte]);

  const starten = useAsyncAction(async () => {
    if (!info) return;
    await batch.start(info.mengen.bereit, abschnitte);
    onStarted();
  });

  const bereit = info?.mengen.bereit.length ?? 0;
  const transportOk = info?.transport.verfuegbar ?? false;
  const startbar = bereit > 0 && transportOk && !starten.busy;

  return (
    <div>
      <h2 className="text-[18px] font-medium text-[var(--tf-text)] mb-1">Gutachten-Entwürfe erzeugen</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] mb-4">
        Für die ausgewählten Anträge werden nacheinander Gutachten-Entwürfe erzeugt.
      </p>

      {info === null && !ladefehler ? (
        <div className="py-4 text-[13px] text-[var(--tf-text-tertiary)] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Anträge prüfen…</div>
      ) : ladefehler ? (
        <div className="rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>⚠ {ladefehler}</div>
      ) : info ? (
        <>
          {/* Abschnitts-Pills */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-[70px] text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium">Umfang</span>
            {([['nur_a', 'Nur A'], ['a_bis_g', 'A–G']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                aria-pressed={abschnitte === val}
                onClick={() => setAbschnitte(val)}
                className={`px-3 py-1 rounded-full text-[11.5px] border-[0.5px] ${
                  abschnitte === val
                    ? 'bg-[var(--tf-text)] text-[var(--tf-bg)] border-transparent'
                    : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mengen */}
          <div className="text-[13px] text-[var(--tf-text)] mb-1">{bereit} {bereit === 1 ? 'Antrag' : 'Anträge'} bereit</div>
          <ul className="text-[12px] text-[var(--tf-text-tertiary)] space-y-0.5 mb-4">
            {info.mengen.ohneVb.length > 0 && <li>· {info.mengen.ohneVb.length} übersprungen: keine VB</li>}
            {info.mengen.bereitsStand.length > 0 && <li>· {info.mengen.bereitsStand.length} übersprungen: bereits Gutachten-Stand</li>}
          </ul>

          {/* Transport-Status */}
          <div className="text-[12px] mb-4">
            {transportOk ? (
              <span className="text-[var(--tf-text-secondary)]">Transport: <span className="text-[var(--tf-success-text)]">erreichbar</span>{info.transport.name ? ` · ${info.transport.name}` : ''}</span>
            ) : (
              <span className="text-[var(--tf-danger-text)]">Kein interner Transport erreichbar — Start nicht möglich.</span>
            )}
          </div>

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-1">Nur Entwürfe — Freigaben erfolgen einzeln.</p>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-4">Overlay geöffnet lassen — kein Hintergrundlauf.</p>

          {starten.error && (
            <div className="mb-3 rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>⚠ {starten.error}</div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => starten.run()}
              loading={starten.busy}
              disabled={!startbar}
            >
              Starten ({bereit})
            </Button>
            <Button type="button" variant="ghost" onClick={onAbbrechen}>Abbrechen</Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
