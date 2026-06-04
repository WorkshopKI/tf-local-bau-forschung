/**
 * Embedding-Corpus-Section im Admin-Tab.
 *
 * - Status: x von y embeddet
 * - "Corpus aufbauen" / "Inkrementell" Buttons
 * - Toggle "Stage-2 aktivieren" (disabled bis Corpus >= 95%)
 * - Centroid-Berechnung nach Mapping-Aenderung
 * - Auto-Download vom SMB-Share wenn lokal leer + Korpus passt
 * - Auto-Upload nach Build (Build-Lock-Schutz beim Schreiben)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { Antrag } from '@/core/services/csv/types';
import {
  buildEmbeddingCorpus,
  getEmbeddableAktenzeichen,
  type BuildProgress,
} from '../../services/embedding-corpus';
import {
  clearEmbeddings,
  countEmbeddings,
  checkCompat,
  hashAktenzeichenSet,
  getCorpusBuildVersion,
  CORPUS_BUILD_VERSION,
} from '@/core/services/embedding-corpus';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import { computeKategorieCentroidsFromVerbund } from '../../services/klassifizierung-engine';
import {
  buildVerbundEmbeddingCorpus,
  loadAllVerbundEmbeddings,
  clearVerbundEmbeddings,
  invalidateVerbundEmbeddingsCache,
} from '../../services/verbund-embedding';
import { uploadVerbundCorpusToShare } from '../../services/corpus-share-sync';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { useProfile } from '@/core/hooks/useProfile';

interface Props {
  storage: StorageService;
  antraege: Antrag[];
}

export function EmbeddingCorpusSection({ storage, antraege }: Props): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const updateConfig = useAuslastungData(s => s.updateConfig);
  const persistAuslastung = useAuslastungData(s => s.persist);
  const { profile } = useProfile();

  const mirrorManifest = useEmbeddingCorpusMirror(s => s.manifest);
  const mirrorLoaded = useEmbeddingCorpusMirror(s => s.manifestLoaded);
  const mirrorDownloading = useEmbeddingCorpusMirror(s => s.downloading);
  const mirrorDownloadProgress = useEmbeddingCorpusMirror(s => s.downloadProgress);
  const mirrorUploading = useEmbeddingCorpusMirror(s => s.uploading);
  const mirrorError = useEmbeddingCorpusMirror(s => s.error);
  const loadMirrorManifest = useEmbeddingCorpusMirror(s => s.loadManifest);
  const downloadMirror = useEmbeddingCorpusMirror(s => s.downloadAndApply);
  const uploadMirror = useEmbeddingCorpusMirror(s => s.uploadFromIdb);

  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lokalModell, setLokalModell] = useState<{ id: string; dim: number } | null>(null);
  const [aktenzeichenHash, setAktenzeichenHash] = useState<string | null>(null);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const total = antraege.length;
  // Waehrend des Builds tickt `progress` pro Antrag. `count` aktualisiert sich nur
  // im `refresh()` nach Build-Abschluss — die Bar darf nicht erst am Ende auf 100
  // springen. Daher fuer die Anzeige: live-Werte aus `progress`, sonst aus dem
  // persistierten Cache-Stand. Bei `incremental: true` zeigt das den Build-Job-
  // Fortschritt (queue-relativ), bei `incremental: false` den Gesamt-Stand.
  const displayCount = progress ? progress.done : count;
  const displayTotal = progress ? progress.total : total;
  const pct = displayTotal > 0 ? (displayCount / displayTotal) * 100 : 0;

  const refresh = useCallback(async (): Promise<void> => {
    const c = await countEmbeddings(storage.idb);
    setCount(c);
  }, [storage]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Aktives Embedding-Modell laden (fuer Compat-Check + Upload-Metadaten).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await getActiveModelId(storage.idb);
      if (cancelled) return;
      const cfg = getModelById(id);
      setLokalModell({ id, dim: cfg.dimensions });
    })();
    return () => { cancelled = true; };
  }, [storage]);

  // Manifest vom Share lesen (klein, kein 42 MB Roundtrip).
  useEffect(() => {
    if (!mirrorLoaded) void loadMirrorManifest(storage);
  }, [mirrorLoaded, loadMirrorManifest, storage]);

  // SHA-256 ueber die aktuelle aktenzeichen-Liste — aber nur ueber die
  // embedbaren Antraege, sonst weicht der Hash strukturell vom Manifest-Hash
  // ab (Foyer-Exporte enthalten regelmaessig 5–10 Antraege ohne Titel/VB-Titel/
  // Projektbeschreibung, die im Build geskipt werden und nicht im Manifest
  // landen). 13k Field-Lookups + Filter sind <50 ms — laeuft nur bei
  // antraege-Aenderung, nicht pro Render.
  useEffect(() => {
    if (antraege.length === 0) { setAktenzeichenHash(null); return; }
    let cancelled = false;
    const list = getEmbeddableAktenzeichen(antraege);
    void hashAktenzeichenSet(list).then(h => { if (!cancelled) setAktenzeichenHash(h); });
    return () => { cancelled = true; };
  }, [antraege]);

  // Auto-Download: lokal leer + Share-Manifest da + Modell-Kompat OK + Hash passt
  // → einmaliger Versuch, sonst sind Auto-Loops zu nervig.
  useEffect(() => {
    if (autoDownloadAttempted) return;
    if (!mirrorLoaded || !mirrorManifest) return;
    if (!lokalModell || !aktenzeichenHash) return;
    if (count > 0) return; // lokal schon was da, nicht ueberschreiben
    if (running || mirrorDownloading) return;
    const compat = checkCompat(mirrorManifest, lokalModell.id, lokalModell.dim);
    if (compat.kind !== 'compatible') return;
    if (mirrorManifest.aktenzeichenSetHash !== aktenzeichenHash) return;
    setAutoDownloadAttempted(true);
    void downloadMirror(storage).then(async (r) => {
      if (r && r.count > 0) await refresh();
    }).catch(err => {
      setError(`Auto-Download fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [
    autoDownloadAttempted, mirrorLoaded, mirrorManifest, lokalModell,
    aktenzeichenHash, count, running, mirrorDownloading, downloadMirror, storage, refresh,
  ]);

  // Compat-Status fuer die UI-Hinweise (memoisiert).
  const compatStatus = useMemo(() => {
    if (!mirrorManifest || !lokalModell) return null;
    return checkCompat(mirrorManifest, lokalModell.id, lokalModell.dim);
  }, [mirrorManifest, lokalModell]);

  const hashMismatch = !!(mirrorManifest && aktenzeichenHash
    && mirrorManifest.aktenzeichenSetHash !== aktenzeichenHash);

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
      // Verbund-Embeddings (Stage-2-Klassifizierung) parallel mit aufbauen.
      // Klein im Vergleich zum Antrag-Korpus (typisch 1/3 der Verbund-Anzahl).
      await buildVerbundEmbeddingCorpus(storage.idb, antraege, {
        incremental,
        signal: abortRef.current.signal,
      });
      // v2.11: Cache invalidieren, damit nachfolgende loadAllVerbundEmbeddings-
      // Calls (auch in `KlassifizierungsReview`) die neu gebauten Vektoren
      // sehen — sonst wuerde der Module-Cache die alten Daten weiter liefern.
      invalidateVerbundEmbeddingsCache();
      await refresh();
      // Centroids aus Verbund-Embeddings — pro Verbund-ID dedupliziert.
      const verbundEmbs = await loadAllVerbundEmbeddings(storage.idb);
      const cents = computeKategorieCentroidsFromVerbund(
        klassifizierungen,
        verbundEmbs,
        config.ueberKategorien,
        antraege,
      );
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

      // Auto-Upload auf den Daten-Share. Soft-fail — lokaler Build bleibt
      // erfolgreich, nur die Share-Sync hat ggf. nicht geklappt.
      if (lokalModell) {
        try {
          await uploadMirror(storage, lokalModell.id, lokalModell.dim, profile?.name);
          // v2.19: Verbund-Embeddings separat mitspiegeln — der core-Mirror
          // (uploadMirror) deckt nur den per-Antrag-Korpus ab. Ohne das hätte
          // ein neuer Rechner keine Themen-Vektoren für die Klassifizierung
          // (er kann sie nur lokal neu bauen). Eigene Sidecar-Dateien.
          await uploadVerbundCorpusToShare(storage, lokalModell.id, lokalModell.dim, profile?.name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Build OK — Share-Upload fehlgeschlagen: ${msg}`);
        }
      }
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
      await clearVerbundEmbeddings(storage.idb);
      // v2.11: Module-Cache mit-invalidieren, sonst liefert der naechste
      // loadAllVerbundEmbeddings die alten Vektoren weiter.
      invalidateVerbundEmbeddingsCache();
      await refresh();
      // stage2Aktiv bleibt true (kein User-Toggle mehr) — nur das Build-Datum
      // zurücksetzen, damit die UI ein neues Build erzwingt.
      await updateConfig(storage, { embeddingCorpusBuiltAt: undefined });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Themen-Vektoren für Klassifizierung</h3>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {displayCount} von {displayTotal} eingebettet ({Math.round(pct)}%)
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

      {mirrorDownloading && mirrorDownloadProgress && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          Lade vom Daten-Share: {mirrorDownloadProgress.done}/{mirrorDownloadProgress.total} Vektoren
        </div>
      )}

      {mirrorUploading && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          Lade Korpus auf den Daten-Share hoch…
        </div>
      )}

      {compatStatus && compatStatus.kind !== 'compatible' && (
        <div className="rounded p-2 mb-2 text-[11.5px]" style={{ background: 'var(--tf-warning-bg, #fef3c7)', color: 'var(--tf-warning-text, #92400e)', border: '0.5px solid var(--tf-warning-border, #fde68a)' }}>
          {compatStatus.kind === 'modell-mismatch' && (
            <>⚠ Share-Korpus wurde mit Modell <code>{compatStatus.shareModell}</code> gebaut, du nutzt <code>{compatStatus.lokalModell}</code>. Vektoren sind inkompatibel — Korpus kann nicht vom Share geladen werden. Lokal neu bauen oder Modell wechseln.</>
          )}
          {compatStatus.kind === 'dim-mismatch' && (
            <>⚠ Share-Korpus hat Dim <code>{compatStatus.shareDim}</code>, dein Modell liefert <code>{compatStatus.lokalDim}</code>. Modell-Version weicht ab — lokal neu bauen.</>
          )}
        </div>
      )}

      {compatStatus?.kind === 'compatible' && hashMismatch && count === 0 && (
        <div className="rounded p-2 mb-2 text-[11.5px]" style={{ background: 'var(--tf-info-bg, #dbeafe)', color: 'var(--tf-info-text, #1e40af)', border: '0.5px solid var(--tf-info-border, #bfdbfe)' }}>
          ℹ Share-Korpus: {mirrorManifest?.antraegeCount} Anträge (Stand {mirrorManifest ? new Date(mirrorManifest.builtAt).toLocaleDateString('de-DE') : '?'}). Lokaler Antrags-Stand: {total}. Sätze unterscheiden sich — der Korpus deckt deinen aktuellen Stand nicht ab, daher kein Auto-Download. Klick „Corpus aufbauen", um lokal zu bauen und den Stand auf den Share zu heben.
        </div>
      )}

      {mirrorManifest && compatStatus?.kind === 'compatible' && count > 0 && count === mirrorManifest.antraegeCount && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
          ✓ Korpus mit Daten-Share synchron ({mirrorManifest.antraegeCount} Vektoren, Stand {new Date(mirrorManifest.builtAt).toLocaleDateString('de-DE')}{mirrorManifest.builderProfile ? ` von ${mirrorManifest.builderProfile}` : ''}){total > mirrorManifest.antraegeCount ? ` — ${total - mirrorManifest.antraegeCount} Anträge ohne Text-Daten, kein Embedding möglich` : ''}.
        </div>
      )}

      {mirrorManifest && compatStatus?.kind === 'compatible' && getCorpusBuildVersion(mirrorManifest) < CORPUS_BUILD_VERSION && (
        <div className="rounded p-2 mb-2 text-[11.5px]" style={{ background: 'var(--tf-info-bg, #dbeafe)', color: 'var(--tf-info-text, #1e40af)', border: '0.5px solid var(--tf-info-border, #bfdbfe)' }}>
          ℹ Korpus-Build-Version v{getCorpusBuildVersion(mirrorManifest)} — aktuell wäre v{CORPUS_BUILD_VERSION} (Embedding-Text enthält jetzt zusätzlich Deskriptor-Spalten: TECHN/BRANCHE/ANWEND + ZT-Klartexte). Rebuild empfohlen, damit die semantische Suche auf diese Tags zugreifen kann. „Corpus aufbauen" klicken und danach automatisch auf den Share spiegeln lassen.
        </div>
      )}

      {error && <div className="text-[11.5px] text-rose-700 mb-2">{error}</div>}
      {mirrorError && !error && <div className="text-[11.5px] text-rose-700 mb-2">{mirrorError}</div>}

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
      </div>

      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3">
        Einmaliger Vorgang. Themen-Vektoren ermöglichen die automatische Zuordnung neuer Anträge zu Überkategorien (Cosine-Similarity gegen Kategorie-Centroids). Cache liegt lokal im Browser-Storage (~{Math.round(total * (lokalModell?.dim ?? 768) * 4 / 1024 / 1024)} MB für {total} Anträge) und wird nach jedem erfolgreichen Build automatisch auf den Daten-Share gespiegelt (`_intern/auslastung-embedding-corpus.*`) — andere Teammitglieder laden den Korpus dann in ~10 sec statt selbst neu zu bauen.
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
