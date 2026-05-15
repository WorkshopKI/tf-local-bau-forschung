/**
 * Embedding-Corpus-Section im Admin-Tab.
 *
 * - Status: x von y embeddet
 * - "Corpus aufbauen" / "Inkrementell" Buttons
 * - Toggle "Stage-2 aktivieren" (disabled bis Corpus >= 95%)
 * - Centroid-Berechnung nach Mapping-Aenderung
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { Antrag } from '@/core/services/csv/types';
import {
  buildEmbeddingCorpus,
  clearEmbeddings,
  countEmbeddings,
  loadAllEmbeddings,
  type BuildProgress,
} from '../../services/embedding-corpus';
import { computeKategorieCentroids } from '../../services/klassifizierung-engine';
import { useAuslastungData } from '../../hooks/useAuslastungData';

interface Props {
  storage: StorageService;
  antraege: Antrag[];
}

export function EmbeddingCorpusSection({ storage, antraege }: Props): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const updateConfig = useAuslastungData(s => s.updateConfig);
  const persistAuslastung = useAuslastungData(s => s.persist);

  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const total = antraege.length;
  const pct = total > 0 ? (count / total) * 100 : 0;
  const stage2Eligible = pct >= 95;

  const refresh = useCallback(async (): Promise<void> => {
    const c = await countEmbeddings(storage.idb);
    setCount(c);
  }, [storage]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function build(incremental: boolean): Promise<void> {
    setError(null);
    setRunning(true);
    abortRef.current = new AbortController();
    try {
      await buildEmbeddingCorpus(storage.idb, antraege, {
        incremental,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });
      await refresh();
      // Centroids neu berechnen
      const embs = await loadAllEmbeddings(storage.idb);
      const cents = computeKategorieCentroids(klassifizierungen, embs, config.ueberKategorien);
      const nextKats = config.ueberKategorien.map(k => ({
        ...k,
        referenzEmbedding: cents.get(k.id),
      }));
      useAuslastungData.setState(state => ({
        data: {
          ...state.data,
          config: {
            ...state.data.config,
            ueberKategorien: nextKats,
            embeddingCorpusBuiltAt: new Date().toISOString(),
          },
        },
      }));
      await persistAuslastung(storage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function abort(): void {
    abortRef.current?.abort();
  }

  async function clear(): Promise<void> {
    if (!confirm('Alle Embeddings im lokalen Cache löschen?')) return;
    setRunning(true);
    try {
      await clearEmbeddings(storage.idb);
      await refresh();
      await updateConfig(storage, { stage2Aktiv: false, embeddingCorpusBuiltAt: undefined });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Embedding-Corpus (Stufe 2)</h3>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {count} von {total} eingebettet ({Math.round(pct)}%)
        </span>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--tf-bg-secondary)' }}>
        <div
          className="h-full bg-[var(--tf-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {progress && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          {progress.done}/{progress.total}
          {progress.lastAntrag && <span className="font-mono ml-2">{progress.lastAntrag}</span>}
          {progress.etaSec != null && (
            <span className="text-[var(--tf-text-tertiary)] ml-3">
              ≈ {formatEta(progress.etaSec)} verbleibend
            </span>
          )}
        </div>
      )}

      {error && <div className="text-[11.5px] text-rose-700 mb-2">{error}</div>}

      <div className="flex flex-wrap gap-2 items-center">
        {!running ? (
          <>
            <button
              type="button"
              onClick={() => void build(false)}
              disabled={total === 0}
              className="px-3 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Corpus aufbauen (~{Math.ceil(total * 0.2 / 60)} min)
            </button>
            <button
              type="button"
              onClick={() => void build(true)}
              disabled={total === 0 || count >= total}
              className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              Inkrementell
            </button>
            <button
              type="button"
              onClick={() => void clear()}
              disabled={count === 0}
              className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
              style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
            >
              Cache leeren
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={abort}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Abbrechen
          </button>
        )}

        <label className="ml-auto flex items-center gap-2 text-[12.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={config.stage2Aktiv}
            disabled={!stage2Eligible || running}
            onChange={e => void updateConfig(storage, { stage2Aktiv: e.target.checked })}
          />
          <span className={stage2Eligible ? '' : 'text-[var(--tf-text-tertiary)]'}>
            Stufe-2-Embedding aktivieren
          </span>
        </label>
      </div>

      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3">
        Einmaliger Vorgang. Cache liegt lokal im Browser-Storage (~{Math.round(total * 768 * 4 / 1024 / 1024)} MB für {total} Anträge), wird nicht auf den Daten-Share gespiegelt.
      </p>
    </div>
  );
}

function formatEta(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `${h}h ${rem}min`;
}
