/**
 * Read-only Status-Block fuer den Embedding-Korpus.
 *
 * Zeigt Kurator-Usern an, dass der Korpus existiert (und in welchem
 * Zustand) — die eigentliche Build/Sync-UI lebt im Auslastungs-Plugin,
 * weil sie dort tief mit Centroid-Berechnung + Stage-2-Aktivierung
 * verflochten ist. Ein Move wuerde nur die Coupling-Richtung umkehren.
 *
 * Datenquelle: `useEmbeddingCorpusMirror` (core) — der gleiche Store
 * den auch das Auslastungs-Modul nutzt.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import {
  countEmbeddings,
  getCorpusBuildVersion,
  CORPUS_BUILD_VERSION,
} from '@/core/services/embedding-corpus';

export function EmbeddingCorpusStatusCard(): React.ReactElement {
  const storage = useStorage();
  const manifest = useEmbeddingCorpusMirror(s => s.manifest);
  const manifestLoaded = useEmbeddingCorpusMirror(s => s.manifestLoaded);
  const loadManifest = useEmbeddingCorpusMirror(s => s.loadManifest);
  const [localCount, setLocalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!manifestLoaded) void loadManifest(storage);
  }, [manifestLoaded, loadManifest, storage]);

  useEffect(() => {
    let cancelled = false;
    void countEmbeddings(storage.idb).then(n => { if (!cancelled) setLocalCount(n); });
    return () => { cancelled = true; };
  }, [storage]);

  const shareCount = manifest?.antraegeCount ?? null;
  const builtAt = manifest?.builtAt;
  const builderProfile = manifest?.builderProfile;
  const buildVersion = manifest ? getCorpusBuildVersion(manifest) : null;
  const versionOutdated = buildVersion !== null && buildVersion < CORPUS_BUILD_VERSION;

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-2">
        Embedding-Korpus (Anträge)
      </h3>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-3">
        Semantische Such-Vektoren pro Antrag. Wird vom Auslastungs-Modul (Stage-2-Matching) gebaut und im Antraege-Plugin (Hybrid-Suche) konsumiert.
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
        <dt className="text-[var(--tf-text-secondary)]">Lokal (IDB):</dt>
        <dd className="text-[var(--tf-text)]">
          {localCount === null ? '…' : `${localCount.toLocaleString('de-DE')} Vektoren`}
        </dd>
        <dt className="text-[var(--tf-text-secondary)]">Auf Daten-Share:</dt>
        <dd className="text-[var(--tf-text)]">
          {!manifestLoaded
            ? '…'
            : shareCount === null
              ? <span className="text-[var(--tf-text-tertiary)]">Kein Korpus auf Share</span>
              : `${shareCount.toLocaleString('de-DE')} Vektoren`}
        </dd>
        {builtAt && (
          <>
            <dt className="text-[var(--tf-text-secondary)]">Letzter Build:</dt>
            <dd className="text-[var(--tf-text)]">
              {new Date(builtAt).toLocaleDateString('de-DE')}
              {builderProfile ? <span className="text-[var(--tf-text-tertiary)]"> · {builderProfile}</span> : null}
            </dd>
          </>
        )}
        {buildVersion !== null && (
          <>
            <dt className="text-[var(--tf-text-secondary)]">Build-Version:</dt>
            <dd className={versionOutdated ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--tf-text)]'}>
              v{buildVersion}
              {versionOutdated && (
                <span className="ml-2 text-[11px]">— veraltet (aktuell v{CORPUS_BUILD_VERSION}, Rebuild empfohlen)</span>
              )}
            </dd>
          </>
        )}
      </dl>

      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3 leading-relaxed">
        Build / Sync / Stage-2-Aktivierung: <span className="text-[var(--tf-text-secondary)]">Auslastungs-Plugin → Admin-Tab → „Embedding-Corpus (Stufe 2)"</span>.
      </p>
    </div>
  );
}
