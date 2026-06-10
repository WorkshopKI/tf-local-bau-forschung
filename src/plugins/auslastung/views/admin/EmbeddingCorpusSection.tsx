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
import type { AntragOderSlim } from '@/core/services/csv/types';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { buildEmbeddingCorpus } from '../../services/embedding-corpus';
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
import { uploadVerbundCorpusToShare, ensureVerbundCorpus } from '../../services/corpus-share-sync';
import { bumpAuslastungCorpusSignal } from '../../services/corpus-signal';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { useProfile } from '@/core/hooks/useProfile';
import { acquireBuildLock, releaseLock, heartbeat } from '@/core/services/infrastructure/build-lock';
import { isEmbeddingCorpusBuildEnabled, isDevContext } from '@/config/feature-flags';

interface Props {
  storage: StorageService;
  /** Slim-Projektion (v2.63) — nur fuer Counts/Anzeige. Builds laden die
   *  vollen Records transient selbst (Texte liegen nicht mehr im Cache). */
  antraege: ReadonlyArray<AntragOderSlim>;
  /** Embeddable Aktenzeichen aus dem Stream-Pass — Hash-Vergleich gegen das
   *  Share-Manifest (muss aus vollen Records stammen, Self-Heal-Integritaet). */
  embeddableAz: readonly string[];
}

// Der Build läuft in mehreren Phasen. Vor v2.21.2 war nur die per-Antrag-Phase
// an die Fortschritts-Anzeige gekoppelt; die nachfolgende (oft minutenlange)
// Verbund-Embedding-Phase lief stumm und ließ die Bar bei 100% „einfrieren".
type BuildPhase = 'antrag' | 'verbund' | 'centroids';
interface PhaseProgress { phase: BuildPhase; done: number; total: number; last?: string; etaSec?: number; }
const PHASE_LABELS: Record<BuildPhase, string> = {
  antrag: 'Themen-Vektoren (Anträge)',
  verbund: 'Verbund-Vektoren',
  centroids: 'Kategorie-Centroids berechnen…',
};

// v2.47: Build-Lock-Stufe für den lokalen Korpus-Build. Verhindert, dass mehrere
// User im selben (Citrix-)Host gleichzeitig je ein ~200-MB-Embedding-Modell laden
// und gemeinsam den Renderer-Speicher sprengen (Aw-Snap/OOM). Der anschließende
// Upload (`uploadFromIdb`, skipLock) läuft unter demselben gehaltenen Lock weiter.
const LOCK_STUFE_BUILD = 'auslastung-corpus-build';

export function EmbeddingCorpusSection({ storage, antraege, embeddableAz }: Props): React.ReactElement {
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
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lokalModell, setLokalModell] = useState<{ id: string; dim: number } | null>(null);
  const [aktenzeichenHash, setAktenzeichenHash] = useState<string | null>(null);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const total = antraege.length;
  // Waehrend des Builds tickt `phaseProgress` pro Item (Antrag bzw. Verbund).
  // `count` aktualisiert sich nur im `refresh()` nach der Verbund-Phase — die Bar
  // darf nicht erst am Ende auf 100 springen. Daher fuer die Anzeige: live-Werte
  // aus `phaseProgress`, sonst aus dem persistierten Cache-Stand. Bei
  // `incremental: true` zeigt das den Build-Job-Fortschritt (queue-relativ), bei
  // `incremental: false` den Gesamt-Stand.
  const displayCount = phaseProgress ? phaseProgress.done : count;
  const displayTotal = phaseProgress ? phaseProgress.total : total;
  // Centroid-Phase hat keinen Zähler (total 0) → Bar voll lassen statt auf 0% fallen.
  const pct = phaseProgress?.phase === 'centroids'
    ? 100
    : displayTotal > 0 ? (displayCount / displayTotal) * 100 : 0;

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
    // v2.63: embeddable-Liste kommt vorberechnet aus dem Stream-Pass des
    // Slim-Caches (volle Records noetig — Slim kann Embeddability nicht
    // entscheiden, Titel/Beschreibungs-Felder fehlen dort).
    void hashAktenzeichenSet([...embeddableAz]).then(h => { if (!cancelled) setAktenzeichenHash(h); });
    return () => { cancelled = true; };
  }, [antraege, embeddableAz]);

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
    // B (v2.47): Speicher-Warnung VOR dem schweren Build. Der Build lädt ein
    // ~200-MB-Embedding-Modell in den RAM dieses Tabs; in geteilten Sitzungen
    // (Citrix, mehrere User pro Host) kann der Tab dabei per Out-of-Memory
    // abstürzen ("Aw, Snap").
    if (!confirm(
      'Der Korpus-Build lädt ein ~200-MB-Modell in den Arbeitsspeicher dieses Browser-Tabs '
      + 'und läuft mehrere Minuten. In geteilten Sitzungen (z.B. Citrix mit mehreren Nutzern) '
      + 'kann der Tab dabei abstürzen („Aw, Snap" / Out of Memory).\n\n'
      + 'Nur starten, wenn sonst niemand baut und genügend RAM frei ist. Build jetzt starten?',
    )) return;

    setError(null);
    setRunning(true);
    // Lokale const fuer `signal` — nach dem `await acquireBuildLock` unten wuerde
    // TS die Non-Null-Narrowing von `abortRef.current` (mutable Ref) verlieren.
    const controller = new AbortController();
    abortRef.current = controller;

    // A (v2.47): Build-Lock VOR dem lokalen Build setzen (nicht erst beim Upload).
    // Verhindert, dass zwei User im selben Host gleichzeitig je ein 200-MB-Modell
    // laden → OOM. Fremder aktiver Lock → gar nicht erst bauen. Kein SMB/
    // Schreibrecht (offline) → best-effort ohne Lock (lokaler Build bleibt
    // möglich, es gibt dann ohnehin keinen Share zum Koordinieren).
    let lockAcquired = false;
    try {
      const lock = await acquireBuildLock(storage.idb, LOCK_STUFE_BUILD);
      if (!lock.acquired) {
        const ageMin = Math.round(lock.ageMinutes);
        setError(
          `Build läuft bereits (${lock.existing.kurator_name}, gestartet vor ${ageMin} min). `
          + 'Bitte warten oder „Vom Datenspeicher laden".',
        );
        setRunning(false);
        abortRef.current = null;
        return;
      }
      lockAcquired = true;
    } catch (err) {
      console.warn('[corpus-build] Build-Lock nicht verfügbar, baue best-effort ohne Lock:', err);
    }

    try {
      // Volle Records NUR fuer den Build transient laden (v2.63 Slim-Cache:
      // die Embedding-Texte liegen nicht mehr im RAM). Nach dem Build GC-frei.
      const buildProgrammId = useActiveProgramm.getState().activeProgrammId;
      const fullAntraege = buildProgrammId
        ? await listAntraegeByProgramm(storage.idb, buildProgrammId)
        : [];
      await buildEmbeddingCorpus(storage.idb, fullAntraege, {
        incremental,
        onProgress: p => setPhaseProgress({ phase: 'antrag', done: p.done, total: p.total, last: p.lastAntrag, etaSec: p.etaSec }),
        signal: controller.signal,
      });
      // v2.47: Heartbeat, damit der Lock während des (langen) Antrag-Laufs nicht
      // veraltet (Stale-Schwelle 2h, voller Build kann ~47 min dauern).
      if (lockAcquired) await heartbeat(storage.idb).catch(() => undefined);
      // Verbund-Embeddings (Stage-2-Klassifizierung) parallel mit aufbauen.
      // Klein im Vergleich zum Antrag-Korpus (typisch 1/3 der Verbund-Anzahl),
      // aber bei `incremental: false` ein voller zweiter Embedding-Lauf von
      // mehreren Minuten — daher MUSS der Fortschritt sichtbar sein (sonst friert
      // die Bar nach der per-Antrag-100% scheinbar ein, v2.21.2-Fix).
      await buildVerbundEmbeddingCorpus(storage.idb, fullAntraege, {
        incremental,
        signal: controller.signal,
        onProgress: p => setPhaseProgress({ phase: 'verbund', done: p.done, total: p.total, last: p.lastVerbundId, etaSec: p.etaSec }),
      });
      if (lockAcquired) await heartbeat(storage.idb).catch(() => undefined);
      // v2.11: Cache invalidieren, damit nachfolgende loadAllVerbundEmbeddings-
      // Calls (auch in `KlassifizierungsReview`) die neu gebauten Vektoren
      // sehen — sonst wuerde der Module-Cache die alten Daten weiter liefern.
      invalidateVerbundEmbeddingsCache();
      await refresh();
      // Centroids aus Verbund-Embeddings — pro Verbund-ID dedupliziert.
      // Phase-Label setzen + einen Tick yielden, damit React es paintet, BEVOR
      // die synchrone Centroid-Berechnung den Main-Thread blockiert.
      setPhaseProgress({ phase: 'centroids', done: 0, total: 0 });
      await new Promise(r => setTimeout(r, 0));
      const verbundEmbs = await loadAllVerbundEmbeddings(storage.idb);
      const cents = computeKategorieCentroidsFromVerbund(
        klassifizierungen,
        verbundEmbs,
        config.ueberKategorien,
        fullAntraege,
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

      // Centroid-Phase fertig → Phase-Anzeige beenden; den Upload signalisiert
      // ab hier `mirrorUploading` ("Lade Korpus … hoch"), Header fällt auf den
      // (eben refreshten) Cache-Stand zurück.
      setPhaseProgress(null);
      // v2.29.1: nach dem lokalen Build die Konsumenten-Views (Klassifizierung/
      // Matching) re-lesen lassen — sonst zeigen sie den leeren Vor-Build-Stand
      // bis zum Browser-Reload (cold-start-store-refresh-Klasse).
      bumpAuslastungCorpusSignal();

      // Auto-Upload auf den Daten-Share. Soft-fail — lokaler Build bleibt
      // erfolgreich, nur die Share-Sync hat ggf. nicht geklappt.
      if (lokalModell) {
        try {
          await uploadMirror(storage, lokalModell.id, lokalModell.dim, profile?.name, { skipLock: true });
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
      setPhaseProgress(null);
      abortRef.current = null;
      // A (v2.47): Build-Lock freigeben — über den ganzen Build+Upload gehalten.
      if (lockAcquired) await releaseLock(storage.idb).catch(() => undefined);
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

  /**
   * Manuell: per-Antrag- + Verbund-Korpus vom Daten-Share in den lokalen Cache
   * ziehen — die schnelle Alternative zum (auf CPU stundenlangen) Rebuild, wenn
   * ein anderer (z.B. GPU-)Rechner den Korpus schon gebaut + hochgeladen hat.
   * Räumt vorher den lokalen Cache (ein angefangener Build würde den Download
   * sonst blockieren) und ignoriert bewusst den aktenzeichen-Hash (manueller
   * „trotzdem laden"-Pfad — Modell-Kompat ist über die Button-Sichtbarkeit
   * garantiert). v2.20.
   */
  async function downloadFromShare(): Promise<void> {
    setError(null);
    setRunning(true);
    try {
      await clearEmbeddings(storage.idb);
      await clearVerbundEmbeddings(storage.idb);
      invalidateVerbundEmbeddingsCache();
      const r = await downloadMirror(storage);
      const v = await ensureVerbundCorpus(storage);
      await refresh();
      // v2.29.1: Konsumenten-Views (Klassifizierung/Matching) re-lesen lassen,
      // ohne Browser-Reload (cold-start-store-refresh-Klasse).
      bumpAuslastungCorpusSignal();
      if (!r || r.count === 0) {
        setError('Es wurden keine per-Antrag-Vektoren vom Datenspeicher geladen — Manifest/Bin fehlt oder ist leer.');
      } else if (v !== 'downloaded') {
        setError('Der per-Antrag-Korpus ist geladen, aber der Verbund-Korpus (für die Klassifizierung) liegt nicht (kompatibel) auf dem Datenspeicher. Auf einem Rechner mit der aktuellen Version „Corpus aufbauen" laufen lassen — dann werden die Verbund-Vektoren mitgespiegelt.');
      }
    } catch (err) {
      setError(`Laden vom Datenspeicher fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Themen-Vektoren für Klassifizierung</h3>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {phaseProgress
            ? (phaseProgress.phase === 'centroids'
                ? PHASE_LABELS.centroids
                : `${PHASE_LABELS[phaseProgress.phase]}: ${displayCount} von ${displayTotal} (${Math.round(pct)}%)`)
            : `${displayCount} von ${displayTotal} eingebettet (${Math.round(pct)}%)`}
        </span>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--tf-bg-secondary)' }}>
        <div
          className="h-full bg-[var(--tf-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {phaseProgress && phaseProgress.phase !== 'centroids' && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2">
          {phaseProgress.done}/{phaseProgress.total}
          {phaseProgress.last && <span className="font-mono ml-2">{phaseProgress.last}</span>}
          {phaseProgress.etaSec != null && (
            <span className="text-[var(--tf-text-tertiary)] ml-3">
              ≈ {formatEta(phaseProgress.etaSec)} verbleibend
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
          ℹ Share-Korpus: {mirrorManifest?.antraegeCount} Anträge (Stand {mirrorManifest ? new Date(mirrorManifest.builtAt).toLocaleDateString('de-DE') : '?'}). Lokaler Antrags-Stand: {total}. Sätze unterscheiden sich — daher kein automatischer Download. Du kannst den Share-Korpus trotzdem „Vom Datenspeicher laden" (schnell, deckt aber nur die {mirrorManifest?.antraegeCount} Share-Anträge ab), oder „Corpus aufbauen", um lokal mit deinem aktuellen Stand neu zu bauen und ihn auf den Share zu heben.
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
            {mirrorManifest && compatStatus?.kind === 'compatible' && count < mirrorManifest.antraegeCount && (
              <button
                type="button"
                onClick={() => void downloadFromShare()}
                className="px-3 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer"
                style={{ background: 'var(--tf-primary)', color: 'white', border: '0.5px solid var(--tf-primary)' }}
              >
                Vom Datenspeicher laden (~{mirrorManifest.antraegeCount} Vektoren, ≈10 s)
              </button>
            )}
            {/* C (v2.47): Build-Buttons nur wenn der lokale Build erlaubt ist.
                In der Citrix-pl-Config ausgeblendet (embeddingCorpusBuild=false)
                → der Build (200-MB-Modell im RAM) gehört auf einen ungeteilten
                Rechner; Citrix-User nutzen nur "Vom Datenspeicher laden".
                v2.56: Der Vollbuild (~47 min) bleibt zusätzlich dev-exklusiv
                (`isDevContext`). „Inkrementell" steht damit auch im kurator-
                Build (embeddingCorpusBuild default true, aber kein devContext)
                zur Verfügung — der Kurator hält so den Themen-Katalog aktuell,
                ohne den schweren Vollbuild auf einem Produktiv-Rechner. pl
                bleibt unverändert (embeddingCorpusBuild=false → beide aus). */}
            {isEmbeddingCorpusBuildEnabled() && (
              <>
                {isDevContext() && (
                  <button
                    type="button"
                    onClick={() => void build(false)}
                    disabled={total === 0}
                    className="px-3 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
                  >
                    Corpus aufbauen (~{Math.ceil(total * 0.2 / 60)} min)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void build(true)}
                  disabled={total === 0 || count >= total}
                  className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  Inkrementell
                </button>
              </>
            )}
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
        Einmaliger Vorgang. Der Build läuft in Phasen (Anträge → Verbünde → Centroids → Upload) — nach den Anträgen folgt noch ein kürzerer Verbund-Lauf, dessen Fortschritt die Anzeige separat ausweist. Themen-Vektoren ermöglichen die automatische Zuordnung neuer Anträge zu Überkategorien (Cosine-Similarity gegen Kategorie-Centroids). Cache liegt lokal im Browser-Storage (~{Math.round(total * (lokalModell?.dim ?? 768) * 4 / 1024 / 1024)} MB für {total} Anträge) und wird nach jedem erfolgreichen Build automatisch auf den Daten-Share gespiegelt (`_intern/auslastung-embedding-corpus.*`) — andere Teammitglieder laden den Korpus dann in ~10 sec statt selbst neu zu bauen.
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
